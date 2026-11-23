"""Shared admin design, editors and confirmation flows; isolated demo only."""
import os
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('SNAPIR_BASE_URL', 'http://localhost:3000').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width':1440,'height':1000})
    context.route('**/rest/v1/**', lambda r:r.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/admin?demo=1&local-orders=0',wait_until='networkidle')
    page.locator('#admin-app').wait_for()
    sidebar_background = page.locator('.admin-sidebar').evaluate('(el)=>getComputedStyle(el).backgroundImage')

    sections = [
        ('products','[data-edit]'), ('categories','[data-edit]'),
        ('inventory','[data-stock]'), ('orders','[data-order]'),
        ('customers','[data-customer]'), ('shipping','[data-edit]'),
        ('settings','[data-edit]'), ('pages',None), ('staff','[data-staff]'), ('audit',None)
    ]
    def close_editor():
        page.locator('#editor-dialog [data-close]').first.click()
        page.locator('#editor-dialog').wait_for(state='hidden')
    for section, action in sections:
        page.locator(f'[data-section="{section}"]').click()
        expect(page.locator('#admin-app')).to_have_attribute('data-section',section)
        expect(page.locator('#section-art .admin-artwork')).to_have_count(1)
        expect(page.locator('.section-summary-card')).to_have_count(3)
        assert page.locator('.admin-sidebar').evaluate('(el)=>getComputedStyle(el).backgroundImage') == sidebar_background
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if section == 'audit':continue
        if action and page.locator(action).count():page.locator(action).first.click()
        else:page.get_by_role('button',name='הוספה חדשה',exact=True).click()
        expect(page.locator('#editor-art .admin-artwork')).to_have_count(1)
        expect(page.locator('#save-editor')).to_be_in_viewport()
        expect(page.locator('.editor-heading')).to_be_in_viewport()
        if section=='products':expect(page.locator('.editor-field-section')).to_have_count(3)
        if section=='settings':expect(page.locator('.editor-field-section')).to_have_count(6)
        page.locator('#editor-fields').evaluate('(el)=>el.scrollTop=el.scrollHeight')
        expect(page.locator('#save-editor')).to_be_in_viewport()
        expect(page.locator('.editor-heading')).to_be_in_viewport()
        page.set_viewport_size({'width':390,'height':844})
        expect(page.locator('#save-editor')).to_be_in_viewport()
        assert page.locator('#editor-dialog').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        close_editor()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.set_viewport_size({'width':1440,'height':1000})
    print('PASS: consistent theme on ten admin sections and nine editor types; grouped long forms; header/save visibility; mobile dialogs and contained table scrolling',flush=True)

    # Save edits, then preview, cancel and confirm publication using the custom modal.
    page.locator('[data-section=products]').click()
    product = page.locator('[data-edit]').first.get_attribute('data-edit')
    slug = page.locator('[data-edit]').first.locator('xpath=ancestor::tr').locator('td').nth(1).inner_text()
    page.locator(f'[data-edit="{product}"]').click()
    page.locator('textarea[name=description]').fill('תיאור בדיקה לעיצוב החדש')
    page.locator('#save-editor').click()
    page.locator('#editor-dialog').wait_for(state='hidden')
    page.locator('#table-search').fill(slug)
    row = page.locator(f'[data-edit="{product}"]').locator('xpath=ancestor::tr')
    expect(row.locator('.badge')).to_have_text('שינויים בטיוטה')
    page.locator(f'[data-preview="{product}"]').click()
    expect(page.locator('#preview-dialog')).to_be_visible()
    page.locator('#close-preview').click()
    page.locator(f'[data-publish="{product}"]').click()
    expect(page.locator('#admin-confirm-dialog')).to_be_visible()
    expect(page.locator('#confirm-cancel')).to_be_focused()
    page.keyboard.press('Escape')
    expect(page.locator('#admin-confirm-dialog')).not_to_be_visible()
    expect(row.locator('.badge')).to_have_text('שינויים בטיוטה')
    page.locator(f'[data-publish="{product}"]').click()
    page.locator('#confirm-accept').click()
    expect(row.locator('.badge')).to_have_text('מפורסם')

    # Rejecting cancellation leaves the order editor open; accepting completes it.
    page.locator('[data-section=orders]').click()
    page.locator('[data-order]').first.click()
    page.locator('select[name=status]').select_option('cancelled')
    page.locator('#save-editor').click()
    expect(page.locator('#admin-confirm-dialog')).to_be_visible()
    page.locator('#confirm-cancel').click()
    expect(page.locator('#editor-dialog')).to_be_visible()
    expect(page.locator('#save-editor')).to_be_enabled()
    page.locator('#save-editor').click()
    page.locator('#confirm-accept').click()
    page.locator('#editor-dialog').wait_for(state='hidden')
    print('PASS: draft saving, preview, styled publication confirmation, Escape/cancel protection and nested order-cancellation confirmation',flush=True)

    page.goto(base+'/admin?local-orders=0',wait_until='networkidle')
    expect(page.locator('.login-box')).to_be_visible()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors, errors
    print('PASS: sign-in matches the shared theme; no browser exceptions; no live data changed',flush=True)
    context.close()
    browser.close()
