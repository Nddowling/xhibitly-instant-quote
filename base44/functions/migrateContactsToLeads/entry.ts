import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const contacts = await base44.asServiceRole.entities.Contact.list('-created_date', 1000);
    const leadContacts = (contacts || []).filter((contact) => {
      const portalStatus = contact.portal_status || contact.data?.portal_status;
      return portalStatus === 'lead';
    });

    const existingLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);
    const existingKeys = new Set((existingLeads || []).map((lead) => `${String(lead.email || '').trim().toLowerCase()}::${String(lead.full_name || '').trim().toLowerCase()}`));

    const created = [];
    for (const contact of leadContacts) {
      const key = `${String(contact.email || '').trim().toLowerCase()}::${String(contact.full_name || '').trim().toLowerCase()}`;
      if (existingKeys.has(key)) continue;

      const lead = await base44.asServiceRole.entities.Lead.create({
        first_name: contact.first_name || contact.data?.first_name || null,
        last_name: contact.last_name || contact.data?.last_name || null,
        full_name: contact.full_name || contact.data?.full_name,
        email: contact.email || contact.data?.email || null,
        phone: contact.phone || contact.data?.phone || null,
        title: contact.title || contact.data?.title || null,
        department: contact.department || contact.data?.department || null,
        company_name: contact.company_name || contact.data?.company_name || contact.account_name || contact.data?.account_name || null,
        account_id: contact.account_id || contact.data?.account_id || null,
        dealer_instance_id: contact.dealer_instance_id || contact.data?.dealer_instance_id || null,
        owner_user_id: contact.owner_user_id || contact.data?.owner_user_id || null,
        source_contact_id: contact.id,
        status: 'open',
      });
      created.push(lead.id);
      existingKeys.add(key);
    }

    return Response.json({ success: true, migrated_count: created.length, lead_ids: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});