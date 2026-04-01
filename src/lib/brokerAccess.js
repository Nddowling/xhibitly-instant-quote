import { base44 } from '@/api/base44Client';
import { ensureDealerInstance } from '@/lib/brokerInstance';

export async function loadBrokerContext() {
  const user = await base44.auth.me();
  const dealerInstance = await ensureDealerInstance(user);
  const membership = dealerInstance
    ? (await base44.entities.DealerMember.filter({ dealer_instance_id: dealerInstance.id, user_id: user.id }))?.[0] || null
    : null;

  const isDesigner = user?.role === 'admin';
  const effectiveDealerId = isDesigner
    ? (user?.active_dealer_instance_id || dealerInstance?.id || user?.dealer_instance_id || '')
    : (dealerInstance?.id || user?.dealer_instance_id || '');

  return {
    user,
    brokerInstance: dealerInstance,
    dealerInstance,
    membership,
    isDesigner,
    effectiveBrokerId: effectiveDealerId,
    effectiveDealerId,
  };
}

export function scopeItems(items, dealerInstanceId, field = 'dealer_instance_id') {
  return (items || []).filter(item => item?.[field] === dealerInstanceId);
}

export async function loadAllBrokerInstances() {
  const user = await base44.auth.me();
  const isGlobalAdmin = user?.email === 'ndowling970@gmail.com';

  if (isGlobalAdmin) {
    return await base44.entities.DealerInstance.list('name', 500);
  }

  const memberships = await base44.entities.DealerMember.filter({ user_id: user.id }, 'dealer_instance_id', 500);
  const dealerIds = [...new Set((memberships || []).map((item) => item.dealer_instance_id || item.data?.dealer_instance_id).filter(Boolean))];

  const fallbackDealerId = user?.dealer_instance_id || user?.active_dealer_instance_id;
  if (fallbackDealerId && !dealerIds.includes(fallbackDealerId)) {
    dealerIds.push(fallbackDealerId);
  }

  if (dealerIds.length === 0) {
    return [];
  }

  const allDealers = await base44.entities.DealerInstance.list('name', 500);
  return (allDealers || []).filter((dealer) => dealerIds.includes(dealer.id));
}

export async function setActiveBrokerInstance(dealerInstanceId) {
  await base44.auth.updateMe({ active_dealer_instance_id: dealerInstanceId || '' });
}