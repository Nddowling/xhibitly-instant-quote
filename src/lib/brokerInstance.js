import { base44 } from '@/api/base44Client';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

async function createUniqueSlug(baseName) {
  const baseSlug = slugify(baseName) || 'dealer';
  let slug = baseSlug;
  let count = 1;

  while (true) {
    const existing = await base44.entities.DealerInstance.filter({ slug });
    if (!existing?.length) return slug;
    count += 1;
    slug = `${baseSlug}-${count}`;
  }
}

export async function ensureDealerInstance(user) {
  if (!user) return null;

  const directDealerId = user.dealer_instance_id || user.active_dealer_instance_id;
  if (directDealerId) {
    const instances = await base44.entities.DealerInstance.filter({ id: directDealerId });
    if (instances?.length > 0) {
      return instances[0];
    }
  }

  const existingDealerMemberships = await base44.entities.DealerMember.filter({ user_id: user.id });
  if (existingDealerMemberships?.length > 0) {
    const membership = existingDealerMemberships[0];
    const dealerInstanceId = membership.dealer_instance_id || membership.data?.dealer_instance_id;
    const instances = dealerInstanceId
      ? await base44.entities.DealerInstance.filter({ id: dealerInstanceId })
      : [];

    if (instances?.length > 0) {
      return instances[0];
    }
  }

  const legacyBrokerId = user.broker_instance_id || user.active_broker_instance_id;
  if (legacyBrokerId) {
    const migratedDealers = await base44.entities.DealerInstance.filter({ source_broker_instance_id: legacyBrokerId });
    if (migratedDealers?.length > 0) {
      return migratedDealers[0];
    }

    const legacyBrokers = await base44.entities.BrokerInstance.filter({ id: legacyBrokerId });
    if (legacyBrokers?.length > 0) {
      return legacyBrokers[0];
    }
  }

  const legacyMemberships = await base44.entities.BrokerMember.filter({ user_id: user.id });
  if (legacyMemberships?.length > 0) {
    const membership = legacyMemberships[0];
    const brokerInstanceId = membership.broker_instance_id || membership.data?.broker_instance_id;
    const migratedDealers = brokerInstanceId
      ? await base44.entities.DealerInstance.filter({ source_broker_instance_id: brokerInstanceId })
      : [];

    if (migratedDealers?.length > 0) {
      return migratedDealers[0];
    }

    const legacyBrokers = brokerInstanceId
      ? await base44.entities.BrokerInstance.filter({ id: brokerInstanceId })
      : [];

    if (legacyBrokers?.length > 0) {
      return legacyBrokers[0];
    }
  }

  const workspaceName = user.company_name || user.contact_name || user.full_name || user.email?.split('@')[0] || 'Dealer Workspace';
  const slug = await createUniqueSlug(workspaceName);

  const instance = await base44.entities.DealerInstance.create({
    name: workspaceName,
    slug,
    owner_user_id: user.id,
    owner_email: user.email,
    company_name: user.company_name || ''
  });

  await base44.entities.DealerMember.create({
    dealer_instance_id: instance.id,
    user_id: user.id,
    user_email: user.email,
    member_role: 'owner',
    is_active: true
  });

  return instance;
}

export async function getBrokerScopedMember(user) {
  const dealerInstanceId = user?.dealer_instance_id || user?.active_dealer_instance_id;
  if (dealerInstanceId) {
    const members = await base44.entities.DealerMember.filter({
      dealer_instance_id: dealerInstanceId,
      user_id: user.id
    });
    if (members?.length) return members[0];
  }

  const brokerInstanceId = user?.broker_instance_id || user?.active_broker_instance_id;
  if (brokerInstanceId) {
    const legacyMembers = await base44.entities.BrokerMember.filter({
      broker_instance_id: brokerInstanceId,
      user_id: user.id
    });
    return legacyMembers?.[0] || null;
  }

  return null;
}

export function filterByBrokerInstance(items, dealerInstanceId, field = 'dealer_instance_id') {
  return (items || []).filter(item => item?.[field] === dealerInstanceId);
}

export async function ensureBrokerInstance(user) {
  return ensureDealerInstance(user);
}