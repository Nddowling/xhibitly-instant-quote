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

  if (user.dealer_instance_id) {
    const instances = await base44.entities.DealerInstance.filter({ id: user.dealer_instance_id });
    if (instances?.length > 0) {
      return instances[0];
    }
  }

  const existingMemberships = await base44.entities.DealerMember.filter({ user_id: user.id });
  if (existingMemberships?.length > 0) {
    const membership = existingMemberships[0];
    const dealerInstanceId = membership.dealer_instance_id || membership.data?.dealer_instance_id;
    const instances = dealerInstanceId
      ? await base44.entities.DealerInstance.filter({ id: dealerInstanceId })
      : [];

    if (instances?.length > 0) {
      return instances[0];
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
  if (!user?.dealer_instance_id) return null;
  const members = await base44.entities.DealerMember.filter({
    dealer_instance_id: user.dealer_instance_id,
    user_id: user.id
  });
  return members?.[0] || null;
}

export function filterByBrokerInstance(items, dealerInstanceId, field = 'dealer_instance_id') {
  return (items || []).filter(item => item?.[field] === dealerInstanceId);
}

export async function ensureBrokerInstance(user) {
  return ensureDealerInstance(user);
}