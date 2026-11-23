-- Track entry into the current order stage without changing order permissions.
-- Historical non-new stages have no reliable start time and remain NULL.
begin;

alter table public.svk_orders add column status_entered_at timestamptz;

update public.svk_orders
set status_entered_at = created_at
where status = 'new';

create function svk_private.svk_order_stage_time()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status_entered_at := new.created_at;
  elsif new.status is distinct from old.status then
    new.status_entered_at := clock_timestamp();
  else
    -- Updating courier details or retrying the same stage must not reset time.
    new.status_entered_at := old.status_entered_at;
  end if;
  return new;
end;
$$;

revoke all on function svk_private.svk_order_stage_time() from public, anon, authenticated;

create trigger order_stage_time
before insert or update on public.svk_orders
for each row execute function svk_private.svk_order_stage_time();

comment on column public.svk_orders.status_entered_at is
  'Server timestamp of entry into current status. NULL for pre-migration non-new orders with unknown stage history.';

commit;
