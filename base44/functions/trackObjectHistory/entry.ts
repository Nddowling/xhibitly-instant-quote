import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TRACKED_ENTITIES = new Set(['Product', 'Order', 'LineItem']);
const IGNORED_FIELDS = new Set(['updated_date']);

const FIELD_LABELS = {
  Product: {
    id: 'Record ID',
    created_date: 'Created Date',
    created_by: 'Created By',
    updated_date: 'Last Edited Date',
    name: 'Name',
    sku: 'SKU',
    category: 'Category',
    base_price: 'Base Price',
    is_active: 'Active'
  },
  Order: {
    id: 'Record ID',
    created_date: 'Created Date',
    created_by: 'Created By',
    updated_date: 'Last Edited Date',
    reference_number: 'Reference Number',
    status: 'Status',
    quoted_price: 'Quoted Price',
    show_name: 'Show Name',
    show_date: 'Show Date',
    booth_size: 'Booth Size',
    customer_name: 'Customer Name',
    customer_email: 'Customer Email'
  },
  LineItem: {
    id: 'Record ID',
    created_date: 'Created Date',
    created_by: 'Created By',
    updated_date: 'Last Edited Date',
    order_id: 'Order ID',
    product_name: 'Product Name',
    sku: 'SKU',
    quantity: 'Quantity',
    unit_price: 'Unit Price',
    final_total_price: 'Total Price'
  }
};

function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getRecordName(entityName, data) {
  if (entityName === 'Product') return data?.name || data?.sku || data?.id || 'Record';
  if (entityName === 'Order') return data?.reference_number || data?.show_name || data?.id || 'Record';
  if (entityName === 'LineItem') return data?.product_name || data?.sku || data?.id || 'Record';
  return data?.id || 'Record';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const payload = await req.json();

    const entityName = payload?.event?.entity_name;
    const eventType = payload?.event?.type;
    const data = payload?.data;
    const oldData = payload?.old_data || {};
    const changedFields = payload?.changed_fields || [];

    if (!TRACKED_ENTITIES.has(entityName)) {
      return Response.json({ success: true, skipped: true });
    }

    const eventBy = user?.email || data?.created_by || oldData?.created_by || 'system';
    const eventTime = new Date().toISOString();
    const recordName = getRecordName(entityName, data || oldData);

    if (eventType === 'create') {
      const createEntries = [
        {
          entity_name: entityName,
          entity_id: data.id,
          record_name: recordName,
          event_type: 'create',
          field_api_name: 'id',
          field_label: 'Record ID',
          old_value: '',
          new_value: stringifyValue(data.id),
          event_time: eventTime,
          event_by: eventBy,
          event_action: 'created'
        },
        {
          entity_name: entityName,
          entity_id: data.id,
          record_name: recordName,
          event_type: 'create',
          field_api_name: 'created_date',
          field_label: 'Created Date',
          old_value: '',
          new_value: stringifyValue(data.created_date),
          event_time: eventTime,
          event_by: eventBy,
          event_action: 'created'
        },
        {
          entity_name: entityName,
          entity_id: data.id,
          record_name: recordName,
          event_type: 'create',
          field_api_name: 'created_by',
          field_label: 'Created By',
          old_value: '',
          new_value: stringifyValue(data.created_by),
          event_time: eventTime,
          event_by: eventBy,
          event_action: 'created'
        }
      ];
      await base44.asServiceRole.entities.ObjectHistory.bulkCreate(createEntries);
      return Response.json({ success: true, created: createEntries.length });
    }

    if (eventType === 'update') {
      const fieldsToTrack = Array.from(new Set([...changedFields, 'updated_date']))
        .filter((field) => !IGNORED_FIELDS.has(field) || field === 'updated_date');

      const updates = fieldsToTrack
        .map((field) => ({
          field,
          oldValue: stringifyValue(oldData?.[field]),
          newValue: stringifyValue(data?.[field])
        }))
        .filter((entry) => entry.field === 'updated_date' || entry.oldValue !== entry.newValue)
        .map((entry) => ({
          entity_name: entityName,
          entity_id: data.id,
          record_name: recordName,
          event_type: 'update',
          field_api_name: entry.field,
          field_label: FIELD_LABELS[entityName]?.[entry.field] || entry.field,
          old_value: entry.oldValue,
          new_value: entry.newValue,
          event_time: eventTime,
          event_by: eventBy,
          event_action: entry.field === 'updated_date' ? 'updated' : `updated ${FIELD_LABELS[entityName]?.[entry.field] || entry.field}`
        }));

      if (updates.length > 0) {
        await base44.asServiceRole.entities.ObjectHistory.bulkCreate(updates);
      }

      return Response.json({ success: true, created: updates.length });
    }

    return Response.json({ success: true, skipped: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});