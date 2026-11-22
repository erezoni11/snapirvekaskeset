begin;
-- Sale units and option pricing. Existing kg-only clients remain compatible.
-- quantity_kg keeps its historical name; the quantity is interpreted using sale_unit.
create function svk_private.quote_product(p_data jsonb,p_entry jsonb,p_allow_legacy boolean default false)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare
  sale_unit text:=coalesce(p_data->>'sale_unit','kg');
  weight numeric; amount integer; qty numeric; unit_price numeric; selection bigint; line_total bigint;
  cut text:=p_entry->>'cut'; packing text:=coalesce(p_entry->>'packing',''); legacy boolean:=false;
begin
  if sale_unit not in ('kg','unit') or coalesce((p_data->>'price_cents')::numeric,0)<=0 or coalesce((p_data->>'price_confirmed')::boolean,true)=false then raise exception 'Product unavailable'; end if;
  if not coalesce(p_data->'cuts' ? cut,false) then raise exception 'Invalid cut'; end if;
  if (p_entry ? 'packing' and jsonb_typeof(p_entry->'packing')<>'string') or length(packing)>300 then raise exception 'Invalid packing note'; end if;
  legacy:=p_allow_legacy and not(p_entry ? 'weight_kg') and sale_unit='kg';
  if legacy then
    if coalesce(p_data->'weight_surcharges','{}'::jsonb)<>'{}'::jsonb or p_data ? 'allowed_combinations' then raise exception 'Select product weight'; end if;
    qty:=(p_entry->>'quantity_kg')::numeric;weight:=qty;amount:=1;
    if qty is null or qty<=0 or qty>1000 or qty<>round(qty,3) then raise exception 'Invalid quantity'; end if;
  else
    if jsonb_typeof(p_entry->'weight_kg') is distinct from 'number' or jsonb_typeof(p_entry->'amount') is distinct from 'number' then raise exception 'Invalid quantity'; end if;
    weight:=(p_entry->>'weight_kg')::numeric;
    if (p_entry->>'amount')::numeric<>trunc((p_entry->>'amount')::numeric) then raise exception 'Invalid quantity'; end if;
    amount:=(p_entry->>'amount')::integer;
    if weight is null or weight<=0 or weight>100 or weight<>round(weight,3) or amount is null or amount not between 1 and 99 then raise exception 'Invalid quantity'; end if;
    if not exists(select 1 from jsonb_array_elements(p_data->'weights') v where v::numeric=weight) or (sale_unit='unit' and weight<>1) then raise exception 'Invalid quantity'; end if;
    if p_data ? 'allowed_combinations' and not exists(select 1 from jsonb_array_elements(p_data->'allowed_combinations') c where (c->>'weight')::numeric=weight and c->>'cut'=cut) then raise exception 'Invalid product combination'; end if;
    qty:=case when sale_unit='unit' then amount else weight*amount end;
  end if;
  unit_price:=(p_data->>'price_cents')::numeric+coalesce((p_data->'cut_surcharges'->>cut)::numeric,0)+coalesce((select value::numeric from jsonb_each_text(coalesce(p_data->'weight_surcharges','{}'::jsonb)) where key::numeric=weight),0);
  if unit_price<0 or unit_price<>trunc(unit_price) then raise exception 'Invalid product price'; end if;
  selection:=round(unit_price*case when sale_unit='unit' then 1 else weight end);
  line_total:=selection*amount;
  return jsonb_build_object('quantity_kg',qty,'sale_unit',sale_unit,'weight_kg',weight,'amount',amount,'cut',cut,'packing',packing,'price_cents',unit_price,'selection_cents',selection,'total_cents',line_total);
end;
$$;
revoke all on function svk_private.quote_product(jsonb,jsonb,boolean) from public,anon,authenticated;

