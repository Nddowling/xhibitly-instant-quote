begin;

create schema if not exists xhibitly_v2;
create schema if not exists xhibitly_private;

revoke all on schema xhibitly_v2 from public, anon;
revoke all on schema xhibitly_private from public, anon;
grant usage on schema xhibitly_v2 to authenticated;
grant usage on schema xhibitly_private to authenticated;

create or replace function xhibitly_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function xhibitly_private.touch_updated_at() from public, anon, authenticated;

create table if not exists xhibitly_v2.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  job_title text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xhibitly_v2.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xhibitly_v2.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'rep' check (role in ('owner', 'admin', 'manager', 'rep', 'designer', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function xhibitly_private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from xhibitly_v2.organization_members membership
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    );
$$;

create or replace function xhibitly_private.can_edit_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from xhibitly_v2.organization_members membership
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'admin', 'manager', 'rep')
    );
$$;

create or replace function xhibitly_private.can_design_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from xhibitly_v2.organization_members membership
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'admin', 'manager', 'rep', 'designer')
    );
$$;

create or replace function xhibitly_private.can_manage_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from xhibitly_v2.organization_members membership
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'admin', 'manager')
    );
$$;

create or replace function xhibitly_private.shares_org_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from xhibitly_v2.organization_members mine
      join xhibitly_v2.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = target_user_id
        and theirs.status = 'active'
    );
$$;

create or replace function xhibitly_private.is_org_creator(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from xhibitly_v2.organizations organization
      where organization.id = target_organization_id
        and organization.created_by = (select auth.uid())
    );
$$;

revoke all on function xhibitly_private.is_org_member(uuid) from public, anon;
revoke all on function xhibitly_private.can_edit_org(uuid) from public, anon;
revoke all on function xhibitly_private.can_design_org(uuid) from public, anon;
revoke all on function xhibitly_private.can_manage_org(uuid) from public, anon;
revoke all on function xhibitly_private.shares_org_with(uuid) from public, anon;
revoke all on function xhibitly_private.is_org_creator(uuid) from public, anon;
grant execute on function xhibitly_private.is_org_member(uuid) to authenticated;
grant execute on function xhibitly_private.can_edit_org(uuid) to authenticated;
grant execute on function xhibitly_private.can_design_org(uuid) to authenticated;
grant execute on function xhibitly_private.can_manage_org(uuid) to authenticated;
grant execute on function xhibitly_private.shares_org_with(uuid) to authenticated;
grant execute on function xhibitly_private.is_org_creator(uuid) to authenticated;

create table if not exists xhibitly_v2.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  website text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  billing_address jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table if not exists xhibitly_v2.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  customer_id uuid,
  name text not null,
  website text,
  logo_url text,
  colors jsonb not null default '[]'::jsonb,
  fonts jsonb not null default '[]'::jsonb,
  identity jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'website', 'brand_api', 'import')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (customer_id, organization_id)
    references xhibitly_v2.customers(id, organization_id) on delete restrict
);

create table if not exists xhibitly_v2.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  name text not null,
  venue text,
  city text,
  state_region text,
  starts_on date,
  ends_on date,
  move_in_on date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists xhibitly_v2.projects (
  id uuid primary key default gen_random_uuid(),
  project_number bigint generated always as identity,
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  customer_id uuid,
  event_id uuid,
  brand_id uuid,
  owner_id uuid not null references auth.users(id),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'configuring', 'priced', 'rendering', 'review', 'proposed', 'accepted', 'declined', 'cancelled')),
  workflow_stage text not null default 'customer_show' check (workflow_stage in ('customer_show', 'brand', 'booth', 'products', 'price', 'render', 'review', 'proposal')),
  proposal_status text not null default 'not_started' check (proposal_status in ('not_started', 'draft', 'ready', 'sent', 'viewed', 'accepted', 'declined')),
  booth_type text,
  booth_width_ft numeric(8,2) check (booth_width_ft is null or booth_width_ft > 0),
  booth_depth_ft numeric(8,2) check (booth_depth_ft is null or booth_depth_ft > 0),
  open_sides text[] not null default '{}'::text[],
  selected_tier text check (selected_tier is null or selected_tier in ('modular', 'hybrid', 'custom')),
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  list_total_cents bigint not null default 0 check (list_total_cents >= 0),
  quoted_total_cents bigint not null default 0 check (quoted_total_cents >= 0),
  final_total_cents bigint not null default 0 check (final_total_cents >= 0),
  configuration jsonb not null default '{}'::jsonb,
  configuration_fingerprint text,
  configuration_version integer not null default 1 check (configuration_version > 0),
  share_token uuid not null default gen_random_uuid() unique,
  share_enabled boolean not null default false,
  last_autosaved_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, project_number),
  foreign key (customer_id, organization_id)
    references xhibitly_v2.customers(id, organization_id) on delete restrict,
  foreign key (event_id, organization_id)
    references xhibitly_v2.events(id, organization_id) on delete restrict,
  foreign key (brand_id, organization_id)
    references xhibitly_v2.brands(id, organization_id) on delete restrict
);

