import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function pick(record, key) {
  return record?.[key] ?? record?.data?.[key] ?? null;
}

function extractCompanyFromEmail(email) {
  const domain = String(email || '').split('@')[1] || '';
  const root = domain.split('.')[0] || '';
  if (!root) return null;
  return root
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);
    const updated = [];

    for (const lead of leads || []) {
      const companyName = pick(lead, 'company_name');
      const showName = pick(lead, 'show_name');
      const email = pick(lead, 'email');
      const nextCompanyName = companyName || extractCompanyFromEmail(email);

      if (!nextCompanyName && showName) continue;

      const updates = {};
      if (!companyName && nextCompanyName) updates.company_name = nextCompanyName;
      if (!showName) updates.show_name = 'CES 26, The Tech Show';

      if (Object.keys(updates).length === 0) continue;

      await base44.asServiceRole.entities.Lead.update(lead.id, updates);
      updated.push({ id: lead.id, ...updates });
    }

    return Response.json({ success: true, updated_count: updated.length, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});