create or replace function svk_private.svk_checkout(p_customer jsonb,p_items jsonb,p_shipping uuid,p_address jsonb,p_notes text,p_request uuid,p_expected_total bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  shipment public.svk_published; product public.svk_published; stock public.svk_inventory;
  entry jsonb; lines jsonb:='[]'; result public.svk_orders; customer_id uuid;
  quote jsonb; qty numeric; line_total bigint; total bigint:=0;
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
    select * into product from public.svk_published where id=(entry->>'product_id')::uuid and kind='products' and coalesce((data->>'active')::boolean,true) for share;
    if not found or not exists(select 1 from public.svk_published c where c.kind='categories' and c.slug=product.data->>'category' and coalesce((c.data->>'active')::boolean,true)) then raise exception 'Product unavailable'; end if;
    quote:=svk_private.quote_product(product.data,entry);qty:=(quote->>'quantity_kg')::numeric;
    select * into stock from public.svk_inventory where product_id=product.id for update;
    if not found or stock.quantity_kg<qty then raise exception 'Insufficient stock: %',product.data->>'title'; end if;
    line_total:=(quote->>'total_cents')::bigint;total:=total+line_total;
    lines:=lines||jsonb_build_array(quote||jsonb_build_object('product_id',product.id,'name',product.data->>'title'));
    update public.svk_inventory set quantity_kg=quantity_kg-qty,version=version+1,updated_at=now() where product_id=product.id;
  end loop;
  if total is distinct from p_expected_total then raise exception 'Price changed'; end if;
  insert into public.svk_customers(name,phone,email,address) values(customer_name,customer_phone,email,address) returning id into customer_id;
  insert into public.svk_orders(id,customer_id,items,total_cents,shipping_cents,shipping_name,address,notes,source,fulfillment,checkout_fingerprint)
  values(p_request,customer_id,lines,total,(shipment.data->>'price_cents')::integer,shipment.data->>'title',address,coalesce(p_notes,''),'storefront',method,fingerprint) returning * into result;
  return jsonb_build_object('order_id',result.id,'number',result.number,'total_cents',result.total_cents,'shipping_cents',result.shipping_cents,'shipping_name',result.shipping_name,'status',result.status,'fulfillment',result.fulfillment);
end;
$$;
create or replace function svk_private.svk_create_order(p_customer uuid,p_items jsonb,p_shipping uuid,p_address text,p_notes text,p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry jsonb; product public.svk_published; inventory public.svk_inventory; shipment public.svk_published;
  total bigint := 0; line_total bigint; qty numeric; quote jsonb; lines jsonb := '[]'; existing uuid;
begin
  if coalesce(public.svk_role(),'') not in ('admin','orders') then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null then raise exception 'Request id required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
  select id into existing from public.svk_orders where id=p_request;
  if existing is not null then return existing; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid order items'; end if;
  select * into shipment from public.svk_published where id=p_shipping and kind='shipping' and coalesce((data->>'active')::boolean,true);
  if not found then raise exception 'Select a published delivery method'; end if;
  for entry in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    select * into product from public.svk_published where id=(entry->>'product_id')::uuid and kind='products' and coalesce((data->>'active')::boolean,true);
    if not found then raise exception 'Product unavailable'; end if;
    quote:=svk_private.quote_product(product.data,entry,true);qty:=(quote->>'quantity_kg')::numeric;
    select * into inventory from public.svk_inventory where product_id=product.id for update;
    if not found or inventory.quantity_kg < qty then raise exception 'Insufficient stock: %',product.data->>'title'; end if;
    line_total:=(quote->>'total_cents')::bigint;total:=total+line_total;
    lines:=lines||jsonb_build_array(quote||jsonb_build_object('product_id',product.id,'name',product.data->>'title'));
    update public.svk_inventory set quantity_kg=quantity_kg-qty,version=version+1,updated_at=now() where product_id=product.id;
  end loop;
  insert into public.svk_orders(id,customer_id,items,total_cents,shipping_cents,shipping_name,address,notes,fulfillment)
  values(p_request,p_customer,lines,total+(shipment.data->>'price_cents')::integer,(shipment.data->>'price_cents')::integer,shipment.data->>'title',coalesce(p_address,''),coalesce(p_notes,''),coalesce(shipment.data->>'method',case when shipment.slug='pickup' then 'pickup' else 'delivery' end));
  return p_request;
end;
$$;

create or replace function svk_private.svk_set_stock(p_id uuid,p_quantity numeric,p_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare sale_unit text;
begin
  if coalesce(public.svk_role(),'') not in ('admin','shop') then raise exception 'Forbidden' using errcode='42501'; end if;
  select coalesce(data->>'sale_unit','kg') into sale_unit from public.svk_drafts where id=p_id;
  if p_quantity is null or p_quantity<0 or p_quantity<>round(p_quantity,3) or (sale_unit='unit' and p_quantity<>trunc(p_quantity)) then raise exception 'Invalid quantity'; end if;
  update public.svk_inventory set quantity_kg=p_quantity,version=version+1,updated_at=now() where product_id=p_id and version=p_version;
  if not found then raise exception 'Inventory changed. Reload before saving.' using errcode='40001'; end if;
end;
$$;
comment on column public.svk_inventory.quantity_kg is 'Available quantity in product sale_unit: kilograms by default, whole units for sale_unit=unit. Historical column name retained for API compatibility.';

commit;
