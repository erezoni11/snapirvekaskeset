"""Browser regression checks for the Next.js app; run against npm run dev/start.
All commerce tests use an isolated browser storage context and block live APIs.
"""
import os,json,uuid,time,base64,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('SNAPIR_BASE_URL','http://localhost:3000').rstrip('/')
root=Path(__file__).resolve().parent.parent
for name,expected in [('public/vendor/nagishli/nagishli.js','D01A65146509B88E3D7ECA9501B75D8572BB3FDD5BDE6C9BB909D0B3BCA2858A'),('public/vendor/nagishli-v3/nagishli_v3_beta/nagishli_beta.js','5F88B81FDB3B55ED562458F7C99DE7A081241DAA76F8FECA9ABFD7CD8ECD885B')]:
    assert hashlib.sha256((root/name).read_bytes()).hexdigest().upper()==expected

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000})
    errors=[];console=[];live=[];failed=[]
    context.route('**/rest/v1/**',lambda route:(live.append(route.request.url),route.abort()))
    def observe(page):
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
        page.on('response',lambda r:failed.append((r.status,r.url)) if r.status>=400 and r.url.startswith(base) else None)
    context.on('page',observe)
    page=context.new_page();page.bring_to_front();page.goto(base+'/?local-orders=1',wait_until='networkidle')
    page.locator('.product .add-cart').first.wait_for();assert page.locator('.product').count()==20
    page.evaluate('window.routeMarker=42;window.headerBefore=document.querySelector(".header")')
    product_id=page.locator('.product').first.get_attribute('data-product-id')
    page.locator('.product .add-cart').first.click();page.locator('.drawer-close').click();page.locator('#cart-dialog').wait_for(state='hidden')
    for slug in ['pool','smoked','frozen','deli','sea']:
        page.locator(f'.navigation a[data-category={slug}]').click();page.wait_for_url(base+'/'+slug)
        assert page.evaluate('routeMarker===42 && headerBefore===document.querySelector(".header")')
        assert page.locator('.cart-count').inner_text()=='1'
        assert page.locator('.navigation a[aria-current=page]').count()==1
        assert page.locator('.product').count()==4
        assert page.locator('#NagishLiTrigger').count()==1
    page.locator('.cart-btn').click();page.locator('.checkout-link').click();page.wait_for_url(base+'/checkout')
    def details():
        page.locator('#cart-dialog').wait_for(state='hidden')
        page.locator('#checkout-next:not(:disabled)').wait_for()
        page.locator('[name=customer_name]').fill('לקוח בדיקת Next')
        page.locator('[name=phone]').fill('0501234567');page.locator('#checkout-next').click()
    details();page.locator('.shipping-choice').filter(has_text='איסוף עצמי').click();assert page.locator('#delivery-address').count()==0
    page.locator('#checkout-next').click();page.locator('[name=confirmed]').check();page.locator('#checkout-submit').click();page.locator('#checkout-success').wait_for()
    assert '#1001' in page.locator('#receipt-number').inner_text()
    assert page.locator('.cart-count').inner_text()=='0'
    page.reload(wait_until='networkidle');page.locator('#checkout-success').wait_for()
    admin=context.new_page();admin.bring_to_front();admin.goto(base+'/admin?local-orders=1#orders',wait_until='networkidle');admin.locator('[data-order]').first.wait_for()
    assert 'לקוח בדיקת Next' in admin.locator('#admin-content').inner_text()
    for status in ['processing','ready','completed']:
        admin.locator('[data-order]').first.click();admin.locator('[name=status]').select_option(status);admin.locator('#save-editor').click();admin.locator('#editor-dialog').wait_for(state='hidden')
    assert admin.evaluate('JSON.parse(localStorage.getItem("snapir-local-store-v1")).orders[0].status')=='completed'
    print('PASS shared routes, cart, pickup and admin approval',flush=True)
    # Admin preview messages must reach the React provider after hydration.
    admin.locator('[data-section=products]').click();admin.locator('[data-preview]').first.click()
    frame=admin.frame_locator('#preview-frame');frame.locator('.store-preview-banner').wait_for()
    assert frame.locator('.product').count()>=1
    admin.locator('#close-preview').click()
    print('PASS admin iframe preview',flush=True)
    # Delivery address validation, authoritative fee and admin cancellation.
    page.bring_to_front();page.goto(base+'/?local-orders=1',wait_until='networkidle');page.locator('.product .add-cart').first.click();page.locator('.checkout-link').click();details()
    page.locator('.shipping-choice').filter(has_text='משלוח בקירור').click();page.locator('#checkout-next').click();assert page.locator('[data-checkout-step="2"]').is_visible()
    for name,value in [('city','תל אביב'),('street','הים'),('house','7')]:page.locator(f'[name={name}]').fill(value)
    page.locator('#checkout-next').click();page.locator('[name=confirmed]').check();page.locator('#checkout-submit').click();page.locator('#checkout-success').wait_for()
    state=page.evaluate('JSON.parse(localStorage.getItem("snapir-local-store-v1"))');assert len(state['orders'])==2
    assert state['orders'][0]['shipping_cents']==3500 and state['orders'][0]['fulfillment']=='delivery'
    admin.bring_to_front();admin.goto(base+'/admin?local-orders=1#orders',wait_until='networkidle');admin.locator('[data-order]').first.click();admin.locator('[name=status]').select_option('cancelled');admin.once('dialog',lambda d:d.accept());admin.locator('#save-editor').click();admin.locator('#editor-dialog').wait_for(state='hidden')
    stock=admin.evaluate('(id)=>JSON.parse(localStorage.getItem("snapir-local-store-v1")).inventory.find(i=>i.product_id===id).quantity_kg',product_id);assert stock==19.5
    # Local reload preserves idempotency after a committed order response is lost.
    page.bring_to_front();page.goto(base+'/?local-orders=1',wait_until='networkidle');page.locator('.product .add-cart').first.click();page.locator('.checkout-link').click();details();page.locator('.shipping-choice').filter(has_text='איסוף עצמי').click();page.locator('#checkout-next').click();page.locator('[name=confirmed]').check()
    page.evaluate('''()=>{const original=snapirLocalPreview.client.rpc;let lost=false;snapirLocalPreview.client.rpc=(...args)=>{const promise=original(...args).then(result=>{if(args[0]==='svk_checkout'&&!lost){lost=true;throw Error('Network response lost');}return result;});promise.abortSignal=()=>promise;return promise;};}''')
    page.locator('#checkout-submit').click();page.locator('#checkout-error').wait_for();page.reload(wait_until='networkidle')
    page.locator('[name=confirmed]').check();page.locator('#checkout-submit').click();page.locator('#checkout-success').wait_for()
    assert page.evaluate('JSON.parse(localStorage.getItem("snapir-local-store-v1")).orders.length')==3
    # Accessibility stays loaded once across client-side navigation and preserves scaling.
    page.bring_to_front();page.goto(base+'/?local-orders=1',wait_until='networkidle');launcher=page.locator('#NagishLiTrigger [role=button]');launcher.focus();page.keyboard.press('Enter');page.locator('#NagishLiText').click()
    measure=lambda selector:page.locator(selector).evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
    before=(measure('.hero h1'),measure('.hero p'));page.locator('[data-nagishli-type=text-size][data-nagishli-value=bigger]').click();page.wait_for_function('(size)=>parseFloat(getComputedStyle(document.querySelector(".hero h1")).fontSize)>size',arg=before[0]);after=(measure('.hero h1'),measure('.hero p'));assert after[0]>before[0] and abs(after[0]/after[1]-before[0]/before[1])<.01,(before,after,page.locator('body').get_attribute('class'))
    page.keyboard.press('Escape');assert launcher.get_attribute('aria-expanded')=='false'
    page.locator('.navigation a[data-category=smoked]').click();page.wait_for_url(base+'/smoked');assert page.locator('#NagishLiTrigger').count()==1
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.menu').click();page.locator('.navigation a[data-category=pool]').click();page.wait_for_url(base+'/pool');assert not page.locator('.navigation').is_visible()
    page.screenshot(path=str(Path(os.environ['TEMP'])/'snapir-next-mobile.png'),full_page=True)
    # A shared header edit is visible on the next route without rebuilding templates.
    page.goto(base+'/index.html?local-orders=1',wait_until='networkidle');assert page.url==base+'/?local-orders=1'
    page.goto(base+'/smoked.html?local-orders=1',wait_until='networkidle');assert page.url==base+'/smoked?local-orders=1'
    page.goto(base+'/accessibility',wait_until='networkidle');assert page.get_by_text('Erez Yaakovi',exact=True).count()==1
    assert not live,live
    assert not errors,errors
    assert not console,console
    assert not failed,failed
    print('PASS: clean routes and legacy redirects; one persistent header/cart/widget; catalog navigation; pickup/delivery; admin approval/preview/cancellation; stock; receipt reload and lost-response recovery; mobile menu; accessibility; no live API calls or browser errors')
    # Test the real Auth SDK request flow without sending test credentials to Supabase.
    auth_context=browser.new_context()
    user_id=str(uuid.uuid4())
    user={'id':user_id,'email':'sariel@staff.snapirvekaskeset.invalid','aud':'authenticated','role':'authenticated','app_metadata':{'provider':'email'},'user_metadata':{}}
    staff={'user_id':user_id,'display_name':'Sariel','role':'admin','active':True}
    def encoded(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    token=encoded({'alg':'HS256','typ':'JWT'})+'.'+encoded({'sub':user_id,'exp':int(time.time())+3600,'iat':int(time.time()),'aud':'authenticated','role':'authenticated','email':user['email']})+'.'+encoded('test-signature')
    password_updates=[]
    def auth_route(route):
        request=route.request
        if '/token?' in request.url:
            payload=request.post_data_json
            assert payload['email']==user['email']
            if payload['password']=='wrong':
                route.fulfill(status=400,json={'error':'invalid_grant','error_code':'invalid_credentials','msg':'Invalid login credentials'})
            else:
                route.fulfill(json={'access_token':token,'refresh_token':'test-refresh-token','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user})
        else:
            if request.method=='PUT':password_updates.append(request.post_data_json)
            route.fulfill(json=user)
    auth_context.route('**/auth/v1/**',auth_route)
    def staff_route(route):
        if '/svk_staff?' in route.request.url:
            singular='application/vnd.pgrst.object+json' in route.request.headers.get('accept','')
            route.fulfill(json=staff if singular else [staff])
        else:route.fulfill(json=[])
    auth_context.route('**/rest/v1/**',staff_route)
    auth_page=auth_context.new_page()
    auth_page.goto(base+'/admin')
    auth_page.locator('[name=username]').fill('sariel')
    auth_page.locator('[name=password]').fill('wrong')
    auth_page.locator('#login-form button').click()
    auth_page.locator('#login-status.error').wait_for()
    assert not auth_page.locator('#admin-app').is_visible()
    auth_page.locator('[name=password]').fill('TestingPassOne!')
    auth_page.locator('#login-form button').click()
    auth_page.locator('#admin-app').wait_for(state='visible')
    auth_page.locator('#change-password').click()
    auth_page.locator('[name=current]').fill('wrong')
    auth_page.locator('[name=next]').fill('TestingPassTwo!')
    auth_page.locator('[name=confirm]').fill('TestingPassTwo!')
    auth_page.locator('#save-editor').click()
    auth_page.locator('#editor-error').filter(has_text='שגויים').wait_for()
    assert not password_updates
    auth_page.locator('[name=current]').fill('TestingPassOne!')
    auth_page.locator('#save-editor').click()
    auth_page.locator('#editor-dialog').wait_for(state='hidden')
    assert len(password_updates)==1 and password_updates[0]['password']=='TestingPassTwo!'
    auth_context.close()
    print('PASS: username login, rejected password, current-password verification and Auth password update')
    browser.close()
