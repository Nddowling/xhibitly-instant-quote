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
  return await base44.entities.BrokerInstance.list('name', 500);
}

export async function setActiveBrokerInstance(brokerInstanceId) {
  await base44.auth.updateMe({ active_broker_instance_id: brokerInstanceId || '' });
}