import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const STANDARD_OBJECTS = ['Account', 'Contact'];
const DEALER_SCOPED_OBJECTS = [
  'Account',
  'Contact',
  'ObjectTab',
  'ClientProfile',
  'DealerPricingSettings',
  'QuoteRevision',
  'LineItem',
  'BoothDesign',
  'Activity',
  'SalesGoal',
  'Payment',
  'AuditLog'
];

function makeDeveloperName(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildLayoutSections(objectApiName) {
  if (objectApiName === 'Account') {
    return [
      { name: 'Account Information', fields: ['name', 'website', 'industry', 'phone', 'billing_address', 'description'] }
    ];
  }
  if (objectApiName === 'Contact') {
    return [
      { name: 'Contact Information', fields: ['first_name', 'last_name', 'full_name', 'email', 'phone', 'title', 'department'] }
    ];
  }
  return [
    { name: 'Details', fields: ['name'] }
  ];
}

async function migrateDealerScopedEntity(base44, entityName, instanceMap) {
  const records = await base44.asServiceRole.entities[entityName].list('created_date', 1000);

  for (const record of records || []) {
    if (record.dealer_instance_id) continue;
    const brokerInstanceId = record.broker_instance_id || record.data?.broker_instance_id;
    if (!brokerInstanceId) continue;

    const dealerInstanceId = instanceMap[brokerInstanceId] || '';
    if (!dealerInstanceId) continue;

    await base44.asServiceRole.entities[entityName].update(record.id, {
      dealer_instance_id: dealerInstanceId
    });
  }
}

async function ensureStandardRecordType(base44, objectApiName, label) {
  const developerName = makeDeveloperName(label);
  const existing = await base44.asServiceRole.entities.RecordType.filter({ object_api_name: objectApiName, developer_name: developerName }, 'created_date', 1);
  if (existing?.length) return existing[0];

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
  return recordType;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const legacyInstances = await base44.asServiceRole.entities.BrokerInstance.list('created_date', 500);
    const legacyMembers = await base44.asServiceRole.entities.BrokerMember.list('created_date', 1000);

    const dealerInstances = await base44.asServiceRole.entities.DealerInstance.list('created_date', 500);
    const instanceMap = {};

    for (const brokerInstance of legacyInstances || []) {
      const existing = dealerInstances.find(item => item.source_broker_instance_id === brokerInstance.id || item.slug === brokerInstance.slug);
      if (existing) {
        instanceMap[brokerInstance.id] = existing.id;
        continue;
      }

      const created = await base44.asServiceRole.entities.DealerInstance.create({
        name: brokerInstance.name,
        slug: brokerInstance.slug,
        owner_user_id: brokerInstance.owner_user_id,
        owner_email: brokerInstance.owner_email,
        company_name: brokerInstance.company_name,
        status: brokerInstance.status || 'active',
        source_broker_instance_id: brokerInstance.id
      });
      instanceMap[brokerInstance.id] = created.id;
    }

    const dealerMembers = await base44.asServiceRole.entities.DealerMember.list('created_date', 1000);
    for (const brokerMember of legacyMembers || []) {
      const dealerInstanceId = instanceMap[brokerMember.broker_instance_id];
      if (!dealerInstanceId) continue;

      const existing = dealerMembers.find(item => item.source_broker_member_id === brokerMember.id || (item.dealer_instance_id === dealerInstanceId && item.user_id === brokerMember.user_id));
      if (existing) continue;

      await base44.asServiceRole.entities.DealerMember.create({
        dealer_instance_id: dealerInstanceId,
        user_id: brokerMember.user_id,
        user_email: brokerMember.user_email,
        member_role: brokerMember.member_role,
        is_active: brokerMember.is_active !== false,
        source_broker_member_id: brokerMember.id
      });
    }

    const accountRecordTypes = ['Client Account', 'Dealer Account'];
    const contactRecordTypes = ['Client Contact', 'Dealer Contact'];

    for (const label of accountRecordTypes) {
      await ensureStandardRecordType(base44, 'Account', label);
    }
    for (const label of contactRecordTypes) {
      await ensureStandardRecordType(base44, 'Contact', label);
    }

    for (const entityName of DEALER_SCOPED_OBJECTS) {
      if (base44.asServiceRole.entities[entityName]) {
        await migrateDealerScopedEntity(base44, entityName, instanceMap);
      }
    }

    return Response.json({
      success: true,
      migrated_instances: Object.keys(instanceMap).length,
      migrated_members: (legacyMembers || []).length,
      initialized_standard_objects: STANDARD_OBJECTS,
      migrated_scoped_entities: DEALER_SCOPED_OBJECTS
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});