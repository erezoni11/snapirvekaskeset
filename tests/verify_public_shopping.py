"""An existing staff session must not authenticate the public shop or checkout.
Uses the real browser SDK with mocked HTTP responses; never calls live Supabase.
"""
import base64,json,os,time,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
base=os.environ.get('SNAPIR_BASE_URL','http://localhost:3000').rstrip('/')
seed=json.loads((root/'public/admin-seed.json').read_text(encoding='utf8'))
docs=[{**d,'available_kg':20} for d in seed]
key='sb-nhiibjhssbmsqajrslvr-auth-token'
user_id=str(uuid.uuid4());expires=int(time.time())+3600
encode=lambda d:base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
token=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':user_id,'exp':expires,'role':'authenticated','aud':'authenticated'})+'.'+encode('revoked-test-signature')
user={'id':user_id,'aud':'authenticated','role':'authenticated','email':'test@example.invalid'}
session={'access_token':token,'refresh_token':'test-refresh','expires_at':expires,'expires_in':3600,'token_type':'bearer','user':user}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True);context=browser.new_context(viewport={'width':1440,'height':1000})
 context.add_init_script('localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(session))+')')
 public_calls=[];private_calls=[];orders=[];failures=[]
 def api(route):
  request=route.request;authorization=request.headers.get('authorization','')
  if '/rpc/' in request.url:
   public_calls.append(request.url.rsplit('/',1)[-1])
   if authorization=='Bearer '+token:
    failures.append('Staff token used for a public request');route.fulfill(status=401,json={'code':'PGRST301','message':'JWT invalid'});return
   assert authorization=='Bearer '+request.headers['apikey']
   if request.url.endswith('/svk_catalog'):route.fulfill(json=docs)
   elif request.url.endswith('/svk_checkout'):
    payload=request.post_data_json;assert payload['p_expected_total']==2000;orders.append(payload)
    route.fulfill(json={'order_id':payload['p_request'],'number':9999,'total_cents':2000,'shipping_cents':0,'shipping_name':'איסוף עצמי','status':'new','fulfillment':'pickup'})
   else:raise AssertionError('Unexpected public RPC')
  else:
   assert authorization=='Bearer '+token
   private_calls.append(request.url)
   if '/svk_staff?' in request.url:
    staff={'user_id':user_id,'display_name':'Test staff','role':'admin','active':True}
    route.fulfill(json=staff if 'application/vnd.pgrst.object+json' in request.headers.get('accept','') else [staff])
   else:route.fulfill(json=[])
 context.route('**/rest/v1/**',api)
 context.route('**/auth/v1/**',lambda route:route.fulfill(json=user))
 page=context.new_page();page.goto(base,wait_until='networkidle');page.wait_for_function('document.querySelectorAll(".product").length===115')
 assert page.locator('.storefront-status').count()==0
 jar=next(d for d in seed if d['kind']=='products' and d['data']['source_id']==46440)
 page.locator(f'[data-product-id="{jar["id"]}"] .add-cart').click();page.locator('.checkout-link').click();page.locator('#cart-dialog').wait_for(state='hidden')
 page.locator('[name=customer_name]').fill('בדיקת חנות ציבורית');page.locator('[name=phone]').fill('0500000000');page.locator('#checkout-next').click();page.locator('.shipping-choice').filter(has_text='איסוף עצמי').click();page.locator('#checkout-next').click();page.locator('[name=confirmed]').check();page.locator('#checkout-submit').click();page.locator('#checkout-success').wait_for()
 assert len(orders)==1 and 'svk_checkout' in public_calls
 assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).access_token',key)==token
 page.goto(base+'/admin',wait_until='networkidle');page.locator('#admin-app').wait_for(state='visible')
 assert private_calls and not failures,failures
 assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).access_token',key)==token
 browser.close()
print('PASS: stored staff token cannot block catalog or guest checkout; admin still uses its authenticated client; session is preserved; no live requests')
