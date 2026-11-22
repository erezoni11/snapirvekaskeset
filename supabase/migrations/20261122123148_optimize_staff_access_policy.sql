alter policy staff_read on public.svk_staff using (user_id=(select auth.uid()) or (select public.svk_role())='admin');
