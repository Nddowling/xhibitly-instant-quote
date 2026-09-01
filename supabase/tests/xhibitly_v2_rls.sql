-- Transactional smoke test for tenant isolation. All fixtures are rolled back.
begin;

insert into auth.users (id, email, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'xhibitly-rls-a@example.invalid', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'xhibitly-rls-b@example.invalid', now(), now());

insert into xhibitly_v2.organizations (id, name, slug, created_by)
values
  ('20000000-0000-0000-0000-000000000001', 'RLS Test A', 'rls-test-a', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'RLS Test B', 'rls-test-b', '10000000-0000-0000-0000-000000000002');

insert into xhibitly_v2.organization_members (organization_id, user_id, role, status)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner', 'active');

insert into xhibitly_v2.customers (id, organization_id, name, created_by)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Customer A', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Customer B', '10000000-0000-0000-0000-000000000002');

do $$
begin
  begin
    insert into xhibitly_v2.projects (
      organization_id, customer_id, owner_id, name, created_by
    ) values (
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'Invalid cross-tenant project',
      '10000000-0000-0000-0000-000000000001'
    );
    raise exception 'Cross-tenant customer reference was incorrectly accepted';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

do $$
declare
  visible_organizations integer;
  visible_customers integer;
begin
  select count(*) into visible_organizations from xhibitly_v2.organizations;
  select count(*) into visible_customers from xhibitly_v2.customers;

  if visible_organizations <> 1 then
    raise exception 'RLS test failed: user A can see % organizations', visible_organizations;
  end if;
  if visible_customers <> 1 then
    raise exception 'RLS test failed: user A can see % customers', visible_customers;
  end if;

  begin
    insert into xhibitly_v2.customers (organization_id, name, created_by)
    values (
      '20000000-0000-0000-0000-000000000002',
      'Unauthorized customer',
      '10000000-0000-0000-0000-000000000001'
    );
    raise exception 'RLS test failed: cross-tenant insert was accepted';
  exception
    when insufficient_privilege then null;
  end;

  insert into xhibitly_v2.customers (organization_id, name, created_by)
  values (
    '20000000-0000-0000-0000-000000000001',
    'Authorized customer',
    '10000000-0000-0000-0000-000000000001'
  );
end;
$$;

reset role;
rollback;
