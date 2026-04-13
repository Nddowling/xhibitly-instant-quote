import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

const FILE_URL = 'https://media.base44.com/files/public/69834d9e0d7220d671bfd124/830224b63_PCA26.xlsx';
const FILE_NAME = 'PCA26.xlsx';
const DEFAULT_SHOW_NAME = 'PCA 26';
const DEFAULT_DEALER_INSTANCE_ID = '69d94c853e7e9e5c36953834';

function splitName(fullName) {
  const normalized = String(fullName || '').trim();
  if (!normalized) return { first_name: '', last_name: '' };
  const parts = normalized.split(/\s+/);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

function normalizePhone(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value).replace(/\.0$/, '').trim();
}

function normalizeWebsite(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  return `https://${normalized}`;
}

function pick(record, key) {
  return record?.[key] ?? record?.data?.[key] ?? null;
}

function companyKey(companyName, website) {
  return `${String(companyName || '').trim().toLowerCase()}::${String(website || '').trim().toLowerCase()}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const response = await fetch(FILE_URL);
    if (!response.ok) {
      return Response.json({ error: 'Failed to download Excel file' }, { status: 500 });
    }

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const existingLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 10000);
    const existingAccounts = await base44.asServiceRole.entities.Account.list('-created_date', 10000);

    const accountMap = new Map();
    for (const account of existingAccounts) {
      const name = pick(account, 'name') || pick(account, 'company_name') || '';
      const website = normalizeWebsite(pick(account, 'website') || '');
      accountMap.set(companyKey(name, website), account);
      if (name) accountMap.set(companyKey(name, ''), account);
    }

    let skipped = 0;
    let createdAccounts = 0;
    const leadsToCreate = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const companyName = String(row['Company name'] || '').trim();
      const contactName = String(row['Contact name'] || '').trim();
      const email = String(row['Email Address'] || '').trim().toLowerCase();
      const phone = normalizePhone(row['Phone Number']);
      const tollFree = normalizePhone(row['Toll Free']);
      const contactType = String(row['Contact type'] || '').trim();
      const website = normalizeWebsite(row['Website']);
      const { first_name, last_name } = splitName(contactName);

      if (!contactName && !email && !companyName) continue;

      const existingLead = existingLeads.find((lead) => {
        const leadEmail = String(pick(lead, 'email') || '').trim().toLowerCase();
        const leadFullName = String(pick(lead, 'full_name') || '').trim().toLowerCase();
        const leadCompany = String(pick(lead, 'company_name') || '').trim().toLowerCase();
        const leadShow = String(pick(lead, 'show_name') || '').trim().toLowerCase();
        const sameEmail = email && leadEmail === email;
        const samePersonCompany = contactName && companyName && leadFullName === contactName.toLowerCase() && leadCompany === companyName.toLowerCase();
        return (sameEmail || samePersonCompany) && leadShow === DEFAULT_SHOW_NAME.toLowerCase();
      });

      if (existingLead) {
        skipped += 1;
        continue;
      }

      let account = accountMap.get(companyKey(companyName, website)) || accountMap.get(companyKey(companyName, ''));
      if (!account && companyName) {
        account = await base44.asServiceRole.entities.Account.create({
          name: companyName,
          company_name: companyName,
          website,
          phone: phone || tollFree,
          dealer_instance_id: DEFAULT_DEALER_INSTANCE_ID,
          owner_user_id: user.id
        });
        accountMap.set(companyKey(companyName, website), account);
        accountMap.set(companyKey(companyName, ''), account);
        createdAccounts += 1;
      }

      leadsToCreate.push({
        first_name,
        last_name,
        full_name: contactName || companyName,
        email,
        phone,
        title: contactType,
        department: '',
        company_name: companyName,
        website,
        toll_free: tollFree,
        contact_type: contactType,
        show_name: DEFAULT_SHOW_NAME,
        source_file_name: FILE_NAME,
        source_row_index: index + 1,
        account_id: account?.id || null,
        dealer_instance_id: DEFAULT_DEALER_INSTANCE_ID,
        owner_user_id: user.id,
        status: 'open'
      });
    }

    if (leadsToCreate.length > 0) {
      await base44.asServiceRole.entities.Lead.bulkCreate(leadsToCreate);
    }

    return Response.json({ success: true, file_name: FILE_NAME, sheet_name: sheetName, processed_rows: rows.length, created_accounts: createdAccounts, created_leads: leadsToCreate.length, skipped_leads: skipped, show_name: DEFAULT_SHOW_NAME });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});