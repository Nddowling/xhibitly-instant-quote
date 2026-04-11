import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function pick(record, key) {
  return record?.[key] ?? record?.data?.[key] ?? null;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);
    const accounts = await base44.asServiceRole.entities.Account.list('created_date', 5000);
    const updated = [];

    for (const lead of leads || []) {
      const email = normalize(pick(lead, 'email'));
      if (!email) continue;

      const matchedAccount = (accounts || []).find((account) => normalize(pick(account, 'email')) === email);
      const companyName = pick(matchedAccount, 'company_name') || pick(matchedAccount, 'name');
      if (!matchedAccount || !companyName) continue;
      if (pick(lead, 'company_name') === companyName) continue;

      await base44.asServiceRole.entities.Lead.update(lead.id, { company_name: companyName });
      updated.push({ id: lead.id, email, company_name: companyName });
    }

    return Response.json({ success: true, updated_count: updated.length, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});