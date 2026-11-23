"""Browser checks for home and header search; no live API requests."""
import copy
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('SNAPIR_BASE_URL', 'http://localhost:3000').rstrip('/')
seed = json.loads((Path(__file__).resolve().parent.parent / 'public/admin-seed.json').read_text(encoding='utf8'))
docs = copy.deepcopy([d for d in seed if d['kind'] != 'products'])
fixtures = [
    ('פילה סלמון טרי', 'דג איכותי', 'sea', True),
    ('דניס שלם', 'דג ים טרי', 'sea', True),
    ('טונה מעושנת', 'Smoked Tuna', 'smoked', False),
]
for original, (title, description, category, featured) in zip((d for d in seed if d['kind'] == 'products'), fixtures):
    product = copy.deepcopy(original)
    product['data'].update(title=title, description=description, category=category, featured=featured)
    product['available_kg'] = 20
    docs.append(product)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    def api(route):
        assert route.request.url.endswith('/rpc/svk_catalog'), route.request.url
        route.fulfill(json=docs)
    context.route('**/rest/v1/**', api)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base, wait_until='networkidle')
    field = page.get_by_label('חיפוש במבחר שלנו', exact=True)
    expect(field).to_be_visible()
    expect(page.locator('.product')).to_have_count(2)
    for query, expected in [('סלמון', 1), ('סלמ', 1), ('  סלמון   לאקיים ', 1), ('דניס סלמון', 2), ('טרי', 2), ('סָלְמוֹן', 1), ('TUNA', 1), ('לאקיים', 0)]:
        field.fill(query)
        expect(page.locator('.product')).to_have_count(expected)
        expect(page.locator('.search-results-count')).to_contain_text(str(expected))
    expect(page.locator('.search-empty')).to_contain_text('לא נמצאו מוצרים')
    page.get_by_role('button', name='ניקוי החיפוש').click()
    expect(field).to_have_value('')
    expect(page.locator('.product')).to_have_count(2)
    print('PASS: single/partial words, any matching query word, descriptions, whitespace, Hebrew vowels, case, all catalog products, no results and clearing', flush=True)

    page.goto(base + '/smoked', wait_until='networkidle')
    page.get_by_role('button', name='חיפוש', exact=True).click()
    page.locator('#search-dialog input').fill('סלמון')
    page.get_by_role('button', name='הצגת תוצאות', exact=True).click()
    page.wait_for_url(base + '/#products')
    expect(page.locator('#search-dialog')).not_to_be_visible()
    expect(field).to_have_value('סלמון')
    expect(page.locator('.product')).to_have_count(1)
    expect(page.locator('.product h3')).to_have_text('פילה סלמון טרי')
    page.set_viewport_size({'width': 390, 'height': 844})
    field.fill('טונה')
    expect(page.locator('.product h3')).to_have_text('טונה מעושנת')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    print('PASS: header search navigates from another category to matching home results; mobile layout fits; no browser exceptions or live API calls', flush=True)
    context.close()
    browser.close()
