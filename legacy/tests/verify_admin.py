"""Run: python tests/verify_admin.py (requires Python playwright and Chrome).

Tests run against an ephemeral PostgreSQL WASM engine and an isolated local server.
No writes are made to the live Supabase project.
"""
from pathlib import Path
import json
import base64
import socket
import subprocess
import sys
import time
import uuid
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
BASE = f'http://127.0.0.1:{port}'
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            urlopen(BASE, timeout=1).close()
            break
        except OSError:
            time.sleep(.1)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width':1440,'height':1000})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/admin.html?demo=1')
        page.locator('#admin-app').wait_for(state='visible')
        page.locator('[data-section=products]').click()
        assert page.locator('.admin-table tbody tr').count() == 20
        page.locator('[data-edit]').first.click()
        page.locator('[name=title]').fill('Draft test product')
        page.locator('[name=price]').fill('123.45')
        page.locator('#save-editor').click()
        page.locator('#editor-dialog').wait_for(state='hidden')
        edited_row = page.locator('.admin-table tbody tr').filter(has_text='Draft test product')
        edited_row.locator('[data-preview]').click()
        frame = page.frame_locator('#preview-frame')
        frame.locator('.store-preview-banner').wait_for()
        assert frame.get_by_text('Draft test product', exact=True).count() == 1
        assert frame.locator('.add-cart').first.is_disabled()
        page.locator('#close-preview').click()
        page.once('dialog', lambda d:d.accept())
        edited_row.locator('[data-publish]').click()
        page.locator('#admin-notice').filter(has_text='הדגמה').wait_for()
        page.locator('[data-section=orders]').click()
        page.locator('[data-order]').first.click()
        page.locator('[name=status]').select_option('cancelled')
        page.once('dialog', lambda d:d.accept())
        page.locator('#save-editor').click()
        page.locator('#editor-dialog').wait_for(state='hidden')
        assert page.locator('.badge.cancelled').count() == 1
        page.locator('[data-section=inventory]').click()
        assert '20' in page.locator('.admin-table tbody tr').first.inner_text()
        page.locator('[data-section=orders]').click()
        page.locator('#section-actions .admin-primary').click()
        page.locator('[name=customer]').select_option(index=1)
        page.locator('[name=shipping]').select_option(index=1)
        page.locator('[name=product]').select_option(index=1)
        page.locator('[name=quantity]').fill('2')
        page.locator('#save-editor').click()
        page.locator('#editor-dialog').wait_for(state='hidden')
        assert page.locator('.admin-table tbody tr').count() == 2
        page.set_viewport_size({'width':390,'height':844})
        page.locator('[data-section=dashboard]').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print('PASS: admin draft, preview, demo publish, cancellation, manual order and mobile layout')

        # Real installations start with drafts only; product preview still needs
        # its unpublished parent category to render the product card.
        page.locator('[data-section=categories]').click()
        page.once('dialog',lambda dialog:dialog.accept())
        page.locator('[data-unpublish]').first.click()
        page.locator('[data-section=products]').click()
        page.locator('.admin-table tbody tr').filter(has_text='Draft test product').locator('[data-preview]').click()
        frame=page.frame_locator('#preview-frame')
        frame.locator('.store-preview-banner').wait_for()
        assert frame.get_by_text('Draft test product',exact=True).count()==1
        page.locator('#close-preview').click()

        # Exercise the public storefront against the real published-document shape.
        seed = json.loads((ROOT/'admin-seed.json').read_text(encoding='utf-8'))
        snapshot = [{**d, 'available_kg':20} for d in seed]
        first_product = next(d for d in snapshot if d['kind']=='products')
        first_product['data']['title'] = '<img src=x onerror=alert(1)>'
        first_product['data']['image'] = 'https://example.com/product.jpg'
        page.route('**/rest/v1/rpc/svk_catalog', lambda route: route.fulfill(json=snapshot))
        page.goto(BASE+'/sea.html')
        page.wait_for_function("document.documentElement.dataset.catalogSource === 'supabase'")
        assert page.locator('.product').count() == 4
        assert page.locator('.product h3').first.inner_text() == '<img src=x onerror=alert(1)>'
        assert page.locator('.product h3 img').count() == 0
        page.locator('.add-cart').first.click()
        page.locator('#cart-dialog').wait_for(state='visible')
        page.reload()
        page.locator('.cart-btn').click()
        assert page.locator('.cart-entry').count() == 1
        assert not errors, errors
        print('PASS: published catalog rendering, injection-safe titles and remote-image cart persistence')
        page.unroute('**/rest/v1/rpc/svk_catalog')
        page.route('**/rest/v1/rpc/svk_catalog',lambda route:route.fulfill(json=[]))
        page.goto(BASE+'/sea.html')
        page.wait_for_function("document.documentElement.dataset.catalogSource === 'supabase'")
        assert page.locator('.product').count()==0
        assert page.locator('.search-empty').is_visible()
        page.unroute('**/rest/v1/rpc/svk_catalog')
        page.route('**/rest/v1/rpc/svk_catalog',lambda route:route.fulfill(status=503,json={'message':'Test outage'}))
        page.goto(BASE+'/sea.html')
        page.wait_for_function("document.documentElement.dataset.catalogSource === 'unavailable'")
        assert not page.locator('.product-grid').is_visible()
        assert page.locator('.storefront-status').is_visible()
        print('PASS: empty live catalog and connection errors do not show demo products as available')

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
        auth_context.route('**/rest/v1/svk_*',staff_route)
        auth_page=auth_context.new_page()
        auth_page.goto(BASE+'/admin.html')
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

        # Real PostgreSQL with minimal equivalents of the Supabase auth/storage schemas.
        engine = browser.new_page()
        engine.goto(BASE+'/admin.html')
        engine.evaluate("""async()=>{const {PGlite}=await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.17/dist/index.js');window.pg=new PGlite();await pg.waitReady;}""")
        def query(sql, params=None):
            return engine.evaluate('({sql,params})=>pg.query(sql,params)', {'sql':sql,'params':params or []})['rows']
        def execute(sql):
            return engine.evaluate('(sql)=>pg.exec(sql)', sql)
        def denied(sql, params=None):
            try:
                query(sql, params)
            except Exception:
                return
            raise AssertionError('Unauthorized or invalid operation succeeded: '+sql)
        execute("""create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
        create table auth.users(id uuid primary key);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
        create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid,bucket_id text); alter table storage.objects enable row level security;""")
        for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            execute(migration.read_text(encoding='utf-8'))
        ids = {role:str(uuid.uuid4()) for role in ['admin','content','shop','orders','outsider']}
        for role, user_id in ids.items():
            query('insert into auth.users(id) values($1)',[user_id])
            if role != 'outsider':
                query('insert into public.svk_staff(user_id,display_name,role) values($1,$2,$3)',[user_id,role,role])
        def as_user(role):
            execute('reset role')
            query("select set_config('request.jwt.claim.sub',$1,false)",[ids.get(role,'')])
            execute('set role '+('anon' if role=='anon' else 'authenticated'))
        def save(kind,slug,data,doc_id=None,version=0):
            return query('select * from public.svk_save_document($1::uuid,$2,$3,$4::jsonb,$5)',[doc_id,kind,slug,json.dumps(data),version])[0]
        def publish(doc):
            query('select public.svk_publish($1::uuid,$2,true)',[doc['id'],doc['version']])
        as_user('admin')
        category = save('categories','test-category',{'title':'Test category','active':True})
        product = save('products','test-product',{'title':'Test product','category':'test-category','price_cents':6490,'weights':[.5,1,1.5],'cuts':['whole'],'active':True})
        shipment = save('shipping','delivery-test',{'title':'Delivery','price_cents':3500,'active':True})
        save('settings','main',{'title':'Private draft title'})
        as_user('anon')
        assert query('select public.svk_catalog() as docs')[0]['docs'] == []
        denied('select * from public.svk_drafts')
        denied('select * from public.svk_customers')
        denied('select * from public.svk_orders')
        denied('select public.svk_publish($1::uuid,$2,true)',[product['id'],1])
        as_user('outsider')
        assert query('select * from public.svk_drafts') == []
        denied('select public.svk_assign_staff($1::uuid,$2,$3,true)',[ids['outsider'],'Attacker','admin'])
        as_user('content')
        save('pages','about',{'title':'About','body':'Content'})
        denied('select * from public.svk_save_document(null,$1,$2,$3::jsonb,0)',['products','forbidden',json.dumps(product['data'])])
        assert query('select * from public.svk_orders') == []
        as_user('shop')
        denied('select * from public.svk_save_document(null,$1,$2,$3::jsonb,0)',['settings','forbidden','{"title":"No"}'])
        as_user('orders')
        denied('select public.svk_set_stock($1::uuid,10,1)',[product['id']])
        as_user('admin')
        denied('select public.svk_publish($1::uuid,1,true)',[product['id']])
        publish(category);publish(product);publish(shipment)
        denied('update public.svk_published set data=\'{"title":"Bypass"}\'::jsonb')
        query('select public.svk_set_stock($1::uuid,10,1)',[product['id']])
        customer=query("insert into public.svk_customers(name,phone) values('Test customer','000') returning id")[0]['id']
        order_id=str(uuid.uuid4())
        args=[customer,json.dumps([{'product_id':product['id'],'quantity_kg':1.5,'cut':'whole'}]),shipment['id'],'Test address','',order_id]
        order_sql='select public.svk_create_order($1::uuid,$2::jsonb,$3::uuid,$4,$5,$6::uuid)'
        query(order_sql,args);query(order_sql,args)
        assert query('select count(*)::int as n from public.svk_orders')[0]['n']==1
        assert query('select total_cents::int as total from public.svk_orders')[0]['total']==13235
        def stock():
            return float(query('select quantity_kg from public.svk_inventory where product_id=$1',[product['id']])[0]['quantity_kg'])
        assert stock()==8.5
        failed_args=[customer,json.dumps([{'product_id':product['id'],'quantity_kg':1,'cut':'whole'},{'product_id':product['id'],'quantity_kg':99,'cut':'whole'}]),shipment['id'],'','',str(uuid.uuid4())]
        denied(order_sql,failed_args)
        assert stock()==8.5
        query('select public.svk_order_status($1::uuid,\'cancelled\')',[order_id])
        query('select public.svk_order_status($1::uuid,\'cancelled\')',[order_id])
        assert stock()==10
        query("select public.svk_order_status($1::uuid,'cancelled','Test courier','TRACK-123','2026-11-23'::date)",[order_id])
        assert query('select tracking_code from public.svk_orders where id=$1',[order_id])[0]['tracking_code']=='TRACK-123'
        denied('select public.svk_set_stock($1::uuid,99,1)',[product['id']])
        denied('select public.svk_assign_staff($1::uuid,$2,$3,false)',[ids['admin'],'Admin','content'])
        updated=save('products','test-product',product['data'],product['id'],1)
        assert updated['version']==2
        denied('select public.svk_publish($1::uuid,1,true)',[product['id']])
        as_user('anon')
        catalog=query('select public.svk_catalog() as docs')[0]['docs']
        assert len(catalog)==3
        assert not any(d['kind']=='settings' for d in catalog)
        assert next(d for d in catalog if d['kind']=='products')['version']==1
        print('PASS: SQL migration, role boundaries, no public private data, no privilege escalation, draft isolation, publication, optimistic concurrency, authoritative prices, atomic stock, idempotency and cancellation restocking')
        # Proposed guest checkout runs only in this isolated PostgreSQL instance.
        execute('reset role')
        execute((ROOT/'supabase/checkout-preview.sql').read_text(encoding='utf-8'))
        as_user('admin')
        pickup=save('shipping','pickup',{'title':'Pickup','method':'pickup','region':'Test shop','price_cents':0,'active':True})
        publish(pickup)
        as_user('anon')
        guest_sql='select public.svk_checkout($1::jsonb,$2::jsonb,$3::uuid,$4::jsonb,$5,$6::uuid,$7::bigint) as receipt'
        guest=[json.dumps({'name':'Guest customer','phone':'0501234567','email':''}),json.dumps([{'product_id':product['id'],'weight_kg':.5,'amount':2,'cut':'whole'}]),pickup['id'],'{}','Test note',str(uuid.uuid4()),6490]
        confirmation=query(guest_sql,guest)[0]['receipt']
        assert confirmation['total_cents']==6490 and confirmation['fulfillment']=='pickup'
        assert 'phone' not in confirmation and 'customer_id' not in confirmation
        assert query(guest_sql,guest)[0]['receipt']['number']==confirmation['number']
        denied('select * from public.svk_orders')
        denied('select * from public.svk_customers')
        wrong_price=list(guest);wrong_price[5]=str(uuid.uuid4());wrong_price[6]=1
        denied(guest_sql,wrong_price)
        invalid_cut=list(guest);invalid_cut[5]=str(uuid.uuid4());invalid_cut[1]=json.dumps([{'product_id':product['id'],'weight_kg':.5,'amount':2,'cut':None}]);denied(guest_sql,invalid_cut)
        invalid_weight=list(guest);invalid_weight[5]=str(uuid.uuid4());invalid_weight[1]=json.dumps([{'product_id':product['id'],'weight_kg':.123,'amount':2,'cut':'whole'}]);denied(guest_sql,invalid_weight)
        conflict=list(guest);conflict[4]='different order';denied(guest_sql,conflict)
        missing_address=list(guest);missing_address[2]=shipment['id'];missing_address[5]=str(uuid.uuid4());missing_address[6]=9990;denied(guest_sql,missing_address)
        as_user('admin')
        assert stock()==9
        guest_order=query('select * from public.svk_orders where id=$1',[confirmation['order_id']])[0]
        assert guest_order['source']=='storefront' and guest_order['status']=='new'
        for status in ['processing','ready','completed']:
            query('select public.svk_order_status($1::uuid,$2)',[guest_order['id'],status])
        assert query('select status from public.svk_orders where id=$1',[guest_order['id']])[0]['status']=='completed'
        as_user('anon')
        delivery=list(guest);delivery[2]=shipment['id'];delivery[3]=json.dumps({'city':'Test city','street':'Test street','house':'7'});delivery[5]=str(uuid.uuid4());delivery[6]=9990
        receipt=query(guest_sql,delivery)[0]['receipt'];assert receipt['fulfillment']=='delivery' and receipt['total_cents']==9990
        as_user('orders')
        assert stock()==8
        query("select public.svk_order_status($1::uuid,'cancelled')",[receipt['order_id']])
        query("select public.svk_order_status($1::uuid,'cancelled')",[receipt['order_id']])
        assert stock()==9
        as_user('anon')
        oversell=list(guest);oversell[5]=str(uuid.uuid4());oversell[1]=json.dumps([{'product_id':product['id'],'weight_kg':1,'amount':10,'cut':'whole'}]);oversell[6]=64900;denied(guest_sql,oversell)
        for _ in range(3):
            more=list(guest);more[5]=str(uuid.uuid4());query(guest_sql,more)
        over_limit=list(guest);over_limit[5]=str(uuid.uuid4());denied(guest_sql,over_limit)
        print('PASS: guest checkout, receipt privacy, retries, tampering, published weights/cuts, shipping/address validation, atomic stock, rate limit, admin approval, pickup completion and cancellation')

        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
