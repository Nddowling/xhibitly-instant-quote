import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { buildVisualQuoteConfiguration, configurationFingerprint, stableStringify } from '@/lib/visualQuoteConfiguration';

async function loadAuthoritativeProject(orderId) {
  const order = await base44.entities.Order.get(orderId);
  const [lineItems, linkedDesigns] = await Promise.all([
    base44.entities.LineItem.filter({ order_id: orderId }, 'created_date', 500),
    base44.entities.BoothDesign.filter({ order_id: orderId }, '-updated_date', 1),
  ]);

  let boothDesign = linkedDesigns?.[0] || null;
  if (!boothDesign && order?.selected_booth_design_id) {
    boothDesign = await base44.entities.BoothDesign.get(order.selected_booth_design_id);
  }
  return { order, lineItems: lineItems || [], boothDesign };
}

async function saveSnapshot(orderId, fallbackStage, retry = true) {
  const authoritative = await loadAuthoritativeProject(orderId);
  const currentVersion = Number(authoritative.order?.configuration_version || 0);
  const fingerprint = configurationFingerprint(authoritative);
  const materialChanged = authoritative.order?.visual_quote_fingerprint !== fingerprint;
  const nextVersion = materialChanged ? currentVersion + 1 : currentVersion;
  const workflowStage = authoritative.order?.workflow_stage || fallbackStage || 'products';
  const configuration = buildVisualQuoteConfiguration({
    ...authoritative,
    configurationVersion: nextVersion,
  });

  const alreadyCurrent = authoritative.order?.visual_quote_fingerprint === fingerprint &&
    authoritative.order?.visual_quote_configuration?.configuration_version === nextVersion &&
    authoritative.order?.workflow_stage === workflowStage;
  if (alreadyCurrent) return { configuration, version: nextVersion, order: authoritative.order };

  const payload = {
    visual_quote_configuration: configuration,
    visual_quote_fingerprint: fingerprint,
    workflow_stage: workflowStage,
    configuration_version: nextVersion,
    last_autosaved_at: new Date().toISOString(),
  };

  if (!authoritative.order?.visual_quote_fingerprint || authoritative.order?.configuration_version === undefined || authoritative.order?.configuration_version === null) {
    await base44.entities.Order.update(orderId, payload);
  } else {
    await base44.entities.Order.updateMany(
      { id: orderId, configuration_version: currentVersion },
      { $set: payload }
    );
  }

  const confirmed = await base44.entities.Order.get(orderId);
  if (confirmed?.visual_quote_fingerprint !== fingerprint || Number(confirmed?.configuration_version || 0) !== nextVersion) {
    if (retry) return saveSnapshot(orderId, fallbackStage, false);
    throw new Error('This project changed elsewhere. Reload before continuing.');
  }
  return { configuration, version: nextVersion, order: confirmed };
}

export default function useVisualQuoteProject({ order, lineItems = [], workflowStage = 'products' }) {
  const [saveStatus, setSaveStatus] = useState('idle');
  const [configurationVersion, setConfigurationVersion] = useState(Number(order?.configuration_version || 0));
  const [configuration, setConfiguration] = useState(order?.visual_quote_configuration || null);
  const queueRef = useRef(Promise.resolve());

  const requestSave = useCallback(() => {
    if (!order?.id) return Promise.resolve(null);
    setSaveStatus('saving');
    queueRef.current = queueRef.current
      .catch(() => null)
      .then(() => saveSnapshot(order.id, workflowStage))
      .then((result) => {
        if (result) {
          setConfiguration(result.configuration);
          setConfigurationVersion(result.version);
        }
        setSaveStatus('saved');
        return result;
      })
      .catch((error) => {
        setSaveStatus('error');
        throw error;
      });
    return queueRef.current;
  }, [order?.id, workflowStage]);

  const changeToken = stableStringify({
    order: order ? {
      updated_date: order.updated_date,
      workflow_stage: order.workflow_stage,
      quoted_price: order.quoted_price,
      final_price: order.final_price,
    } : null,
    lineItems: lineItems.map((item) => ({
      id: item.id,
      updated_date: item.updated_date,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    })),
  });

  useEffect(() => {
    if (!order?.id) {
      setSaveStatus('idle');
      setConfiguration(null);
      setConfigurationVersion(0);
      return undefined;
    }
    const timer = window.setTimeout(() => requestSave().catch(() => {}), 600);
    return () => window.clearTimeout(timer);
  }, [order?.id, changeToken, requestSave]);

  return { saveStatus, configurationVersion, configuration, requestSave };
}