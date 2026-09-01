# Xhibitly v2 Supabase Foundation

This directory records the independent Xhibitly rebuild that lives alongside,
but does not depend on, the Base44 application.

## Reused assets

The rebuild deliberately reuses only the proven catalog infrastructure:

- `public.product_registry` (1,001 normalized SKUs at foundation time)
- `public.render_categories` (28 render categories at foundation time)
- `storage/orbus-assets` (6,697 objects, approximately 4.6 GB at foundation time)

The `xhibitly_v2.catalog_products` security-invoker view provides a stable read
model over the two existing catalog tables.

## New schemas

- `xhibitly_v2`: tenant-aware product application data
- `xhibitly_private`: non-exposed authorization and trigger helpers

The v2 schema contains organizations, memberships, profiles, customers, brands,
events, projects, exact-SKU line items, booth designs, durable render jobs,
pricing rules, immutable quote revisions, and audit events.

Every base table has RLS enabled. Cross-tenant relationships use composite
foreign keys containing `organization_id`, preventing a record in one tenant
from referencing a record in another tenant even if application code is wrong.

## API exposure

The `xhibitly_v2` schema is intentionally not exposed anonymously. Before a
frontend uses the Supabase Data API, add `xhibitly_v2` to the project's exposed
schemas in the Data API settings and regenerate TypeScript types. Explicit
`authenticated` grants and RLS policies are already present. Do not expose
`xhibitly_private`.

## Legacy quarantine

Do not build new product features against these legacy objects:

- `public.convention_contacts`
- `public.convention_contacts_summary`
- `public.repair_quotes`
- `get-render-data` Edge Function

The legacy summary view is currently reported by the Supabase security advisor
as a security-definer view. The legacy edge function is unauthenticated and has
permissive CORS. They remain untouched so the existing application is not
broken during the rebuild.

## Verification performed

- 13 v2 base tables created
- 39 v2 RLS policies created
- RLS enabled on all 13 tables
- `anon` has no usage on the v2 schema
- `authenticated` has explicit least-privilege grants
- 1,001 catalog rows resolve through `xhibitly_v2.catalog_products`
- no security-definer functions exist in the exposed v2 schema
- foreign-key index advisor warnings resolved

## Source of truth

`schema/xhibitly_v2_foundation.sql` is the reviewed bootstrap snapshot. Because
the Supabase CLI was unavailable in the authoring environment, this is not yet
a timestamped migration-history file. Generate and verify an official migration
with the current Supabase CLI before establishing automated deployments.
