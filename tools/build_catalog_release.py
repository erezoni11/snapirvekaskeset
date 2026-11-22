"""Build the reviewed one-time catalog DML from the checked-in local seed. No network calls."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
seed=json.loads((root/'public/admin-seed.json').read_text(encoding='utf8'))
records=[d for d in seed if d['kind'] in ['products','categories']]
assert len([d for d in records if d['kind']=='products'])==115
payload=json.dumps(records,ensure_ascii=False,separators=(',',':'))
assert '$catalog$' not in payload
sql='''-- One-time, explicitly approved production catalog release.
-- Preserves customers/orders/settings/shipping, existing categories and archived product rows.
begin;
set local lock_timeout = '10s';
do $release$
declare
  docs jsonb := $catalog$'''+payload+'''$catalog$::jsonb;
  item jsonb; saved public.svk_drafts; release_id text:='zano-2026-11-22-v2';
begin
  perform pg_advisory_xact_lock(hashtextextended('snapir-catalog-release',0));
  if exists(select 1 from public.svk_audit where resource='catalog_release' and resource_id=release_id) then return; end if;
  if (select count(*) from jsonb_array_elements(docs) d where d->>'kind'='products')<>115 then raise exception 'Unexpected catalog size'; end if;
  -- Categories already managed in production retain their content and identifiers.
  for item in select value from jsonb_array_elements(docs) where value->>'kind'='categories' loop
    insert into public.svk_drafts(id,kind,slug,data) values((item->>'id')::uuid,'categories',item->>'slug',case when item->>'slug'='raw' then item->'data'||'{"position":5}'::jsonb else item->'data' end) on conflict(kind,slug) do nothing;
    insert into public.svk_published(id,kind,slug,data,version)
      select id,kind,slug,data,version from public.svk_drafts where kind='categories' and slug=item->>'slug'
      on conflict(kind,slug) do nothing;
  end loop;
  update public.svk_drafts set data=data||'{"active":false,"featured":false,"catalog_archived":true}'::jsonb,version=version+1,updated_at=now()
    where kind='products' and slug not in(select d->>'slug' from jsonb_array_elements(docs) d where d->>'kind'='products');
  delete from public.svk_published where kind='products' and slug not in(select d->>'slug' from jsonb_array_elements(docs) d where d->>'kind'='products');
  for item in select value from jsonb_array_elements(docs) where value->>'kind'='products' order by value->>'id' loop
    insert into public.svk_drafts(id,kind,slug,data) values((item->>'id')::uuid,'products',item->>'slug',item->'data')
      on conflict(kind,slug) do update set data=excluded.data,version=svk_drafts.version+1,updated_at=now() returning * into saved;
    insert into public.svk_inventory(product_id,quantity_kg) values(saved.id,20)
      on conflict(product_id) do update set quantity_kg=20,version=svk_inventory.version+1,updated_at=now();
    insert into public.svk_published(id,kind,slug,data,version) values(saved.id,saved.kind,saved.slug,saved.data,saved.version)
      on conflict(id) do update set data=excluded.data,version=excluded.version,published_at=now();
    if coalesce((saved.data->>'price_confirmed')::boolean,true) then
      perform svk_private.quote_product(saved.data,jsonb_build_object('weight_kg',saved.data->'weights'->0,'amount',1,'cut',saved.data->'cuts'->0));
    end if;
  end loop;
  if (select count(*) from public.svk_published where kind='products')<>115 then raise exception 'Published catalog count mismatch'; end if;
  insert into public.svk_audit(action,resource,resource_id) values('IMPORT','catalog_release',release_id);
end;
$release$;
commit;
'''
path=root/'supabase/catalog/20261122_zano_catalog.sql';path.parent.mkdir(exist_ok=True);path.write_text(sql,encoding='utf8');print('Generated',path.name,'bytes',len(sql.encode('utf8')))
