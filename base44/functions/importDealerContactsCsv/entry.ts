import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeLinkedin(value) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const csvUrl = 'https://media.base44.com/files/public/69834d9e0d7220d671bfd124/7a95b7674_orbus_contacts.csv';
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      return Response.json({ error: 'Failed to download contacts CSV file' }, { status: 500 });
    }

    const csvText = await csvResponse.text();
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return headers.reduce((acc, header, index) => {
        acc[header] = (values[index] || '').trim();
        return acc;
      }, {});
    }).filter((row) => row.dealer_id && (row.first_name || row.last_name));

    const dealerInstances = await base44.asServiceRole.entities.DealerInstance.list('created_date', 5000);
    const accounts = await base44.asServiceRole.entities.Account.list('created_date', 5000);
    const existingContacts = await base44.asServiceRole.entities.Contact.list('created_date', 5000);

    let createdContacts = 0;
    let skippedContacts = 0;
    let missingDealerInstances = 0;

    for (const row of rows) {
      const matchedAccount = accounts.find((item) => item.dealer_id === row.dealer_id || item.data?.dealer_id === row.dealer_id);
      const dealerInstance = dealerInstances.find((item) => item.dealer_id === row.dealer_id || item.data?.dealer_id === row.dealer_id || item.id === matchedAccount?.dealer_instance_id || item.id === matchedAccount?.data?.dealer_instance_id);
      if (!dealerInstance) {
        missingDealerInstances += 1;
        continue;
      }

      const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      const existingContact = existingContacts.find((item) => item.contact_id === row.contact_id || item.data?.contact_id === row.contact_id || ((item.email === row.email || item.data?.email === row.email) && row.email) || ((item.full_name === fullName || item.data?.full_name === fullName) && (item.dealer_instance_id === dealerInstance.id || item.data?.dealer_instance_id === dealerInstance.id)));

      if (existingContact) {
        skippedContacts += 1;
        continue;
      }

      const created = await base44.asServiceRole.entities.Contact.create({
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: fullName,
        title: row.title,
        email: row.email,
        phone: row.phone,
        linkedin: normalizeLinkedin(row.linkedin),
        contact_id: row.contact_id,
        dealer_id: row.dealer_id,
        dealer_instance_id: dealerInstance.id,
        owner_user_id: user.id,
        record_type: 'Dealer'
      });

      existingContacts.push(created);
      createdContacts += 1;
    }

    return Response.json({
      success: true,
      processed_rows: rows.length,
      created_contacts: createdContacts,
      skipped_contacts: skippedContacts,
      missing_dealer_instances: missingDealerInstances,
      record_type: 'Dealer'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});