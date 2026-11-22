"""NagishLi integration checks; these do not certify WCAG/Israeli-standard conformance."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
import json
import socket
import subprocess
import sys
import time
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
assert hashlib.sha256((root/'vendor/nagishli/nagishli.js').read_bytes()).hexdigest().upper()=='D01A65146509B88E3D7ECA9501B75D8572BB3FDD5BDE6C9BB909D0B3BCA2858A'
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    port=sock.getsockname()[1]
base=f'http://127.0.0.1:{port}/'
server=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(root)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            urlopen(base,timeout=1).close()
            break
        except OSError:time.sleep(.1)
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[];failures=[]
        page.on('pageerror',lambda e:errors.append(page.url+' '+e.stack))
        page.on('response',lambda r:failures.append(r.url) if '/vendor/' in r.url and r.status>=400 else None)
        page.route('**/rest/v1/rpc/svk_catalog',lambda route:route.fulfill(json=[]))
        assert hashlib.sha256((root/'vendor/nagishli-v3/nagishli_v3_beta/nagishli_beta.js').read_bytes()).hexdigest().upper()=='5F88B81FDB3B55ED562458F7C99DE7A081241DAA76F8FECA9ABFD7CD8ECD885B'
        pages=['index.html','sea.html','pool.html','frozen.html','smoked.html','deli.html','page.html','accessibility.html','admin.html','checkout.html']
        for name in pages:
            page.goto(base+name,wait_until='networkidle')
            assert page.locator('#NagishLiTrigger [role=button]').count()==1,name
            assert page.locator('#NagishLiWidget').get_attribute('inert') is not None,name
        page.goto(base,wait_until='networkidle')
        measure=lambda selector:page.locator(selector).first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
        original=[measure('.hero h1'),measure('.hero p'),measure('.site-footer p'),measure('.service svg')]
        launcher=page.locator('#NagishLiTrigger [role=button]')
        launcher.focus();page.keyboard.press('Enter');page.wait_for_timeout(150)
        assert launcher.get_attribute('aria-expanded')=='true'
        page.locator('#NagishLiText').click()
        page.locator('[data-nagishli-type=text-size][data-nagishli-value=bigger]').click();page.wait_for_timeout(100)
        enlarged=[measure('.hero h1'),measure('.hero p'),measure('.site-footer p'),measure('.service svg')]
        assert all(new>old for new,old in zip(enlarged,original)),(original,enlarged)
        assert abs(enlarged[0]/enlarged[1]-original[0]/original[1])<.01
        page.locator('#NagishLiHighlight').click()
        page.locator('[data-nagishli-type=highlight][data-nagishli-value=links]').click()
        settings=page.evaluate('JSON.parse(localStorage.getItem("Localize-NagishLi-A11y-Plugin-Settings-v3-Beta"))')
        assert settings['highlight']=='links'
        page.keyboard.press('Escape');page.wait_for_timeout(150)
        assert launcher.get_attribute('aria-expanded')=='false'
        launcher.focus();page.keyboard.press('Space');page.wait_for_timeout(100)
        assert launcher.get_attribute('aria-expanded')=='true'
        page.keyboard.press('Escape')
        page.goto(base+'sea.html',wait_until='networkidle')
        settings=page.evaluate('JSON.parse(localStorage.getItem("Localize-NagishLi-A11y-Plugin-Settings-v3-Beta"))')
        assert settings['text-size']==17
        page.locator('.cart-btn').click();page.keyboard.press('Escape');page.locator('#cart-dialog').wait_for(state='hidden')
        page.locator('#NagishLiTrigger').click();page.wait_for_timeout(100)
        page.locator('.nagishli-accessibility-statement').click();page.wait_for_url(base+'accessibility.html')
        page.wait_for_load_state('networkidle');assert page.get_by_text('Erez Yaakovi',exact=True).count()==1
        if page.locator('#NagishLiTrigger [role=button]').get_attribute('aria-expanded')!='true':page.locator('#NagishLiTrigger').click()
        page.on('dialog',lambda d:d.accept())
        page.locator('.nagishli-reset-settings').click();page.wait_for_timeout(150)
        page.reload(wait_until='networkidle')
        settings=page.evaluate('JSON.parse(localStorage.getItem("Localize-NagishLi-A11y-Plugin-Settings-v3-Beta"))')
        assert not settings or settings.get('text-size',16) in (16,'medium'),settings
        page.set_viewport_size({'width':390,'height':844});page.goto(base,wait_until='networkidle')
        launcher=page.locator('#NagishLiTrigger [role=button]')
        if launcher.get_attribute('aria-expanded')!='true':launcher.click()
        page.wait_for_timeout(150)
        box=page.locator('#NagishLiWidget').bounding_box();assert box['width']<=390 and box['x']>=0 and box['y']>=0,box
        assert page.locator('#NagishLiCloseBtn').is_visible()
        if not page.locator('[data-nagishli-type=text-size][data-nagishli-value=bigger]').is_visible():page.locator('#NagishLiText').click()
        page.locator('[data-nagishli-type=text-size][data-nagishli-value=bigger]').wait_for(state='visible')
        old=measure('.hero h1');page.locator('[data-nagishli-type=text-size][data-nagishli-value=bigger]').click();page.wait_for_timeout(100)
        assert measure('.hero h1')>old
        page.screenshot(path=str(Path(__import__('os').environ['TEMP'])/'snapir-accessibility-mobile-verified.png'))
        assert not errors,errors
        assert not failures,failures
        print('PASS: unchanged v2/v3 vendor checksums; ten pages; keyboard Enter/Space/Escape; proportional text and SVG sizing; highlighting; persistence; statement; reset; cart; mobile bounds; local assets')
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
