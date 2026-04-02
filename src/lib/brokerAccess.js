import { base44 } from '@/api/base44Client';
import { ensureDealerInstance } from '@/lib/brokerInstance';

export async function loadBrokerContext() {
  const user = await base44.auth.me();
  const dealerInstance = await ensureDealerInstance(user);
  const membership = dealerInstance
    ? (await base44.entities.DealerMember.filter({ dealer_instance_id: dealerInstance.id, user_id: user.id }))?.[0] || null
    : null;

  const isDesigner = user?.role === 'admin';
  const hasExplicitGlobalSelection = user?.active_dealer_instance_id === '' || user?.active_broker_instance_id === '';
  const effectiveDealerId = isDesigner
    ? (hasExplicitGlobalSelection ? '' : (user?.active_dealer_instance_id || dealerInstance?.id || user?.dealer_instance_id || ''))
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
  const legacyField = field === 'dealer_instance_id' ? 'broker_instance_id' : field;
  return (items || []).filter(item => {
    const recordValue = item?.[field] || item?.[legacyField] || item?.data?.[field] || item?.data?.[legacyField];
    return recordValue === dealerInstanceId;
  });
}

export async function loadAllBrokerInstances() {
  const user = await base44.auth.me();
  const isGlobalAdmin = user?.email === 'ndowling970@gmail.com';

  if (isGlobalAdmin) {
    const allDealers = await base44.entities.DealerInstance.list('name', 500);
    return allDealers?.length ? allDealers : await base44.entities.BrokerInstance.list('name', 500);
  }

  const dealerMemberships = await base44.entities.DealerMember.filter({ user_id: user.id }, 'dealer_instance_id', 500);
  const dealerIds = [...new Set((dealerMemberships || []).map((item) => item.dealer_instance_id || item.data?.dealer_instance_id).filter(Boolean))];

  const fallbackDealerId = user?.dealer_instance_id || user?.active_dealer_instance_id;
  if (fallbackDealerId && !dealerIds.includes(fallbackDealerId)) {
    dealerIds.push(fallbackDealerId);
  }

  if (dealerIds.length > 0) {
    const allDealers = await base44.entities.DealerInstance.list('name', 500);
    return (allDealers || []).filter((dealer) => dealerIds.includes(dealer.id));
  }

  const legacyMemberships = await base44.entities.BrokerMember.filter({ user_id: user.id }, 'broker_instance_id', 500);
  const brokerIds = [...new Set((legacyMemberships || []).map((item) => item.broker_instance_id || item.data?.broker_instance_id).filter(Boolean))];
  const fallbackBrokerId = user?.broker_instance_id || user?.active_broker_instance_id;
  if (fallbackBrokerId && !brokerIds.includes(fallbackBrokerId)) {
    brokerIds.push(fallbackBrokerId);
  }

  if (brokerIds.length === 0) {
    return [];
  }

  return await base44.entities.BrokerInstance.list('name', 500);
}

export async function setActiveBrokerInstance(dealerInstanceId) {
  await base44.auth.updateMe({
    active_dealer_instance_id: dealerInstanceId || '',
    active_broker_instance_id: dealerInstanceId || ''
  });
}