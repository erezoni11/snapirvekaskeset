-- Storefront checkout release, explicitly approved for production on 2026-11-22.
-- Only adds checkout infrastructure; catalog publication and stock remain unchanged.
begin;
alter table public.svk_orders add column source text not null default 'admin' check(source in ('admin','storefront'));
alter table public.svk_orders add column fulfillment text not null default 'delivery' check(fulfillment in ('delivery','pickup'));
alter table public.svk_orders add column checkout_fingerprint text;
create index svk_customers_phone_idx on public.svk_customers(phone);

-- This narrowly scoped guest checkout is intentionally public. It cannot read
-- customer/order tables or choose prices, statuses or arbitrary stock changes.
create function svk_private.svk_checkout(p_customer jsonb,p_items jsonb,p_shipping uuid,p_address jsonb,p_notes text,p_request uuid,p_expected_total bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  shipment public.svk_published; product public.svk_published; stock public.svk_inventory;
  entry jsonb; lines jsonb:='[]'; result public.svk_orders; customer_id uuid;
  weight numeric; amount integer; qty numeric; line_total bigint; total bigint:=0;
  customer_name text:=trim(coalesce(p_customer->>'name',''));
  customer_phone text:=coalesce(p_customer->>'phone',''); email text:=trim(coalesce(p_customer->>'email',''));
  method text; address text; fingerprint text;
begin
  if p_request is null then raise exception 'Request id required'; end if;
  fingerprint:=md5(jsonb_build_object('customer',p_customer,'items',p_items,'shipping',p_shipping,'address',p_address,'notes',p_notes,'total',p_expected_total)::text);
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
  select * into result from public.svk_orders where id=p_request;
  if found then
    if result.source<>'storefront' or result.checkout_fingerprint is distinct from fingerprint then raise exception 'Request conflict'; end if;
    return jsonb_build_object('order_id',result.id,'number',result.number,'total_cents',result.total_cents,'shipping_cents',result.shipping_cents,'shipping_name',result.shipping_name,'status',result.status,'fulfillment',result.fulfillment);
  end if;
  if length(customer_name) not between 2 and 100 or customer_phone !~ '^0[0-9]{8,9}$' or length(email)>254 or (email<>'' and email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid customer'; end if;
  if length(coalesce(p_notes,''))>1000 then raise exception 'Notes too long'; end if;
  -- Serialize this inexpensive per-phone limit across simultaneous requests.
  perform pg_advisory_xact_lock(hashtextextended('checkout-phone:'||customer_phone,0));
  if (select count(*) from public.svk_orders o join public.svk_customers c on c.id=o.customer_id where c.phone=customer_phone and o.source='storefront' and o.created_at>now()-interval '15 minutes')>=5 then raise exception 'Too many requests'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid order items'; end if;
  select * into shipment from public.svk_published where id=p_shipping and kind='shipping' and coalesce((data->>'active')::boolean,true) for share;
  if not found then raise exception 'Select a published delivery method'; end if;
  method:=coalesce(shipment.data->>'method',case when shipment.slug='pickup' then 'pickup' else 'delivery' end);
  if method not in ('pickup','delivery') or coalesce((shipment.data->>'price_cents')::integer,-1)<0 then raise exception 'Invalid delivery method'; end if;
  if method='delivery' then
    if length(trim(coalesce(p_address->>'city',''))) not between 1 and 100 or length(trim(coalesce(p_address->>'street',''))) not between 1 and 150 or length(trim(coalesce(p_address->>'house',''))) not between 1 and 20 or length(coalesce(p_address->>'apartment',''))>20 then raise exception 'Delivery address required'; end if;
    address:=concat_ws(', ',trim(p_address->>'city'),trim(p_address->>'street'),trim(p_address->>'house'),nullif(trim(p_address->>'apartment'),''));
  else address:=coalesce(shipment.data->>'region',''); end if;
  total:=(shipment.data->>'price_cents')::integer;
  -- Identical lock order across all carts prevents product-lock deadlocks.
  for entry in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    weight:=(entry->>'weight_kg')::numeric;
    if jsonb_typeof(entry->'amount') is distinct from 'number' or (entry->>'amount')::numeric<>trunc((entry->>'amount')::numeric) then raise exception 'Invalid quantity'; end if;
    amount:=(entry->>'amount')::integer;
    if weight is null or weight<=0 or weight>100 or weight<>round(weight,3) or amount is null or amount not between 1 and 99 then raise exception 'Invalid quantity'; end if;
    qty:=weight*amount;
    select * into product from public.svk_published where id=(entry->>'product_id')::uuid and kind='products' and coalesce((data->>'active')::boolean,true) for share;
    if not found or not exists(select 1 from public.svk_published c where c.kind='categories' and c.slug=product.data->>'category' and coalesce((c.data->>'active')::boolean,true)) then raise exception 'Product unavailable'; end if;
    if not exists(select 1 from jsonb_array_elements(product.data->'weights') v where v::numeric=weight) then raise exception 'Invalid quantity'; end if;
    if not coalesce(product.data->'cuts' ? (entry->>'cut'),false) then raise exception 'Invalid cut'; end if;
    select * into stock from public.svk_inventory where product_id=product.id for update;
    if not found or stock.quantity_kg<qty then raise exception 'Insufficient stock: %',product.data->>'title'; end if;
    line_total:=round((product.data->>'price_cents')::numeric*qty);total:=total+line_total;
    lines:=lines||jsonb_build_array(jsonb_build_object('product_id',product.id,'name',product.data->>'title','quantity_kg',qty,'cut',entry->>'cut','price_cents',(product.data->>'price_cents')::integer,'total_cents',line_total));
    update public.svk_inventory set quantity_kg=quantity_kg-qty,version=version+1,updated_at=now() where product_id=product.id;
  end loop;
  if total is distinct from p_expected_total then raise exception 'Price changed'; end if;
  insert into public.svk_customers(name,phone,email,address) values(customer_name,customer_phone,email,address) returning id into customer_id;
  insert into public.svk_orders(id,customer_id,items,total_cents,shipping_cents,shipping_name,address,notes,source,fulfillment,checkout_fingerprint)
  values(p_request,customer_id,lines,total,(shipment.data->>'price_cents')::integer,shipment.data->>'title',address,coalesce(p_notes,''),'storefront',method,fingerprint) returning * into result;
  return jsonb_build_object('order_id',result.id,'number',result.number,'total_cents',result.total_cents,'shipping_cents',result.shipping_cents,'shipping_name',result.shipping_name,'status',result.status,'fulfillment',result.fulfillment);
end;
$$;
revoke all on function svk_private.svk_checkout(jsonb,jsonb,uuid,jsonb,text,uuid,bigint) from public,anon,authenticated;
grant execute on function svk_private.svk_checkout(jsonb,jsonb,uuid,jsonb,text,uuid,bigint) to anon,authenticated;
create function public.svk_checkout(p_customer jsonb,p_items jsonb,p_shipping uuid,p_address jsonb,p_notes text,p_request uuid,p_expected_total bigint)
returns jsonb language sql security invoker set search_path = '' as $$ select svk_private.svk_checkout(p_customer,p_items,p_shipping,p_address,p_notes,p_request,p_expected_total); $$;
revoke all on function public.svk_checkout(jsonb,jsonb,uuid,jsonb,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.svk_checkout(jsonb,jsonb,uuid,jsonb,text,uuid,bigint) to anon,authenticated;

create or replace function svk_private.svk_create_order(p_customer uuid,p_items jsonb,p_shipping uuid,p_address text,p_notes text,p_request uuid)
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
  insert into public.svk_orders(id,customer_id,items,total_cents,shipping_cents,shipping_name,address,notes,fulfillment)
  values(p_request,p_customer,lines,total+(shipment.data->>'price_cents')::integer,(shipment.data->>'price_cents')::integer,shipment.data->>'title',coalesce(p_address,''),coalesce(p_notes,''),coalesce(shipment.data->>'method',case when shipment.slug='pickup' then 'pickup' else 'delivery' end));
  return p_request;
end;
$$;

-- A pickup moves from ready directly to completed, without a fictitious shipment.
create or replace function svk_private.svk_order_status(p_id uuid,p_status text,p_courier text default null,p_tracking text default null,p_date date default null) returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.svk_orders; entry jsonb; expected text;
begin
  if coalesce(public.svk_role(),'') not in ('admin','orders') then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into current_order from public.svk_orders where id=p_id for update;
  if not found then raise exception 'Order not found'; end if;
  if current_order.status is distinct from p_status then
    expected:=case current_order.status when 'new' then 'processing' when 'processing' then 'ready' when 'ready' then case when current_order.fulfillment='pickup' then 'completed' else 'shipped' end when 'shipped' then 'completed' end;
    if p_status is distinct from expected and not(p_status='cancelled' and current_order.status not in ('completed','cancelled')) then raise exception 'Invalid status transition'; end if;
    if p_status='cancelled' then
      for entry in select value from jsonb_array_elements(current_order.items) order by value->>'product_id' loop
        update public.svk_inventory set quantity_kg=quantity_kg+(entry->>'quantity_kg')::numeric,version=version+1,updated_at=now() where product_id=(entry->>'product_id')::uuid;
      end loop;
    end if;
  end if;
  update public.svk_orders set status=p_status,courier=coalesce(p_courier,courier),tracking_code=coalesce(p_tracking,tracking_code),delivery_date=coalesce(p_date,delivery_date) where id=p_id;
end;
$$;
commit;
