import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TARGET_CREATED_DATE = '2026-04-10T19:31:45.156Z';
const TARGET_BATCH_SIZE = 25;
const DEFAULT_SHOW_NAME = 'Imported Expo Lead';

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

    const payload = await req.json().catch(() => ({}));
    const showName = String(payload?.showName || DEFAULT_SHOW_NAME).trim();

    const contacts = await base44.asServiceRole.entities.Contact.list('created_date', 1000);
    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);

    const existingSourceIds = new Set((leads || []).map((lead) => pick(lead, 'source_contact_id')).filter(Boolean));

    const targetContacts = (contacts || [])
      .filter((contact) => {
        const createdDate = contact?.created_date ? new Date(contact.created_date).toISOString() : null;
        return createdDate === TARGET_CREATED_DATE;
      })
      .slice(0, TARGET_BATCH_SIZE);

    const createdLeadIds = [];
    const deletedContactIds = [];
    const skippedContactIds = [];

    for (const contact of targetContacts) {
      if (existingSourceIds.has(contact.id)) {
        skippedContactIds.push(contact.id);
        continue;
      }

      const lead = await base44.asServiceRole.entities.Lead.create({
        first_name: pick(contact, 'first_name'),
        last_name: pick(contact, 'last_name'),
        full_name: pick(contact, 'full_name'),
        email: pick(contact, 'email'),
        phone: pick(contact, 'phone'),
        title: pick(contact, 'title'),
        department: pick(contact, 'department'),
        company_name: pick(contact, 'company_name'),
        account_id: pick(contact, 'account_id'),
        dealer_instance_id: pick(contact, 'dealer_instance_id'),
        owner_user_id: pick(contact, 'owner_user_id') || user.id,
        source_contact_id: contact.id,
        source_contact_created_date: contact.created_date ? new Date(contact.created_date).toISOString() : null,
        status: 'open',
        show_name,
      });

      createdLeadIds.push(lead.id);
      await base44.asServiceRole.entities.Contact.delete(contact.id);
      deletedContactIds.push(contact.id);
    }

    return Response.json({
      success: true,
      show_name: showName,
      matched_contacts: targetContacts.length,
      created_leads: createdLeadIds.length,
      deleted_contacts: deletedContactIds.length,
      skipped_contacts: skippedContactIds.length,
      created_lead_ids: createdLeadIds,
      deleted_contact_ids: deletedContactIds,
      skipped_contact_ids: skippedContactIds,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});