create table if not exists xhibitly_v2.project_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  project_id uuid not null,
  product_sku text not null references public.product_registry(sku) on update cascade,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents bigint check (unit_price_cents is null or unit_price_cents >= 0),
  list_unit_price_cents bigint check (list_unit_price_cents is null or list_unit_price_cents >= 0),
  markup_basis_points integer not null default 0,
  discount_basis_points integer not null default 0,
  final_unit_price_cents bigint check (final_unit_price_cents is null or final_unit_price_cents >= 0),
  final_total_cents bigint check (final_total_cents is null or final_total_cents >= 0),
  verification_status text not null default 'verified' check (verification_status in ('verified', 'ambiguous', 'confirmed_ambiguous', 'unavailable')),
  pricing_status text not null default 'pending' check (pricing_status in ('pending', 'priced', 'unavailable', 'overridden')),
  placement_intent jsonb not null default '{}'::jsonb,
  render_ready boolean not null default false,
  product_snapshot jsonb not null,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, product_sku),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references xhibitly_v2.projects(id, organization_id) on delete cascade,
  check (markup_basis_points between -10000 and 100000),
  check (discount_basis_points between 0 and 10000)
);

create table if not exists xhibitly_v2.booth_designs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  project_id uuid not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'validating', 'ready', 'rendering', 'needs_review', 'approved', 'rejected', 'failed')),
  layout_instructions text,
  spatial_layout jsonb not null default '[]'::jsonb,
  scene jsonb not null default '{}'::jsonb,
  render_contract jsonb not null default '{}'::jsonb,
  validation_results jsonb not null default '{}'::jsonb,
  visual_audit jsonb not null default '{}'::jsonb,
  preview_image_url text,
  approved_render_url text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references xhibitly_v2.projects(id, organization_id) on delete cascade
);

create table if not exists xhibitly_v2.render_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  project_id uuid not null,
  booth_design_id uuid,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'waiting_for_review', 'succeeded', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  foreign key (project_id, organization_id)
    references xhibitly_v2.projects(id, organization_id) on delete cascade,
  foreign key (booth_design_id, organization_id)
    references xhibitly_v2.booth_designs(id, organization_id) on delete restrict
);

create table if not exists xhibitly_v2.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  active boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists xhibitly_v2.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  project_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'issued', 'superseded', 'accepted', 'declined')),
  snapshot jsonb not null,
  total_cents bigint not null default 0 check (total_cents >= 0),
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, version),
  foreign key (project_id, organization_id)
    references xhibitly_v2.projects(id, organization_id) on delete cascade
);

