"""Isolated browser checks: no requests or writes to the hosted store."""
from pathlib import Path
import os,socket,subprocess,sys,time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
base=f'http://127.0.0.1:{port}/'
server=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(root)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:urlopen(base,timeout=1).close();break
        except OSError:time.sleep(.1)
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000})
        live=[];errors=[]
        context.route('**/rest/v1/**',lambda r:(live.append(r.request.url),r.abort()))
        context.on('page',lambda page:page.on('pageerror',lambda e:errors.append(str(e))))
        page=context.new_page()
        page.goto(base+'?local-orders=1',wait_until='networkidle')
        assert page.locator('.local-preview-banner').is_visible()
        page.locator('.product[data-live=true]').first.wait_for()
        product_id=page.locator('.product').first.get_attribute('data-product-id')
        initial=page.evaluate('(id)=>snapirLocalPreview.read().inventory.find(i=>i.product_id===id).quantity_kg',product_id)
        def add_product():
            page.goto(base+'?local-orders=1',wait_until='networkidle')
            page.locator('.product .add-cart').first.click()
            page.locator('.checkout-link').click()
            page.locator('#checkout-next:not(:disabled)').wait_for()
        def details():
            page.locator('[name=customer_name]').fill('לקוח בדיקה')
            page.locator('[name=phone]').fill('0501234567')
            page.locator('#checkout-next').click()
        add_product();details()
        page.locator('.shipping-choice').filter(has_text='איסוף עצמי').click()
        assert not page.locator('#delivery-address').is_visible()
        page.locator('#checkout-next').click()
        assert page.locator('#checkout-review').is_visible()
        page.locator('[name=confirmed]').check()
        page.screenshot(path=str(Path(os.environ['TEMP'])/'snapir-checkout-review.png'),full_page=True)
        page.locator('#checkout-submit').click()
        page.locator('#checkout-success').wait_for()
        receipt=page.locator('#receipt-number').inner_text()
        assert '#1001' in receipt
        assert page.evaluate('snapirCart.get().length')==0
        assert page.evaluate('snapirLocalPreview.read().orders.length')==1
        page.reload(wait_until='networkidle');assert page.locator('#checkout-success').is_visible()
        admin=context.new_page();admin.goto(base+'admin.html?local-orders=1#orders',wait_until='networkidle')
        admin.locator('[data-order]').first.wait_for()
        assert 'לקוח בדיקה' in admin.locator('#admin-content').inner_text()
        for status in ['processing','ready','completed']:
            admin.locator('[data-order]').first.click()
            admin.locator('[name=status]').select_option(status)
            admin.locator('#save-editor').click()
            admin.locator('#editor-dialog').wait_for(state='hidden')
        assert admin.evaluate('snapirLocalPreview.read().orders[0].status')=='completed'
        add_product();details()
        page.locator('.shipping-choice').filter(has_text='משלוח בקירור').click()
        page.locator('#checkout-next').click()
        assert page.locator('[data-checkout-step="2"]').is_visible()
        for name,text in [('city','תל אביב'),('street','הים'),('house','7')]:page.locator(f'[name={name}]').fill(text)
        page.locator('#checkout-next').click();page.locator('[name=confirmed]').check()
        page.locator('#checkout-submit').click();page.locator('#checkout-success').wait_for()
        state=page.evaluate('snapirLocalPreview.read()');order=state['orders'][0]
        assert order['number']==1002 and order['fulfillment']=='delivery'
        assert order['shipping_cents']==3500 and 'תל אביב' in order['address']
        admin.reload(wait_until='networkidle');admin.locator('[data-order]').first.click()
        admin.locator('[name=status]').select_option('cancelled')
        admin.once('dialog',lambda d:d.accept());admin.locator('#save-editor').click();admin.locator('#editor-dialog').wait_for(state='hidden')
        stock=admin.evaluate('(id)=>snapirLocalPreview.read().inventory.find(i=>i.product_id===id).quantity_kg',product_id)
        assert stock==initial-.5
        assert len(admin.evaluate('snapirLocalPreview.read().orders'))==2
        # Mobile controls, empty cart, availability changes and disabled submission.
        page.set_viewport_size({'width':390,'height':850});add_product();details()
        page.locator('.shipping-choice').filter(has_text='איסוף עצמי').click();page.locator('#checkout-next').click()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(Path(os.environ['TEMP'])/'snapir-checkout-mobile.png'),full_page=True)
        page.locator('[name=confirmed]').check()
        page.evaluate('(id)=>{let s=snapirLocalPreview.read();s.inventory.find(i=>i.product_id===id).quantity_kg=0;snapirLocalPreview.save(s,s.version)}',product_id)
        page.locator('#checkout-submit').click();page.locator('#checkout-error').wait_for()
        assert len(page.evaluate('snapirLocalPreview.read().orders'))==2
        assert page.evaluate('snapirCart.get().length')==1
        # Server accepted the last stock unit but the network response was lost.
        # Reload and retry must recover that order, even when stock is now zero.
        page.evaluate('(id)=>{let s=snapirLocalPreview.read();s.inventory.find(i=>i.product_id===id).quantity_kg=.5;snapirLocalPreview.save(s,s.version)}',product_id)
        page.goto(base+'checkout.html',wait_until='networkidle');page.locator('#checkout-next:not(:disabled)').wait_for();details()
        page.locator('.shipping-choice').filter(has_text='איסוף עצמי').click();page.locator('#checkout-next').click();page.locator('[name=confirmed]').check()
        page.evaluate('''()=>{const original=snapirLocalPreview.client.rpc;let lost=false;snapirLocalPreview.client.rpc=async(...args)=>{const result=await original(...args);if(args[0]==='svk_checkout'&&!lost){lost=true;throw Error('Network response lost');}return result;};}''')
        page.locator('#checkout-submit').click();page.locator('#checkout-error').wait_for()
        assert len(page.evaluate('snapirLocalPreview.read().orders'))==3
        page.reload(wait_until='networkidle')
        page.locator('[name=confirmed]').check();page.locator('#checkout-submit').click();page.locator('#checkout-success').wait_for()
        assert len(page.evaluate('snapirLocalPreview.read().orders'))==3
        assert page.evaluate('snapirCart.get().length')==0
        assert not live,live
        assert not errors,errors
        # Deployment hosts never activate a localhost sandbox, even with its flag.
        blocked=context.new_page()
        blocked.route('https://example.test/**',lambda r:r.fulfill(content_type='text/html',body='<html><body></body></html>'))
        blocked.goto('https://example.test/?local-orders=1')
        blocked.add_script_tag(content=(root/'local-preview.js').read_text(encoding='utf8'))
        assert blocked.evaluate('!window.snapirLocalPreview')
        print('PASS: pickup and delivery checkout, confirmation/reload, shared admin approval, pickup completion, cancellation/restock, mobile, availability failure, cart retention, lost-response recovery without duplicates, no live API calls, localhost-only sandbox')
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
