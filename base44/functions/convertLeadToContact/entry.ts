import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function splitName(firstName, lastName, fullName) {
  if (firstName || lastName) {
    return {
      first_name: firstName || '',
      last_name: lastName || '',
      full_name: [firstName, lastName].filter(Boolean).join(' ').trim(),
    };
  }

  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
    full_name: parts.join(' '),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const leadId = payload?.leadId;

    if (!leadId) {
      return Response.json({ error: 'leadId is required' }, { status: 400 });
    }

    const lead = await base44.asServiceRole.entities.Lead.get(leadId);
    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.status === 'converted' && lead.converted_contact_id) {
      return Response.json({
        success: true,
        alreadyConverted: true,
        contactId: lead.converted_contact_id,
      });
    }

    const nameParts = splitName(lead.first_name, lead.last_name, lead.full_name);
    const normalizedEmail = normalize(lead.email);
    const normalizedFullName = normalizeName(nameParts.full_name || lead.full_name);

    const existingContacts = await base44.asServiceRole.entities.Contact.filter({ email: normalizedEmail }, '-created_date', 50);
    let matchedContact = (existingContacts || []).find((contact) => {
      const contactFullName = normalizeName(contact.full_name || contact.data?.full_name);
      return contactFullName === normalizedFullName;
    });

    if (!matchedContact) {
      matchedContact = await base44.asServiceRole.entities.Contact.create({
        first_name: nameParts.first_name || null,
        last_name: nameParts.last_name || null,
        full_name: nameParts.full_name || lead.full_name,
        email: lead.email || null,
        phone: lead.phone || null,
        title: lead.title || null,
        department: lead.department || null,
        dealer_instance_id: lead.dealer_instance_id || null,
        owner_user_id: user.id,
        account_id: lead.account_id || null,
        company_name: lead.company_name || null,
        portal_status: 'linked',
        linked_user_id: payload?.linkedUserId || null,
        record_type: 'Customer Contact',
      });
    } else {
      await base44.asServiceRole.entities.Contact.update(matchedContact.id, {
        first_name: matchedContact.first_name || nameParts.first_name || null,
        last_name: matchedContact.last_name || nameParts.last_name || null,
        full_name: matchedContact.full_name || nameParts.full_name || lead.full_name,
        phone: matchedContact.phone || lead.phone || null,
        title: matchedContact.title || lead.title || null,
        department: matchedContact.department || lead.department || null,
        dealer_instance_id: matchedContact.dealer_instance_id || lead.dealer_instance_id || null,
        account_id: matchedContact.account_id || lead.account_id || null,
        company_name: matchedContact.company_name || lead.company_name || null,
        owner_user_id: matchedContact.owner_user_id || user.id,
        portal_status: 'linked',
        linked_user_id: payload?.linkedUserId || matchedContact.linked_user_id || null,
        record_type: matchedContact.record_type || 'Customer Contact',
      });
    }

    await base44.asServiceRole.entities.Lead.update(lead.id, {
      status: 'converted',
      converted_contact_id: matchedContact.id,
      converted_at: new Date().toISOString(),
    });

    if (lead.source_contact_id) {
      await base44.asServiceRole.entities.Contact.delete(lead.source_contact_id);
    }

    return Response.json({
      success: true,
      contactId: matchedContact.id,
      leadId: lead.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});