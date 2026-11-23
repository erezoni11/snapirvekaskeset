"""Local catalog acceptance: source facts, mixed units, surcharges, stock, admin and import preservation.
All writes use isolated browser storage. Live Supabase requests are blocked.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
base=os.environ.get('SNAPIR_BASE_URL','http://localhost:3000').rstrip('/')
seed=json.loads((root/'public/admin-seed.json').read_text(encoding='utf8'))
products=[d for d in seed if d['kind']=='products'];by_source={d['data']['source_id']:d for d in products}
facts=json.loads((root/'catalog/zano-2026-11-22.json').read_text(encoding='utf8'))
assert len(products)==len(facts['products'])==115
assert len({d['id'] for d in products})==115
assert sum(d['data']['sale_unit']=='unit' for d in products)==38
for fact in facts['products']:
 d=by_source[fact['source_id']]['data']
 for key in ['price_cents','sale_unit','category','weights','cuts','cut_surcharges','weight_surcharges']:assert d[key]==fact[key],(d['title'],key)
 assert (root/'public'/d['image'].lstrip('/')).is_file(),d['image']
 assert d['featured'] and d['active']
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True);ctx=browser.new_context(viewport={'width':1440,'height':1000});errors=[];live=[]
 ctx.route('**/rest/v1/**',lambda r:(live.append(r.request.url),r.abort()))
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/?local-orders=1',wait_until='networkidle')
 assert page.locator('.product').count()==115
 state=page.evaluate('snapirLocalPreview.read()');assert all(s['quantity_kg']==20 for s in state['inventory'])
 page.locator('.product-category-filters button').filter(has_text='נאים').click();assert page.locator('.product').count()==7
 page.locator('.product-category-filters button').filter(has_text='כל המוצרים').click()
 for i in [45660,45661,44122]:assert page.locator(f'[data-product-id="{by_source[i]["id"]}"] .add-cart').is_disabled()
 def card(i):return page.locator(f'[data-product-id="{by_source[i]["id"]}"]')
 denis=card(15504);denis.locator('.options select').nth(0).select_option('0.8');denis.locator('.options select').nth(1).select_option('חיתוך לסביצה')
 denis.locator('.plus').click();denis.locator('summary').click();denis.locator('.product-notes input').fill('לארוז בזוגות');denis.locator('.add-cart').click();page.locator('.drawer-close').click();page.locator('#cart-dialog').wait_for(state='hidden')
 jar=card(46440);assert jar.locator('.options select').count()==0;assert 'ליחידה' in jar.locator('.price').inner_text();jar.locator('.plus').click();jar.locator('.add-cart').click();page.locator('.drawer-close').click();page.locator('#cart-dialog').wait_for(state='hidden')
 card(45751).locator('.add-cart').click();page.locator('.checkout-link').click();page.locator('#cart-dialog').wait_for(state='hidden')
 cart=page.evaluate('JSON.parse(localStorage.getItem("snapir-cart-local-v1"))');assert sum(i['unitPrice']*i['amount'] for i in cart)==32370,cart
 page.locator('[name=customer_name]').fill('בדיקת קטלוג');page.locator('[name=phone]').fill('0501234567');page.locator('#checkout-next').click();page.locator('.shipping-choice').filter(has_text='איסוף עצמי').click();page.locator('#checkout-next').click();page.locator('[name=confirmed]').check();page.locator('#checkout-submit').click();page.locator('#checkout-success').wait_for()
 state=page.evaluate('snapirLocalPreview.read()');order=state['orders'][0];assert order['total_cents']==32370
 lines={i['product_id']:i for i in order['items']};assert lines[by_source[46440]['id']]['sale_unit']=='unit';assert lines[by_source[46440]['id']]['quantity_kg']==2
 assert lines[by_source[15504]['id']]['packing']=='לארוז בזוגות';assert lines[by_source[15504]['id']]['price_cents']==15000
 stock={i['product_id']:i['quantity_kg'] for i in state['inventory']};assert stock[by_source[46440]['id']]==18;assert stock[by_source[15504]['id']]==18.4;assert stock[by_source[45751]['id']]==19.77
 # Tampering with quantities or quoted prices must never change inventory or create an order.
 invalid=page.evaluate('''async ids=>{const state=snapirLocalPreview.read(),shipment=state.published.find(d=>d.kind==='shipping');return await snapirLocalPreview.client.rpc('svk_checkout',{p_request:crypto.randomUUID(),p_customer:{name:'בדיקה',phone:'0501234567'},p_shipping:shipment.id,p_address:{city:'תל אביב',street:'ים',house:'1'},p_items:[{product_id:ids[0],weight_kg:1,cut:'ללא שינוי',amount:21}],p_expected_total:0})}''',[by_source[46440]['id']]);assert invalid['error'];assert page.evaluate('snapirLocalPreview.read().orders.length')==1
 admin=ctx.new_page();admin.goto(base+'/admin?local-orders=1#orders',wait_until='networkidle');admin.locator('[data-order]').first.click();assert 'יח׳' in admin.locator('.order-summary').inner_text();assert 'לארוז בזוגות' in admin.locator('.order-summary').inner_text();admin.locator('[name=status]').select_option('cancelled');admin.locator('#save-editor').click();admin.locator('#confirm-accept').click();admin.locator('#editor-dialog').wait_for(state='hidden');assert all(i['quantity_kg']==20 for i in admin.evaluate('snapirLocalPreview.read().inventory'))
 # Metadata and surcharges survive ordinary form edits.
 admin.locator('[data-section=products]').click();admin.locator('#table-search').fill('דניס');admin.locator(f'[data-edit="{by_source[15504]["id"]}"]').click();admin.locator('textarea[name=description]').fill('תיאור מעודכן לבדיקה');admin.locator('#save-editor').click();admin.locator('#editor-dialog').wait_for(state='hidden');saved=admin.evaluate('(id)=>snapirLocalPreview.read().documents.find(d=>d.id===id).data',by_source[15504]['id']);assert saved['cut_surcharges']['חיתוך לסביצה']==5000;assert saved['source_id']==15504;assert saved['allowed_combinations']
 # Manual admin orders use the same unit and option prices.
 admin.locator('[data-section=orders]').click();admin.get_by_role('button',name='הזמנה ידנית חדשה',exact=True).click()
 customer_id=admin.evaluate('snapirLocalPreview.read().customers[0].id');pickup=next(d['id'] for d in seed if d['kind']=='shipping' and d['slug']=='pickup')
 admin.locator('select[name=customer]').select_option(customer_id);admin.locator('select[name=shipping]').select_option(pickup)
 admin.locator('.order-line select[name=product]').select_option(by_source[46440]['id']);admin.locator('.order-line input[name=quantity]').fill('2');admin.locator('#save-editor').click();admin.locator('#editor-dialog').wait_for(state='hidden')
 manual=admin.evaluate('snapirLocalPreview.read().orders[0]');assert manual['source']=='admin';assert manual['total_cents']==4000;assert manual['items'][0]['sale_unit']=='unit';assert manual['items'][0]['quantity_kg']==2
 # Import replaces only catalog rows, backs up previous state, preserves historical orders/settings, and runs once.
 migration=browser.new_context();migration.route('**/rest/v1/**',lambda r:(live.append(r.request.url),r.abort()))
 previous={'version':7,'documents':[d for d in seed if d['kind'] not in ['products','categories']],'published':[d for d in seed if d['kind'] not in ['products','categories']],'inventory':[],'customers':[],'orders':[{'id':'historical','number':900,'items':[]}],'team':[],'audit':[]}
 mp=migration.new_page();mp.goto(base+'/?local-orders=1',wait_until='networkidle');mp.evaluate('(s)=>localStorage.setItem("snapir-local-store-v1",JSON.stringify(s))',previous);mp.reload(wait_until='networkidle');ms=mp.evaluate('snapirLocalPreview.read()');assert ms['orders'][0]['id']=='historical';assert len(ms['inventory'])==115;assert mp.evaluate('!!localStorage.getItem("snapir-local-store-v1-before-zano-2026-11-22-v2")')
 mp.evaluate('()=>{const s=snapirLocalPreview.read();s.inventory[0].quantity_kg=13;snapirLocalPreview.save(s,s.version)}');mp.reload(wait_until='networkidle');assert mp.evaluate('snapirLocalPreview.read().inventory[0].quantity_kg')==13
 assert not errors,errors
 assert not live,live
 browser.close()
print('PASS: 115 source products, six categories, 77 kg / 38 unit products, mixed checkout, exact cut/size prices, packing notes, stock deduction/cancellation, admin editing and preserving local import; no live database requests')