create table if not exists xhibitly_v2.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references xhibitly_v2.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_members_user_idx on xhibitly_v2.organization_members(user_id, status);
create index if not exists organization_members_invited_by_idx on xhibitly_v2.organization_members(invited_by) where invited_by is not null;
create index if not exists organizations_created_by_idx on xhibitly_v2.organizations(created_by);
create index if not exists customers_org_name_idx on xhibitly_v2.customers(organization_id, name);
create index if not exists customers_created_by_idx on xhibitly_v2.customers(created_by);
create index if not exists brands_org_customer_idx on xhibitly_v2.brands(organization_id, customer_id);
create index if not exists brands_customer_org_idx on xhibitly_v2.brands(customer_id, organization_id) where customer_id is not null;
create index if not exists brands_created_by_idx on xhibitly_v2.brands(created_by);
create index if not exists events_org_dates_idx on xhibitly_v2.events(organization_id, starts_on desc);
create index if not exists events_created_by_idx on xhibitly_v2.events(created_by);
create index if not exists projects_org_updated_idx on xhibitly_v2.projects(organization_id, updated_at desc);
create index if not exists projects_org_owner_idx on xhibitly_v2.projects(organization_id, owner_id, status);
create index if not exists projects_owner_idx on xhibitly_v2.projects(owner_id);
create index if not exists projects_created_by_idx on xhibitly_v2.projects(created_by);
create index if not exists projects_customer_org_idx on xhibitly_v2.projects(customer_id, organization_id) where customer_id is not null;
create index if not exists projects_event_org_idx on xhibitly_v2.projects(event_id, organization_id) where event_id is not null;
create index if not exists projects_brand_org_idx on xhibitly_v2.projects(brand_id, organization_id) where brand_id is not null;
create index if not exists line_items_project_idx on xhibitly_v2.project_line_items(project_id, sort_order);
create index if not exists line_items_project_org_idx on xhibitly_v2.project_line_items(project_id, organization_id);
create index if not exists line_items_org_idx on xhibitly_v2.project_line_items(organization_id);
create index if not exists line_items_product_sku_idx on xhibitly_v2.project_line_items(product_sku);
create index if not exists line_items_created_by_idx on xhibitly_v2.project_line_items(created_by);
create index if not exists booth_designs_project_idx on xhibitly_v2.booth_designs(project_id, version desc);
create index if not exists booth_designs_project_org_idx on xhibitly_v2.booth_designs(project_id, organization_id);
create index if not exists booth_designs_org_idx on xhibitly_v2.booth_designs(organization_id);
create index if not exists booth_designs_approved_by_idx on xhibitly_v2.booth_designs(approved_by) where approved_by is not null;
create index if not exists booth_designs_created_by_idx on xhibitly_v2.booth_designs(created_by);
create index if not exists render_jobs_project_idx on xhibitly_v2.render_jobs(project_id, created_at desc);
create index if not exists render_jobs_project_org_idx on xhibitly_v2.render_jobs(project_id, organization_id);
create index if not exists render_jobs_design_org_idx on xhibitly_v2.render_jobs(booth_design_id, organization_id) where booth_design_id is not null;
create index if not exists render_jobs_created_by_idx on xhibitly_v2.render_jobs(created_by);
create index if not exists render_jobs_status_idx on xhibitly_v2.render_jobs(status, created_at);
create index if not exists pricing_rules_org_active_idx on xhibitly_v2.pricing_rules(organization_id, active, priority);
create index if not exists pricing_rules_created_by_idx on xhibitly_v2.pricing_rules(created_by);
create index if not exists quote_revisions_project_idx on xhibitly_v2.quote_revisions(project_id, version desc);
create index if not exists quote_revisions_project_org_idx on xhibitly_v2.quote_revisions(project_id, organization_id);
create index if not exists quote_revisions_org_idx on xhibitly_v2.quote_revisions(organization_id);
create index if not exists quote_revisions_created_by_idx on xhibitly_v2.quote_revisions(created_by);
create index if not exists audit_events_org_created_idx on xhibitly_v2.audit_events(organization_id, created_at desc);
create index if not exists audit_events_entity_idx on xhibitly_v2.audit_events(organization_id, entity_type, entity_id);
create index if not exists audit_events_actor_idx on xhibitly_v2.audit_events(actor_user_id) where actor_user_id is not null;

create or replace view xhibitly_v2.catalog_products
with (security_invoker = true)
as
select
  product.sku,
  product.product_name,
  product.base44_category as legacy_category,
  product.render_category_id,
  category.display_name as render_category_name,
  category.physical_description,
  coalesce(product.dimension_override, category.default_dimensions) as dimensions,
  category.material,
  category.placement_zone,
  category.placement_rule,
  coalesce(product.render_instruction_override, category.render_instruction) as render_instruction,
  category.shape_variant,
  product.image_path
from public.product_registry product
join public.render_categories category on category.id = product.render_category_id;

alter table xhibitly_v2.profiles enable row level security;
alter table xhibitly_v2.organizations enable row level security;
alter table xhibitly_v2.organization_members enable row level security;
alter table xhibitly_v2.customers enable row level security;
alter table xhibitly_v2.brands enable row level security;
alter table xhibitly_v2.events enable row level security;
alter table xhibitly_v2.projects enable row level security;
alter table xhibitly_v2.project_line_items enable row level security;
alter table xhibitly_v2.booth_designs enable row level security;
alter table xhibitly_v2.render_jobs enable row level security;
alter table xhibitly_v2.pricing_rules enable row level security;
alter table xhibitly_v2.quote_revisions enable row level security;
alter table xhibitly_v2.audit_events enable row level security;

