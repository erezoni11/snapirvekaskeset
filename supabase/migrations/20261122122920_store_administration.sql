-- Apply once in Supabase SQL Editor. All objects are namespaced to preserve existing tables.
begin;
create table public.svk_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin','content','shop','orders')),
  active boolean not null default true
);
create function public.svk_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.svk_staff where user_id = auth.uid() and active;
$$;
create function public.svk_can_edit(kind text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.svk_role() = 'admin' or
    (public.svk_role() = 'content' and kind in ('settings','pages')) or
    (public.svk_role() = 'shop' and kind in ('products','categories')) or
    (public.svk_role() = 'orders' and kind = 'shipping'), false);
$$;
create table public.svk_drafts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('products','categories','pages','settings','shipping')),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);
create table public.svk_published (
  id uuid primary key references public.svk_drafts(id),
  kind text not null,
  slug text not null,
  data jsonb not null,
  version integer not null,
  published_at timestamptz not null default now(),
  unique(kind, slug)
);
create table public.svk_inventory (
  product_id uuid primary key references public.svk_drafts(id),
  quantity_kg numeric(12,3) not null default 0 check (quantity_kg >= 0),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.svk_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  phone text not null,
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create table public.svk_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  customer_id uuid not null references public.svk_customers(id),
  items jsonb not null,
  total_cents bigint not null check (total_cents >= 0),
  shipping_cents integer not null check (shipping_cents >= 0),
  shipping_name text not null,
  address text not null,
  notes text not null default '',
  courier text not null default '',
  tracking_code text not null default '',
  delivery_date date,
  status text not null default 'new' check (status in ('new','processing','ready','shipped','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table public.svk_audit (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  resource text not null,
  resource_id text,
  created_at timestamptz not null default now()
);
create function public.svk_audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.svk_audit(actor,action,resource,resource_id)
  values(auth.uid(),tg_op,tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id',to_jsonb(new)->>'product_id',to_jsonb(old)->>'id'));
  return coalesce(new,old);
end;
$$;
do $$ declare t text; begin
  foreach t in array array['svk_staff','svk_drafts','svk_published','svk_inventory','svk_customers','svk_orders'] loop
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function public.svk_audit_change()',t);
  end loop;
end $$;

create function public.svk_save_document(p_id uuid, p_kind text, p_slug text, p_data jsonb, p_version integer)
returns public.svk_drafts language plpgsql security definer set search_path = '' as $$
declare result public.svk_drafts;
begin
  if not public.svk_can_edit(p_kind) then raise exception 'Forbidden' using errcode='42501'; end if;
  if length(trim(coalesce(p_data->>'title',''))) = 0 then raise exception 'Title is required'; end if;
  if p_kind = 'products' then
    if coalesce((p_data->>'price_cents')::integer,-1) < 0 then raise exception 'Invalid product price'; end if;
    if jsonb_typeof(p_data->'weights') is distinct from 'array' or jsonb_array_length(p_data->'weights') = 0
      or exists(select 1 from jsonb_array_elements_text(p_data->'weights') w where w::numeric <= 0 or w::numeric > 100) then raise exception 'Invalid product weights'; end if;
    if jsonb_typeof(p_data->'cuts') is distinct from 'array' or jsonb_array_length(p_data->'cuts') = 0 then raise exception 'Product cuts are required'; end if;
  end if;
  if p_kind = 'shipping' and coalesce((p_data->>'price_cents')::integer,-1) < 0 then raise exception 'Invalid shipping price'; end if;
  if p_id is null then
    insert into public.svk_drafts(kind,slug,data) values(p_kind,p_slug,p_data) returning * into result;
  else
    update public.svk_drafts set slug=p_slug,data=p_data,version=version+1,updated_at=now()
    where id=p_id and kind=p_kind and version=p_version returning * into result;
    if not found then raise exception 'This record changed. Reload before saving.' using errcode='40001'; end if;
  end if;
  if p_kind='products' then insert into public.svk_inventory(product_id) values(result.id) on conflict do nothing; end if;
  return result;
end;
$$;
create function public.svk_publish(p_id uuid, p_version integer, p_publish boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare doc public.svk_drafts;
begin
  select * into doc from public.svk_drafts where id=p_id for update;
  if not found or not public.svk_can_edit(doc.kind) then raise exception 'Forbidden' using errcode='42501'; end if;
  if doc.version <> p_version then raise exception 'This record changed. Reload before publishing.' using errcode='40001'; end if;
  if p_publish then
    if doc.kind='products' and not exists(select 1 from public.svk_published where kind='categories' and slug=doc.data->>'category' and coalesce((data->>'active')::boolean,true)) then raise exception 'Publish the product category first'; end if;
    insert into public.svk_published(id,kind,slug,data,version) values(doc.id,doc.kind,doc.slug,doc.data,doc.version)
    on conflict(id) do update set slug=excluded.slug,data=excluded.data,version=excluded.version,published_at=now();
  else delete from public.svk_published where id=p_id;
  end if;
end;
$$;
create function public.svk_catalog() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('available_kg',i.quantity_kg) order by coalesce((p.data->>'position')::integer,0),p.slug),'[]'::jsonb)
  from public.svk_published p left join public.svk_inventory i on i.product_id=p.id;
$$;
create function public.svk_set_stock(p_id uuid,p_quantity numeric,p_version integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.svk_role(),'') not in ('admin','shop') then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.svk_inventory set quantity_kg=p_quantity,version=version+1,updated_at=now() where product_id=p_id and version=p_version;
  if not found then raise exception 'Inventory changed. Reload before saving.' using errcode='40001'; end if;
end;
$$;
create function public.svk_create_order(p_customer uuid,p_items jsonb,p_shipping uuid,p_address text,p_notes text,p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry jsonb; product public.svk_published; inventory public.svk_inventory; shipment public.svk_published;
  total bigint := 0; line_total bigint; qty numeric; lines jsonb := '[]'; existing uuid;
begin
  if coalesce(public.svk_role(),'') not in ('admin','orders') then raise exception 'Forbidden' using errcode='42501'; end if;
  -- Client-generated UUID makes retries idempotent; all inventory changes are transactional.
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
  select id into existing from public.svk_orders where id=p_request;
  if existing is not null then return existing; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid order items'; end if;
  select * into shipment from public.svk_published where id=p_shipping and kind='shipping' and coalesce((data->>'active')::boolean,true);
  if not found then raise exception 'Select a published delivery method'; end if;
  for entry in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    qty := (entry->>'quantity_kg')::numeric;
    if qty is null or qty <= 0 or qty > 1000 or qty<>round(qty,3) then raise exception 'Invalid quantity'; end if;
    select * into product from public.svk_published where id=(entry->>'product_id')::uuid and kind='products' and coalesce((data->>'active')::boolean,true);
    if not found then raise exception 'Product unavailable'; end if;
    select * into inventory from public.svk_inventory where product_id=product.id for update;
    if not found or inventory.quantity_kg < qty then raise exception 'Insufficient stock: %',product.data->>'title'; end if;
    if not (product.data->'cuts' ? (entry->>'cut')) then raise exception 'Invalid cut'; end if;
    line_total := round((product.data->>'price_cents')::numeric * qty);
    total := total + line_total;
    lines := lines || jsonb_build_array(jsonb_build_object('product_id',product.id,'name',product.data->>'title','quantity_kg',qty,'cut',entry->>'cut','price_cents',(product.data->>'price_cents')::integer,'total_cents',line_total));
    update public.svk_inventory set quantity_kg=quantity_kg-qty,version=version+1,updated_at=now() where product_id=product.id;
  end loop;
  insert into public.svk_orders(id,customer_id,items,total_cents,shipping_cents,shipping_name,address,notes)
  values(p_request,p_customer,lines,total+(shipment.data->>'price_cents')::integer,(shipment.data->>'price_cents')::integer,shipment.data->>'title',coalesce(p_address,''),coalesce(p_notes,''));
  return p_request;
end;
$$;
create function public.svk_order_status(p_id uuid,p_status text,p_courier text default null,p_tracking text default null,p_date date default null) returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.svk_orders; entry jsonb; expected text;
begin
  if coalesce(public.svk_role(),'') not in ('admin','orders') then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into current_order from public.svk_orders where id=p_id for update;
  if not found then raise exception 'Order not found'; end if;
  if current_order.status=p_status then
    update public.svk_orders set courier=coalesce(p_courier,courier),tracking_code=coalesce(p_tracking,tracking_code),delivery_date=coalesce(p_date,delivery_date) where id=p_id;
    return;
  end if;
  expected := case current_order.status when 'new' then 'processing' when 'processing' then 'ready' when 'ready' then 'shipped' when 'shipped' then 'completed' end;
  if p_status is distinct from expected and not(p_status='cancelled' and current_order.status not in ('completed','cancelled')) then raise exception 'Invalid status transition'; end if;
  if p_status='cancelled' then
    for entry in select value from jsonb_array_elements(current_order.items) order by value->>'product_id' loop
      update public.svk_inventory set quantity_kg=quantity_kg+(entry->>'quantity_kg')::numeric,version=version+1,updated_at=now() where product_id=(entry->>'product_id')::uuid;
    end loop;
  end if;
  update public.svk_orders set status=p_status,courier=coalesce(p_courier,courier),tracking_code=coalesce(p_tracking,tracking_code),delivery_date=coalesce(p_date,delivery_date) where id=p_id;
end;
$$;
create function public.svk_assign_staff(p_user uuid,p_name text,p_role text,p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.svk_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  lock table public.svk_staff in exclusive mode;
  if exists(select 1 from public.svk_staff where user_id=p_user and role='admin' and active)
    and (p_role<>'admin' or not p_active)
    and (select count(*) from public.svk_staff where role='admin' and active)<=1 then raise exception 'The last administrator cannot be disabled'; end if;
  insert into public.svk_staff(user_id,display_name,role,active) values(p_user,p_name,p_role,p_active)
  on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active;
end;
$$;

alter table public.svk_staff enable row level security;
alter table public.svk_drafts enable row level security;
alter table public.svk_published enable row level security;
alter table public.svk_inventory enable row level security;
alter table public.svk_customers enable row level security;
alter table public.svk_orders enable row level security;
alter table public.svk_audit enable row level security;
revoke all on public.svk_staff,public.svk_drafts,public.svk_published,public.svk_inventory,public.svk_customers,public.svk_orders,public.svk_audit from anon,authenticated;
grant all on public.svk_staff,public.svk_drafts,public.svk_published,public.svk_inventory,public.svk_customers,public.svk_orders,public.svk_audit to service_role;
grant usage,select on sequence public.svk_orders_number_seq,public.svk_audit_id_seq to service_role;
grant select on public.svk_published to anon,authenticated;
grant select on public.svk_staff,public.svk_drafts,public.svk_inventory,public.svk_orders,public.svk_audit to authenticated;
grant select,insert,update on public.svk_customers to authenticated;
create policy staff_read on public.svk_staff for select to authenticated using(user_id=auth.uid() or public.svk_role()='admin');
create policy draft_read on public.svk_drafts for select to authenticated using(public.svk_can_edit(kind));
create policy public_read on public.svk_published for select to anon,authenticated using(true);
create policy inventory_read on public.svk_inventory for select to authenticated using(public.svk_role() in ('admin','shop','orders'));
create policy customer_read on public.svk_customers for select to authenticated using(public.svk_role() in ('admin','orders'));
create policy customer_insert on public.svk_customers for insert to authenticated with check(public.svk_role() in ('admin','orders'));
create policy customer_update on public.svk_customers for update to authenticated using(public.svk_role() in ('admin','orders')) with check(public.svk_role() in ('admin','orders'));
create policy order_read on public.svk_orders for select to authenticated using(public.svk_role() in ('admin','orders'));
create policy audit_read on public.svk_audit for select to authenticated using(public.svk_role()='admin');
revoke all on function public.svk_role(),public.svk_can_edit(text),public.svk_audit_change(),public.svk_save_document(uuid,text,text,jsonb,integer),public.svk_publish(uuid,integer,boolean),public.svk_catalog(),public.svk_set_stock(uuid,numeric,integer),public.svk_create_order(uuid,jsonb,uuid,text,text,uuid),public.svk_order_status(uuid,text,text,text,date),public.svk_assign_staff(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.svk_role(),public.svk_can_edit(text),public.svk_catalog() to anon,authenticated;
grant execute on function public.svk_save_document(uuid,text,text,jsonb,integer),public.svk_publish(uuid,integer,boolean),public.svk_set_stock(uuid,numeric,integer),public.svk_create_order(uuid,jsonb,uuid,text,text,uuid),public.svk_order_status(uuid,text,text,text,date),public.svk_assign_staff(uuid,text,text,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-media','site-media',true,5242880,array['image/jpeg','image/png','image/webp','image/avif']) on conflict(id) do nothing;
create policy svk_media_read on storage.objects for select to anon,authenticated using(bucket_id='site-media');
create policy svk_media_insert on storage.objects for insert to authenticated with check(bucket_id='site-media' and public.svk_role() in ('admin','content','shop'));
-- No overwrite/delete: a draft upload cannot replace an image used by the live site.

-- Privileged implementations live outside the exposed Data API schema.
-- The public RPC wrappers run with caller privileges; implementations retain
-- their explicit role checks and restricted EXECUTE grants.
create schema svk_private;
revoke all on schema svk_private from public;
grant usage on schema svk_private to anon,authenticated,service_role;
alter function public.svk_role() set schema svk_private;
create function public.svk_role() returns text language sql stable security invoker set search_path = '' as $$ select svk_private.svk_role(); $$;
revoke all on function public.svk_role() from public,anon,authenticated;
grant execute on function public.svk_role() to anon,authenticated;
alter function public.svk_can_edit(text) set schema svk_private;
create function public.svk_can_edit(kind text) returns boolean language sql stable security invoker set search_path = '' as $$ select svk_private.svk_can_edit(kind); $$;
revoke all on function public.svk_can_edit(text) from public,anon,authenticated;
grant execute on function public.svk_can_edit(text) to anon,authenticated;
alter function public.svk_catalog() set schema svk_private;
create function public.svk_catalog() returns jsonb language sql stable security invoker set search_path = '' as $$ select svk_private.svk_catalog(); $$;
revoke all on function public.svk_catalog() from public,anon,authenticated;
grant execute on function public.svk_catalog() to anon,authenticated;
alter function public.svk_save_document(uuid,text,text,jsonb,integer) set schema svk_private;
create function public.svk_save_document(p_id uuid,p_kind text,p_slug text,p_data jsonb,p_version integer) returns public.svk_drafts language sql security invoker set search_path = '' as $$ select * from svk_private.svk_save_document(p_id,p_kind,p_slug,p_data,p_version); $$;
revoke all on function public.svk_save_document(uuid,text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.svk_save_document(uuid,text,text,jsonb,integer) to authenticated;
alter function public.svk_publish(uuid,integer,boolean) set schema svk_private;
create function public.svk_publish(p_id uuid,p_version integer,p_publish boolean default true) returns void language sql security invoker set search_path = '' as $$ select svk_private.svk_publish(p_id,p_version,p_publish); $$;
revoke all on function public.svk_publish(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.svk_publish(uuid,integer,boolean) to authenticated;
alter function public.svk_set_stock(uuid,numeric,integer) set schema svk_private;
create function public.svk_set_stock(p_id uuid,p_quantity numeric,p_version integer) returns void language sql security invoker set search_path = '' as $$ select svk_private.svk_set_stock(p_id,p_quantity,p_version); $$;
revoke all on function public.svk_set_stock(uuid,numeric,integer) from public,anon,authenticated;
grant execute on function public.svk_set_stock(uuid,numeric,integer) to authenticated;
alter function public.svk_create_order(uuid,jsonb,uuid,text,text,uuid) set schema svk_private;
create function public.svk_create_order(p_customer uuid,p_items jsonb,p_shipping uuid,p_address text,p_notes text,p_request uuid) returns uuid language sql security invoker set search_path = '' as $$ select svk_private.svk_create_order(p_customer,p_items,p_shipping,p_address,p_notes,p_request); $$;
revoke all on function public.svk_create_order(uuid,jsonb,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.svk_create_order(uuid,jsonb,uuid,text,text,uuid) to authenticated;
alter function public.svk_order_status(uuid,text,text,text,date) set schema svk_private;
create function public.svk_order_status(p_id uuid,p_status text,p_courier text default null,p_tracking text default null,p_date date default null) returns void language sql security invoker set search_path = '' as $$ select svk_private.svk_order_status(p_id,p_status,p_courier,p_tracking,p_date); $$;
revoke all on function public.svk_order_status(uuid,text,text,text,date) from public,anon,authenticated;
grant execute on function public.svk_order_status(uuid,text,text,text,date) to authenticated;
alter function public.svk_assign_staff(uuid,text,text,boolean) set schema svk_private;
create function public.svk_assign_staff(p_user uuid,p_name text,p_role text,p_active boolean) returns void language sql security invoker set search_path = '' as $$ select svk_private.svk_assign_staff(p_user,p_name,p_role,p_active); $$;
revoke all on function public.svk_assign_staff(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.svk_assign_staff(uuid,text,text,boolean) to authenticated;
alter function public.svk_audit_change() set schema svk_private;
create index svk_orders_customer_idx on public.svk_orders(customer_id);
create index svk_orders_created_idx on public.svk_orders(created_at desc);
create index svk_customers_name_idx on public.svk_customers(name);
commit;
