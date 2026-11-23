"""Admin overview acceptance checks, using isolated local storage only."""
import os
import json
import base64
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('SNAPIR_BASE_URL', 'http://localhost:3000').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    live, errors = [], []
    context.route('**/rest/v1/**', lambda route: (live.append(route.request.url), route.abort()))
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.clock.install(time=datetime(2026, 11, 23, 12, tzinfo=timezone.utc))
    page.goto(base + '/admin?local-orders=1', wait_until='networkidle')
    expect(page.locator('.order-overview-empty')).to_be_visible()
    page.evaluate('''() => {
      const state = snapirLocalPreview.read(), now = Date.now();
      const product = state.documents.find(d => d.kind === 'products');
      state.customers = [{id:'customer', name:'לקוח <script>בדיקה</script>', phone:'0501234567'}];
      state.orders = [
        ['new',75,75], ['new',45,45], ['new',29,29], ['processing',180,15],
        ['ready',200,10], ['shipped',220,20], ['completed',300,25], ['cancelled',400,30],
        ['processing',240,null]
      ].map(([status,age,stageAge], i) => ({
        id:'order-'+i, number:2000+i, customer_id:'customer', status,
        created_at:new Date(now-age*60000).toISOString(),
        status_entered_at:stageAge === null ? null : new Date(now-stageAge*60000).toISOString(),
        total_cents:12345, shipping_cents:0, shipping_name:'איסוף עצמי', fulfillment:status==='shipped'?'delivery':'pickup',
        items:[{product_id:product.id,name:product.data.title,quantity_kg:1,total_cents:12345,cut:product.data.cuts[0]}]
      }));
      snapirLocalPreview.save(state,state.version);
    }''')
    page.get_by_role('button', name='רענון', exact=True).click()
    expect(page.locator('[data-overview-order]')).to_have_count(7)
    assert page.locator('#admin-content > :first-child').get_attribute('id') == 'order-overview-slot'
    assert list(map(int,page.locator('.order-stage-count').all_text_contents())) == [3,2,1,1]
    assert page.locator('[data-overview-order]').all()[0].get_attribute('data-overview-order') == 'order-0'
    assert [r.get_attribute('data-overview-order') for r in page.locator('.order-stage-group.stage-processing [data-overview-order]').all()] == ['order-3','order-8']
    expect(page.locator('[data-overview-order="order-0"]')).to_have_class('overview-order severity-urgent')
    expect(page.locator('[data-overview-order="order-1"]')).to_have_class('overview-order severity-warning')
    expect(page.locator('[data-overview-order="order-2"]')).to_have_class('overview-order severity-normal')
    expect(page.locator('[data-overview-order="order-3"] [data-order-elapsed]')).to_have_text('15 דקות')
    expect(page.locator('[data-overview-order="order-8"] [data-order-elapsed]')).to_have_text('מועד תחילת השלב אינו מתועד')
    assert page.locator('#order-overview-slot script').count() == 0
    page.clock.fast_forward(60000)
    expect(page.locator('[data-overview-order="order-2"]')).to_have_class('overview-order severity-warning')
    page.clock.fast_forward(15*60000)
    expect(page.locator('[data-overview-order="order-1"]')).to_have_class('overview-order severity-urgent')
    print('PASS: empty state, priority placement, four stages, oldest-first, exact thresholds, stage timing, unknown historical timing, escaped customer data and ticking clocks', flush=True)

    # An order opens directly; saving the same stage keeps its timestamp.
    page.locator('[data-open-overview-order="order-3"]').click()
    expect(page.locator('#editor-title')).to_have_text('הזמנה #2003')
    before = page.evaluate('snapirLocalPreview.read().orders.find(o=>o.id==="order-3").status_entered_at')
    page.locator('#save-editor').click()
    page.locator('#editor-dialog').wait_for(state='hidden')
    assert page.evaluate('snapirLocalPreview.read().orders.find(o=>o.id==="order-3").status_entered_at') == before
    page.locator('.overview-next-order[data-open-overview-order="order-0"]').click()
    page.locator('select[name=status]').select_option('processing')
    page.locator('#save-editor').click()
    page.locator('#editor-dialog').wait_for(state='hidden')
    expect(page.locator('.order-stage-group.stage-processing [data-overview-order="order-0"]')).to_be_visible()
    expect(page.locator('[data-overview-order="order-0"] [data-order-elapsed]')).to_have_text('פחות מדקה')

    # Fresh orders arrive without reloading. An open editor is not overwritten.
    page.evaluate('''() => {
      const s=snapirLocalPreview.read();
      s.orders.push({...s.orders[0],id:'incoming',number:3000,status:'new',created_at:new Date().toISOString()});
      snapirLocalPreview.save(s,s.version);
    }''')
    page.clock.fast_forward(16000)
    expect(page.locator('[data-overview-order="incoming"]')).to_be_visible()
    page.locator('[data-open-overview-order="incoming"]').click()
    page.locator('input[name=courier]').fill('עריכה שטרם נשמרה')
    page.clock.fast_forward(16000)
    expect(page.locator('input[name=courier]')).to_have_value('עריכה שטרם נשמרה')
    page.locator('#editor-dialog [data-close]').first.click()
    page.locator('#editor-dialog').wait_for(state='hidden')
    page.locator('[data-order-group=shipped]').click()
    expect(page.locator('#overview-heading-shipped')).to_be_focused()
    print('PASS: direct order actions, unchanged-stage timestamp preservation, status transition/reset, automatic incoming orders and editor protection', flush=True)

    page.evaluate('document.activeElement.blur()')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#order-overview-slot').scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=os.path.join(os.environ.get('TEMP','/tmp'),'snapir-admin-dashboard-mobile.png'), full_page=True)
    page.set_viewport_size({'width':1440,'height':1100})
    page.locator('#order-overview-slot').scroll_into_view_if_needed()
    page.screenshot(path=os.path.join(os.environ.get('TEMP','/tmp'),'snapir-admin-dashboard-desktop.png'))
    for role in ['content','shop','orders']:
        page.evaluate('''(role)=>{const s=snapirLocalPreview.read();s.team[0].role=role;snapirLocalPreview.save(s,s.version)}''',role)
        page.reload(wait_until='networkidle')
        page.locator('#admin-app').wait_for()
        assert page.locator('#order-overview-slot').count() == (1 if role=='orders' else 0)
    assert not live, live
    assert not errors, errors
    print('PASS: responsive layout, keyboard navigation, admin/orders role access only; no live API calls or browser exceptions', flush=True)
    context.close()

    # Exercise the authenticated SDK path with mocked HTTP, including failure/recovery.
    seed = json.loads((Path(__file__).resolve().parent.parent/'public/admin-seed.json').read_text(encoding='utf8'))
    auth_context = browser.new_context(viewport={'width':1440,'height':1100})
    uid = str(uuid.uuid4())
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    token = encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':uid,'exp':int(time.time())+3600,'role':'authenticated','aud':'authenticated'})+'.test-signature'
    user = {'id':uid,'aud':'authenticated','role':'authenticated','email':'test@example.invalid'}
    session = {'access_token':token,'refresh_token':'test-refresh','expires_at':int(time.time())+3600,'expires_in':3600,'token_type':'bearer','user':user}
    auth_context.add_init_script('localStorage.setItem("sb-nhiibjhssbmsqajrslvr-auth-token",'+json.dumps(json.dumps(session))+')')
    failed = False
    order_reads = []
    remote_orders = [{'id':'remote-order','number':4000,'customer_id':'remote-customer','status':'new','created_at':datetime.now(timezone.utc).isoformat(),'total_cents':1000,'items':[]}]
    def api(route):
        url = route.request.url
        if '/rpc/svk_catalog' in url:
            route.fulfill(json=[{**d,'available_kg':20} for d in seed]);return
        assert route.request.headers.get('authorization') == 'Bearer '+token
        if '/svk_staff?' in url:
            route.fulfill(json={'user_id':uid,'display_name':'Test manager','role':'orders','active':True})
        elif '/svk_orders?' in url:
            order_reads.append(url)
            if failed: route.fulfill(status=400,json={'message':'Test network failure','code':'TEST'})
            else: route.fulfill(json=remote_orders)
        elif '/svk_customers?' in url:
            route.fulfill(json=[{'id':'remote-customer','name':'לקוח בדיקה'}])
        elif '/svk_drafts?' in url or '/svk_published?' in url: route.fulfill(json=seed)
        else: route.fulfill(json=[])
    auth_context.route('**/rest/v1/**',api)
    auth_context.route('**/auth/v1/**',lambda route:route.fulfill(json=user))
    remote = auth_context.new_page()
    remote.on('pageerror',lambda e:errors.append(str(e)))
    remote.clock.install()
    remote.goto(base+'/admin',wait_until='networkidle')
    expect(remote.locator('[data-overview-order="remote-order"]')).to_be_visible()
    failed = True
    remote.clock.fast_forward(16000)
    expect(remote.locator('[data-order-refresh]')).to_have_class('order-refresh-status is-stale')
    expect(remote.locator('[data-overview-order="remote-order"]')).to_be_visible()
    failed = False
    remote_orders.append({**remote_orders[0],'id':'remote-incoming','number':4001})
    remote.clock.fast_forward(16000)
    expect(remote.locator('[data-overview-order="remote-incoming"]')).to_be_visible()
    expect(remote.locator('[data-order-refresh]')).to_have_class('order-refresh-status')
    remote.locator('.admin-brand').click()
    remote.wait_for_url(base+'/')
    reads_after_unmount = len(order_reads)
    remote.clock.fast_forward(31000)
    assert len(order_reads)==reads_after_unmount
    assert not errors, errors
    print('PASS: authenticated polling retains orders on failure, reports stale data, recovers automatically and stops on admin unmount; all APIs mocked', flush=True)
    auth_context.close()
    browser.close()
