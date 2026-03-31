import { base44 } from '@/api/base44Client';
import { ensureBrokerInstance } from '@/lib/brokerInstance';

export async function loadBrokerContext() {
  const user = await base44.auth.me();
  const brokerInstance = await ensureBrokerInstance(user);
  const membership = brokerInstance
    ? (await base44.entities.BrokerMember.filter({ broker_instance_id: brokerInstance.id, user_id: user.id }))?.[0] || null
    : null;

  const isDesigner = user?.role === 'admin';
  const effectiveBrokerId = isDesigner
    ? (user?.active_broker_instance_id || brokerInstance?.id || user?.broker_instance_id || '')
    : (brokerInstance?.id || user?.broker_instance_id || '');

  return {
    user,
    brokerInstance,
    membership,
    isDesigner,
    effectiveBrokerId,
  };
}

export function scopeItems(items, brokerInstanceId, field = 'broker_instance_id') {
  return (items || []).filter(item => item?.[field] === brokerInstanceId);
}

export async function loadAllBrokerInstances() {
  const user = await base44.auth.me();
  const isGlobalAdmin = user?.email === 'ndowling970@gmail.com';

  if (isGlobalAdmin) {
    return await base44.entities.BrokerInstance.list('name', 500);
  }

  const memberships = await base44.entities.BrokerMember.filter({ user_id: user.id }, 'broker_instance_id', 500);
  const brokerIds = [...new Set((memberships || []).map((item) => item.broker_instance_id).filter(Boolean))];

  if (user?.broker_instance_id && !brokerIds.includes(user.broker_instance_id)) {
    brokerIds.push(user.broker_instance_id);
  }

  if (brokerIds.length === 0) {
    return [];
  }

  const allBrokers = await base44.entities.BrokerInstance.list('name', 500);
  return (allBrokers || []).filter((broker) => brokerIds.includes(broker.id));
}

export async function setActiveBrokerInstance(brokerInstanceId) {
  await base44.auth.updateMe({ active_broker_instance_id: brokerInstanceId || '' });
}