create policy profiles_select on xhibitly_v2.profiles for select to authenticated
using (user_id = (select auth.uid()) or (select xhibitly_private.shares_org_with(user_id)));
create policy profiles_insert on xhibitly_v2.profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy profiles_update on xhibitly_v2.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy organizations_select on xhibitly_v2.organizations for select to authenticated
using ((select xhibitly_private.is_org_member(id)));
create policy organizations_insert on xhibitly_v2.organizations for insert to authenticated
with check (created_by = (select auth.uid()));
create policy organizations_update on xhibitly_v2.organizations for update to authenticated
using ((select xhibitly_private.can_manage_org(id)))
with check ((select xhibitly_private.can_manage_org(id)));

create policy organization_members_select on xhibitly_v2.organization_members for select to authenticated
using (user_id = (select auth.uid()) or (select xhibitly_private.can_manage_org(organization_id)));
create policy organization_members_insert on xhibitly_v2.organization_members for insert to authenticated
with check (
  (select xhibitly_private.can_manage_org(organization_id))
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and (select xhibitly_private.is_org_creator(organization_id))
  )
);
create policy organization_members_update on xhibitly_v2.organization_members for update to authenticated
using ((select xhibitly_private.can_manage_org(organization_id)))
with check ((select xhibitly_private.can_manage_org(organization_id)));

create policy customers_select on xhibitly_v2.customers for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy customers_insert on xhibitly_v2.customers for insert to authenticated
with check ((select xhibitly_private.can_edit_org(organization_id)) and created_by = (select auth.uid()));
create policy customers_update on xhibitly_v2.customers for update to authenticated
using ((select xhibitly_private.can_edit_org(organization_id)))
with check ((select xhibitly_private.can_edit_org(organization_id)));

create policy brands_select on xhibitly_v2.brands for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy brands_insert on xhibitly_v2.brands for insert to authenticated
with check ((select xhibitly_private.can_edit_org(organization_id)) and created_by = (select auth.uid()));
create policy brands_update on xhibitly_v2.brands for update to authenticated
using ((select xhibitly_private.can_edit_org(organization_id)))
with check ((select xhibitly_private.can_edit_org(organization_id)));

create policy events_select on xhibitly_v2.events for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy events_insert on xhibitly_v2.events for insert to authenticated
with check ((select xhibitly_private.can_edit_org(organization_id)) and created_by = (select auth.uid()));
create policy events_update on xhibitly_v2.events for update to authenticated
using ((select xhibitly_private.can_edit_org(organization_id)))
with check ((select xhibitly_private.can_edit_org(organization_id)));

create policy projects_select on xhibitly_v2.projects for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy projects_insert on xhibitly_v2.projects for insert to authenticated
with check (
  (select xhibitly_private.can_edit_org(organization_id))
  and created_by = (select auth.uid())
  and (owner_id = (select auth.uid()) or (select xhibitly_private.can_manage_org(organization_id)))
);
create policy projects_update on xhibitly_v2.projects for update to authenticated
using (owner_id = (select auth.uid()) or (select xhibitly_private.can_manage_org(organization_id)))
with check (owner_id = (select auth.uid()) or (select xhibitly_private.can_manage_org(organization_id)));

create policy line_items_select on xhibitly_v2.project_line_items for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy line_items_insert on xhibitly_v2.project_line_items for insert to authenticated
with check ((select xhibitly_private.can_edit_org(organization_id)) and created_by = (select auth.uid()));
create policy line_items_update on xhibitly_v2.project_line_items for update to authenticated
using ((select xhibitly_private.can_edit_org(organization_id)))
with check ((select xhibitly_private.can_edit_org(organization_id)));
create policy line_items_delete on xhibitly_v2.project_line_items for delete to authenticated
using ((select xhibitly_private.can_edit_org(organization_id)));

create policy booth_designs_select on xhibitly_v2.booth_designs for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy booth_designs_insert on xhibitly_v2.booth_designs for insert to authenticated
with check ((select xhibitly_private.can_design_org(organization_id)) and created_by = (select auth.uid()));
create policy booth_designs_update on xhibitly_v2.booth_designs for update to authenticated
using ((select xhibitly_private.can_design_org(organization_id)))
with check ((select xhibitly_private.can_design_org(organization_id)));

create policy render_jobs_select on xhibitly_v2.render_jobs for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy render_jobs_insert on xhibitly_v2.render_jobs for insert to authenticated
with check ((select xhibitly_private.can_design_org(organization_id)) and created_by = (select auth.uid()));
create policy render_jobs_update on xhibitly_v2.render_jobs for update to authenticated
using ((select xhibitly_private.can_design_org(organization_id)))
with check ((select xhibitly_private.can_design_org(organization_id)));

