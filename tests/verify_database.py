"""Isolated PostgreSQL checks. Never connects to the live Supabase project."""
from pathlib import Path
import json,socket,subprocess,sys,time,uuid
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
server=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(ROOT/'public')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:urlopen(BASE,timeout=1).close();break
        except OSError:time.sleep(.1)
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        # Real PostgreSQL with minimal equivalents of the Supabase auth/storage schemas.
        engine = browser.new_page()
        engine.goto(BASE)
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
            if migration.name.endswith('_order_stage_timing.sql'):
                legacy_customer=query("insert into public.svk_customers(name,phone) values('Legacy timing test','000') returning id")[0]['id']
                query("insert into public.svk_orders(customer_id,items,total_cents,shipping_cents,shipping_name,address,status,created_at) values($1,'[]',0,0,'Pickup','','new',now()-interval '2 hours'),($1,'[]',0,0,'Pickup','','processing',now()-interval '3 hours')",[legacy_customer])
            execute(migration.read_text(encoding='utf-8'))
            if migration.name.endswith('_order_stage_timing.sql'):
                legacy=query('select status,created_at,status_entered_at from public.svk_orders where customer_id=$1 order by status',[legacy_customer])
                assert legacy[0]['status']=='new' and legacy[0]['status_entered_at']==legacy[0]['created_at']
                assert legacy[1]['status']=='processing' and legacy[1]['status_entered_at'] is None
                query('delete from public.svk_orders where customer_id=$1',[legacy_customer])
                query('delete from public.svk_customers where id=$1',[legacy_customer])
                print('PASS: order timing migration backfills only known new-order times; historical stage times stay unknown')
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
        timing=query('select created_at,status_entered_at from public.svk_orders where id=$1',[order_id])[0]
        assert timing['status_entered_at']==timing['created_at']
        query("select public.svk_order_status($1::uuid,'new','Courier details')",[order_id])
        assert query('select status_entered_at from public.svk_orders where id=$1',[order_id])[0]['status_entered_at']==timing['status_entered_at']
        query("select public.svk_order_status($1::uuid,'processing')",[order_id])
        changed=query('select status_entered_at from public.svk_orders where id=$1',[order_id])[0]['status_entered_at']
        assert changed>timing['status_entered_at']
        query("select public.svk_order_status($1::uuid,'processing','Updated courier')",[order_id])
        assert query('select status_entered_at from public.svk_orders where id=$1',[order_id])[0]['status_entered_at']==changed
        denied("update public.svk_orders set status_entered_at=now() where id=$1",[order_id])
        print('PASS: server-owned order stage timestamps advance on transition, survive retries/detail edits and cannot be written directly by staff')
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
        # Guest checkout migration was applied above, only to this isolated instance.
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

        # Production pricing parity across every purchasable imported weight/cut.
        from decimal import Decimal, ROUND_HALF_UP
        seed=json.loads((ROOT/'public/admin-seed.json').read_text(encoding='utf8'))
        imported=[d for d in seed if d['kind']=='products'];cases=[]
        for doc in imported:
            data=doc['data']
            if not data.get('price_confirmed',True):continue
            for weight in data['weights']:
                for cut in data['cuts']:
                    if data.get('allowed_combinations') and not any(c['weight']==weight and c['cut']==cut for c in data['allowed_combinations']):continue
                    rate=data['price_cents']+data.get('cut_surcharges',{}).get(cut,0)+data.get('weight_surcharges',{}).get(str(weight),0)
                    # Python renders 1.0 differently from JS object keys.
                    if str(weight).endswith('.0'):rate=data['price_cents']+data.get('cut_surcharges',{}).get(cut,0)+data.get('weight_surcharges',{}).get(str(int(weight)),0)
                    one=int((Decimal(rate)*(1 if data.get('sale_unit')=='unit' else Decimal(str(weight)))).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
                    cases.append({'data':data,'line':{'weight_kg':weight,'amount':2,'cut':cut},'expected':one*2})
        execute('reset role')
        comparisons=query("select c->>'expected' as expected,svk_private.quote_product(c->'data',c->'line')->>'total_cents' as actual from jsonb_array_elements($1::jsonb) c",[json.dumps(cases)])
        assert all(c['expected']==c['actual'] for c in comparisons)
        as_user('admin')
        fixtures={}
        for source_id in [46440,15504,45751]:
            data=next(d['data'] for d in imported if d['data']['source_id']==source_id).copy();data['category']='test-category'
            doc=save('products','source-'+str(source_id),data);publish(doc);fixtures[source_id]=doc
            query('select public.svk_set_stock($1::uuid,20,1)',[doc['id']])
        denied('select public.svk_set_stock($1::uuid,1.5,2)',[fixtures[46440]['id']])
        cart=[{'product_id':fixtures[46440]['id'],'weight_kg':1,'amount':2,'cut':'ללא שינוי'}, {'product_id':fixtures[15504]['id'],'weight_kg':.8,'amount':2,'cut':'חיתוך לסביצה','packing':'לארוז בזוגות'}, {'product_id':fixtures[45751]['id'],'weight_kg':.23,'amount':1,'cut':'ללא שינוי'}]
        args2=[json.dumps({'name':'Mixed units','phone':'0507654321'}),json.dumps(cart),pickup['id'],'{}','',str(uuid.uuid4()),32370]
        as_user('anon');mixed=query(guest_sql,args2)[0]['receipt'];assert mixed['total_cents']==32370
        assert query(guest_sql,args2)[0]['receipt']['order_id']==mixed['order_id']
        bad=list(args2);bad[5]=str(uuid.uuid4());bad[6]=1;denied(guest_sql,bad)
        for change in [{'weight_kg':.5},{'amount':1.5},{'amount':99}]:
            bad=list(args2);bad[5]=str(uuid.uuid4());bad[1]=json.dumps([{**cart[0],**change}]);denied(guest_sql,bad)
        denied('select svk_private.quote_product($1::jsonb,$2::jsonb)',[json.dumps(fixtures[15504]['data']),json.dumps(cart[1])])
        as_user('admin')
        snapshot=query('select items from public.svk_orders where id=$1',[mixed['order_id']])[0]['items']
        assert next(l for l in snapshot if l['sale_unit']=='unit')['quantity_kg']==2
        assert next(l for l in snapshot if l['packing'])['price_cents']==15000
        assert float(query('select quantity_kg from public.svk_inventory where product_id=$1',[fixtures[46440]['id']])[0]['quantity_kg'])==18
        query("select public.svk_order_status($1::uuid,'cancelled')",[mixed['order_id']]);query("select public.svk_order_status($1::uuid,'cancelled')",[mixed['order_id']])
        assert all(float(r['quantity_kg'])==20 for r in query('select quantity_kg from public.svk_inventory where product_id=any($1::uuid[])',[[d['id'] for d in fixtures.values()]]))
        manual=[customer,json.dumps([{**cart[0],'quantity_kg':999}]),pickup['id'],'','',str(uuid.uuid4())]
        manual_id=query(order_sql,manual)[0]['svk_create_order'];manual_snapshot=query('select items,total_cents from public.svk_orders where id=$1',[manual_id])[0]
        assert manual_snapshot['total_cents']==4000 and manual_snapshot['items'][0]['quantity_kg']==2
        print(f'PASS: {len(cases)} catalog option prices match; mixed kg/unit checkout; unit validation; surcharges; packing; retries; stock; cancellation; manual server-calculated quantities')

        # The production import is transactional, preserves business/history data and is one-time.
        execute('reset role')
        before_import=query("select (select count(*) from public.svk_orders)::int as orders,(select count(*) from public.svk_customers)::int as customers,(select data from public.svk_drafts where kind='settings' and slug='main') as settings")[0]
        release=(ROOT/'supabase/catalog/20261122_zano_catalog.sql').read_text(encoding='utf8')
        execute(release)
        assert query("select count(*)::int as n from public.svk_published where kind='products'")[0]['n']==115
        assert query("select count(*)::int as n from public.svk_drafts where kind='products' and (data->>'catalog_archived')::boolean")[0]['n']==4
        after_import=query("select (select count(*) from public.svk_orders)::int as orders,(select count(*) from public.svk_customers)::int as customers,(select data from public.svk_drafts where kind='settings' and slug='main') as settings")[0]
        assert before_import==after_import
        assert query("select count(*)::int as n from public.svk_inventory i join public.svk_published p on p.id=i.product_id where p.kind='products' and i.quantity_kg=20")[0]['n']==115
        query("update public.svk_inventory set quantity_kg=19 where product_id=(select id from public.svk_published where kind='products' limit 1)")
        execute(release)
        assert query("select count(*)::int as n from public.svk_inventory i join public.svk_published p on p.id=i.product_id where p.kind='products' and i.quantity_kg=19")[0]['n']==1
        assert query("select count(*)::int as n from public.svk_audit where resource='catalog_release'")[0]['n']==1
        print('PASS: one-time production import, 115 published products, stock 20, old products archived, history/settings preserved, repeat import does not reset stock')

        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
