import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = normalizeEmail(user.email);
    if (!email) {
      return Response.json({ linked: false, reason: 'missing_email' });
    }

    const contacts = await base44.asServiceRole.entities.Contact.filter({ email }, '-created_date', 20);
    const customerContact = (contacts || []).find((contact) => {
      const data = contact.data || {};
      const recordType = String(contact.record_type || data.record_type || '').toLowerCase();
      const fullName = contact.full_name || data.full_name;
      return recordType.includes('client') || recordType.includes('customer') || Boolean(fullName);
    });

    if (!customerContact) {
      return Response.json({ linked: false, reason: 'no_matching_contact' });
    }

    const data = customerContact.data || {};
    const updates = {
      owner_user_id: user.id,
      record_type: customerContact.record_type || data.record_type || 'Customer Contact',
    };

    if (!(customerContact.full_name || data.full_name) && user.full_name) {
      updates.full_name = user.full_name;
    }

    await base44.asServiceRole.entities.Contact.update(customerContact.id, updates);

    return Response.json({
      linked: true,
      contact_id: customerContact.id,
      contact_name: customerContact.full_name || data.full_name || user.full_name || user.email,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});