create policy pricing_rules_select on xhibitly_v2.pricing_rules for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy pricing_rules_insert on xhibitly_v2.pricing_rules for insert to authenticated
with check ((select xhibitly_private.can_manage_org(organization_id)) and created_by = (select auth.uid()));
create policy pricing_rules_update on xhibitly_v2.pricing_rules for update to authenticated
using ((select xhibitly_private.can_manage_org(organization_id)))
with check ((select xhibitly_private.can_manage_org(organization_id)));
create policy pricing_rules_delete on xhibitly_v2.pricing_rules for delete to authenticated
using ((select xhibitly_private.can_manage_org(organization_id)));

create policy quote_revisions_select on xhibitly_v2.quote_revisions for select to authenticated
using ((select xhibitly_private.is_org_member(organization_id)));
create policy quote_revisions_insert on xhibitly_v2.quote_revisions for insert to authenticated
with check ((select xhibitly_private.can_edit_org(organization_id)) and created_by = (select auth.uid()));

create policy audit_events_select on xhibitly_v2.audit_events for select to authenticated
using ((select xhibitly_private.can_manage_org(organization_id)));
create policy audit_events_insert on xhibitly_v2.audit_events for insert to authenticated
with check ((select xhibitly_private.is_org_member(organization_id)) and actor_user_id = (select auth.uid()));

grant select, insert, update on xhibitly_v2.profiles to authenticated;
grant select, insert, update on xhibitly_v2.organizations to authenticated;
grant select, insert, update on xhibitly_v2.organization_members to authenticated;
grant select, insert, update on xhibitly_v2.customers to authenticated;
grant select, insert, update on xhibitly_v2.brands to authenticated;
grant select, insert, update on xhibitly_v2.events to authenticated;
grant select, insert, update on xhibitly_v2.projects to authenticated;
grant select, insert, update, delete on xhibitly_v2.project_line_items to authenticated;
grant select, insert, update on xhibitly_v2.booth_designs to authenticated;
grant select, insert, update on xhibitly_v2.render_jobs to authenticated;
grant select, insert, update, delete on xhibitly_v2.pricing_rules to authenticated;
grant select, insert on xhibitly_v2.quote_revisions to authenticated;
grant select, insert on xhibitly_v2.audit_events to authenticated;
grant select on xhibitly_v2.catalog_products to authenticated;
grant usage, select on all sequences in schema xhibitly_v2 to authenticated;

create trigger profiles_touch_updated_at before update on xhibitly_v2.profiles
for each row execute function xhibitly_private.touch_updated_at();
create trigger organizations_touch_updated_at before update on xhibitly_v2.organizations
for each row execute function xhibitly_private.touch_updated_at();
create trigger organization_members_touch_updated_at before update on xhibitly_v2.organization_members
for each row execute function xhibitly_private.touch_updated_at();
create trigger customers_touch_updated_at before update on xhibitly_v2.customers
for each row execute function xhibitly_private.touch_updated_at();
create trigger brands_touch_updated_at before update on xhibitly_v2.brands
for each row execute function xhibitly_private.touch_updated_at();
create trigger events_touch_updated_at before update on xhibitly_v2.events
for each row execute function xhibitly_private.touch_updated_at();
create trigger projects_touch_updated_at before update on xhibitly_v2.projects
for each row execute function xhibitly_private.touch_updated_at();
create trigger line_items_touch_updated_at before update on xhibitly_v2.project_line_items
for each row execute function xhibitly_private.touch_updated_at();
create trigger booth_designs_touch_updated_at before update on xhibitly_v2.booth_designs
for each row execute function xhibitly_private.touch_updated_at();
create trigger render_jobs_touch_updated_at before update on xhibitly_v2.render_jobs
for each row execute function xhibitly_private.touch_updated_at();
create trigger pricing_rules_touch_updated_at before update on xhibitly_v2.pricing_rules
for each row execute function xhibitly_private.touch_updated_at();

comment on schema xhibitly_v2 is 'Independent Xhibitly application schema. Created non-destructively alongside legacy Base44-era data.';
comment on table xhibitly_v2.projects is 'Canonical quote/project aggregate for the staged customer-to-proposal workflow.';
comment on table xhibitly_v2.project_line_items is 'Exact-SKU quote lines with immutable product snapshots and tenant-consistency constraints.';
comment on table xhibitly_v2.render_jobs is 'Idempotent durable render requests and their outcomes.';

commit;
