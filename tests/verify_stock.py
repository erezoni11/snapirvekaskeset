"""Inventory gates from product card through cart; mocked public API only."""
import copy
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('SNAPIR_BASE_URL', 'http://localhost:3000').rstrip('/')
seed = json.loads((Path(__file__).resolve().parent.parent / 'public/admin-seed.json').read_text(encoding='utf8'))
docs = [{**copy.deepcopy(d), 'available_kg': 20} for d in seed]
product = next(d for d in docs if d['kind'] == 'products' and d['data']['featured'])
product['data'].update(weights=[0.1, 0.2], cuts=['שלם', 'פילה'], sale_unit='kg', price_cents=10000, price_confirmed=True)
product['data'].pop('allowed_combinations', None)
product['available_kg'] = 0.3
empty = next(d for d in docs if d['kind'] == 'products' and d['data']['featured'] and d['id'] != product['id'])
empty['available_kg'] = 0

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    errors = []
    calls = []
    fail = False

    def api(route):
        calls.append(route.request.url)
        assert route.request.url.endswith('/rpc/svk_catalog'), route.request.url
        if fail:
            route.fulfill(status=503, json={'message': 'Test unavailable'})
        else:
            route.fulfill(json=docs)

    context.route('**/rest/v1/**', api)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))

    def card():
        return page.locator(f'[data-product-id="{product["id"]}"]')

    def fresh():
        page.goto(base, wait_until='networkidle')
        page.evaluate('localStorage.removeItem("snapir-cart-v1")')
        page.reload(wait_until='networkidle')
        card().wait_for()

    fresh()
    expect(page.locator(f'[data-product-id="{empty["id"]}"] .add-cart')).to_be_disabled()
    expect(page.locator(f'[data-product-id="{empty["id"]}"] .add-cart')).to_have_text('אזל מהמלאי')

    # Stock changes after rendering: add must recheck before accepting the item.
    product['available_kg'] = 0
    card().locator('.add-cart').click()
    expect(card().locator('.add-cart')).to_have_text('אזל מהמלאי')
    assert page.evaluate('JSON.parse(localStorage.getItem("snapir-cart-v1")).length') == 0
    print('PASS: zero stock disables the card; stock depleted after load cannot be added', flush=True)

    # Different cuts share stock; 0.1 + 0.2 must fit precisely in 0.3.
    product['available_kg'] = 0.3
    fresh()
    card().locator('.add-cart').click()
    page.locator('.drawer-close').click()
    page.locator('#cart-dialog').wait_for(state='hidden')
    card().locator('select').nth(0).select_option('0.2')
    card().locator('select').nth(1).select_option('פילה')
    expect(card().locator('.add-cart')).to_be_enabled()
    card().locator('.add-cart').click()
    expect(page.locator('.cart-entry')).to_have_count(2)
    expect(page.locator('.checkout-link')).to_be_enabled()
    for button in page.locator('.cart-quantity button').all()[1::2]:
        expect(button).to_be_disabled()
    page.locator('.drawer-close').click()
    page.locator('#cart-dialog').wait_for(state='hidden')
    expect(card().locator('.add-cart')).to_be_disabled()

    # Depletion while cart is open is caught before entering personal details.
    page.locator('.cart-btn').click()
    product['available_kg'] = 0.1
    page.locator('.checkout-link').click()
    expect(page.locator('.checkout-link')).to_be_disabled()
    expect(page.locator('.cart-entry [role=alert]').first).to_be_visible()
    assert '/checkout' not in page.url
    page.locator('.cart-entry .remove-item').nth(1).click()
    expect(page.locator('.checkout-link')).to_be_enabled()
    page.locator('.checkout-link').click()
    page.wait_for_url(base + '/checkout')
    expect(page.locator('.checkout-page .storefront-status')).to_have_count(0)
    print('PASS: shared stock, fractional weights, cart limits and fresh pre-checkout validation', flush=True)

    # A persisted product removed by a catalog replacement is identified in the cart.
    page.goto(base, wait_until='networkidle')
    page.evaluate('''() => {
        const cart = JSON.parse(localStorage.getItem('snapir-cart-v1'));
        cart[0].productId = 'removed-product';
        localStorage.setItem('snapir-cart-v1', JSON.stringify(cart));
    }''')
    page.reload(wait_until='networkidle')
    page.locator('.cart-btn').click()
    expect(page.locator('.cart-entry [role=alert]')).to_be_visible()
    expect(page.locator('.checkout-link')).to_be_disabled()
    page.locator('.remove-item').click()
    expect(page.locator('.cart-empty')).to_be_visible()
    print('PASS: obsolete saved products are explained and blocked in cart', flush=True)

    # Sale by unit consumes whole units, independent of the displayed weight.
    product['data'].update(sale_unit='unit', weights=[1], cuts=['שלם'])
    product['available_kg'] = 1
    fresh()
    card().locator('.add-cart').click()
    expect(page.locator('.cart-entry')).to_have_count(1)
    expect(page.locator('.cart-quantity button').nth(1)).to_be_disabled()
    page.locator('.drawer-close').click()
    page.locator('#cart-dialog').wait_for(state='hidden')
    expect(card().locator('.add-cart')).to_be_disabled()
    print('PASS: unit products cannot exceed their unit stock', flush=True)

    # Network failure must never insert an unchecked product.
    product['available_kg'] = 1
    fresh()
    fail = True
    card().locator('.add-cart').click()
    expect(page.locator('.storefront-status')).to_be_visible()
    assert page.evaluate('JSON.parse(localStorage.getItem("snapir-cart-v1")).length') == 0
    assert not errors, errors
    assert calls
    context.close()
    browser.close()
    print('PASS: failed inventory checks block additions; no live API calls or browser exceptions', flush=True)
