import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const STANDARD_CONFIG = {
  Account: ['Client Account', 'Dealer Account'],
  Contact: ['Client Contact', 'Dealer Contact']
};

function makeDeveloperName(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildLayoutSections(objectApiName) {
  if (objectApiName === 'Account') {
    return [{ name: 'Account Information', fields: ['name', 'website', 'industry', 'phone', 'billing_address', 'description'] }];
  }
  if (objectApiName === 'Contact') {
    return [{ name: 'Contact Information', fields: ['first_name', 'last_name', 'full_name', 'email', 'phone', 'title', 'department'] }];
  }
  return [{ name: 'Details', fields: ['name'] }];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const created = [];

    for (const [objectApiName, labels] of Object.entries(STANDARD_CONFIG)) {
      for (const label of labels) {
        const developerName = makeDeveloperName(label);
        const existing = await base44.asServiceRole.entities.RecordType.filter({ object_api_name: objectApiName, developer_name: developerName }, 'created_date', 1);
        if (existing?.length) continue;

        const layout = await base44.asServiceRole.entities.PageLayout.create({
          object_api_name: objectApiName,
          name: `${label} Layout`,
          layout_sections: buildLayoutSections(objectApiName),
          is_active: true,
          is_global: true
        });

        const recordType = await base44.asServiceRole.entities.RecordType.create({
          object_api_name: objectApiName,
          developer_name: developerName,
          label,
          is_active: true,
          is_global: true,
          page_layout_id: layout.id,
          is_default: false
        });

        await base44.asServiceRole.entities.PageLayout.update(layout.id, { record_type_id: recordType.id });
        created.push({ object_api_name: objectApiName, label, record_type_id: recordType.id, page_layout_id: layout.id });
      }
    }

    return Response.json({ success: true, created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});