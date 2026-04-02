import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'dealer';
}

async function createUniqueSlug(base44, baseName) {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let count = 1;

  while (true) {
    const existing = await base44.asServiceRole.entities.DealerInstance.filter({ slug }, 'created_date', 1);
    if (!existing?.length) return slug;
    count += 1;
    slug = `${baseSlug}-${count}`;
  }
}

function normalizeWebsite(website) {
  if (!website) return '';
  if (website.startsWith('http://') || website.startsWith('https://')) return website;
  return `https://${website}`;
}

function buildAddress(row) {
  return [row.address, row.city, row.state, row.zip].filter(Boolean).join(', ');
}


Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const csvUrl = 'https://media.base44.com/files/public/69834d9e0d7220d671bfd124/35da6d491_orbus_dealers.csv';
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      return Response.json({ error: 'Failed to download CSV file' }, { status: 500 });
    }

    const csvText = await csvResponse.text();
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(',').map((header) => header.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce((acc, header, index) => {
        acc[header] = (values[index] || '').trim();
        return acc;
      }, {});
    }).filter((row) => row.dealer_id && row.company_name);

    const existingInstances = await base44.asServiceRole.entities.DealerInstance.list('created_date', 2000);
    const existingAccounts = await base44.asServiceRole.entities.Account.list('created_date', 5000);
    const existingDealers = await base44.asServiceRole.entities.Dealer.list('created_date', 5000);

    let createdInstances = 0;
    let createdAccounts = 0;
    let createdDealers = 0;

    for (const row of rows) {
      let instance = existingInstances.find((item) => item.company_name === row.company_name || item.name === row.company_name);

      if (!instance) {
        const slug = await createUniqueSlug(base44, row.company_name);
        instance = await base44.asServiceRole.entities.DealerInstance.create({
          name: row.company_name,
          slug,
          owner_user_id: user.id,
          owner_email: row.email || user.email,
          company_name: row.company_name,
          status: 'active',
          dealer_id: row.dealer_id,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          phone: row.phone,
          website: normalizeWebsite(row.website),
          lat: Number(row.lat) || null,
          lng: Number(row.lng) || null,
          source: row.source
        });
        existingInstances.push(instance);
        createdInstances += 1;
      }

      const address = buildAddress(row);
      const normalizedWebsite = normalizeWebsite(row.website);

      const existingAccount = existingAccounts.find((item) => item.dealer_id === row.dealer_id || (item.name === row.company_name && item.record_type === 'Dealer'));
      if (!existingAccount) {
        const account = await base44.asServiceRole.entities.Account.create({
          name: row.company_name,
          company_name: row.company_name,
          website: normalizedWebsite,
          phone: row.phone,
          email: row.email,
          billing_address: address,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          dealer_id: row.dealer_id,
          lat: Number(row.lat) || null,
          lng: Number(row.lng) || null,
          source: row.source,
          dealer_instance_id: instance.id,
          owner_user_id: user.id,
          record_type: 'Dealer'
        });
        existingAccounts.push(account);
        createdAccounts += 1;
      }

      const existingDealer = existingDealers.find((item) => item.dealer_id === row.dealer_id || item.company_name === row.company_name);
      if (!existingDealer) {
        const dealer = await base44.asServiceRole.entities.Dealer.create({
          dealer_name: row.company_name,
          company_name: row.company_name,
          phone_number: row.phone,
          lead_contact_name: row.company_name,
          lead_contact_phone: row.phone,
          lead_contact_email: row.email,
          location: address,
          dealer_id: row.dealer_id,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          email: row.email,
          website: normalizedWebsite,
          lat: Number(row.lat) || null,
          lng: Number(row.lng) || null,
          source: row.source,
          dealer_instance_id: instance.id,
          record_type: 'Dealer'
        });
        existingDealers.push(dealer);
        createdDealers += 1;
      }
    }

    return Response.json({
      success: true,
      record_type: 'Dealer',
      processed_rows: rows.length,
      created_instances: createdInstances,
      created_accounts: createdAccounts,
      created_dealers: createdDealers
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});