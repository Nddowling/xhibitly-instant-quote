import { base44 } from '@/api/base44Client';
import { BUILT_IN_OBJECTS } from './reportEngine';

const CUSTOM_SYSTEM_FIELDS = [
  { api_name: 'name', label: 'Name', field_type: 'text', is_required: true, display_order: 0 },
  { api_name: 'record_id', label: 'Record ID', field_type: 'text', is_required: false, display_order: 10 },
  { api_name: 'created_date', label: 'Created Date', field_type: 'datetime', is_required: false, display_order: 20 },
  { api_name: 'created_by', label: 'Created By', field_type: 'text', is_required: false, display_order: 30 },
  { api_name: 'last_edited_date', label: 'Last Edited Date', field_type: 'datetime', is_required: false, display_order: 40 },
  { api_name: 'last_edited_by', label: 'Last Edited By', field_type: 'text', is_required: false, display_order: 50 },
];

const HISTORY_SYSTEM_FIELDS = [
  { api_name: 'parent_record_id', label: 'Parent Record ID', field_type: 'text', is_required: true, display_order: 0 },
  { api_name: 'object_api_name', label: 'Object', field_type: 'text', is_required: true, display_order: 10 },
  { api_name: 'field_api_name', label: 'Field API Name', field_type: 'text', is_required: true, display_order: 20 },
  { api_name: 'field_label', label: 'Field Label', field_type: 'text', is_required: false, display_order: 30 },
  { api_name: 'old_value', label: 'Old Value', field_type: 'textarea', is_required: false, display_order: 40 },
  { api_name: 'new_value', label: 'New Value', field_type: 'textarea', is_required: false, display_order: 50 },
  { api_name: 'edited_date', label: 'Edited Date', field_type: 'datetime', is_required: false, display_order: 60 },
  { api_name: 'edited_by', label: 'Edited By', field_type: 'text', is_required: false, display_order: 70 },
];

export async function getAllObjects() {
  const customObjects = await base44.entities.CustomObject.list();
  const builtIn = Object.entries(BUILT_IN_OBJECTS).map(([api_name, def]) => ({
    api_name,
    label: def.label,
    label_plural: def.label,
    is_custom: false,
    allow_reports: def.allow_reports !== false,
    history_object_api_name: 'ObjectHistory',
  }));
  return [...builtIn, ...customObjects.map(o => ({ ...o, is_custom: true }))];
}

export async function getObjectFields(objectApiName) {
  if (BUILT_IN_OBJECTS[objectApiName]) {
    return Object.entries(BUILT_IN_OBJECTS[objectApiName].fields).map(([api_name, def]) => ({
      api_name,
      label: def.label,
      field_type: def.type,
      is_system: true,
      is_custom: false,
      object_api_name: objectApiName,
    }));
  }
  const customFields = await base44.entities.CustomField.filter({ object_api_name: objectApiName });
  return customFields.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}

export function buildCustomObjectApiName(label) {
  return label
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('') + '__c';
}

export function buildHistoryObjectApiName(objectApiName) {
  return objectApiName.replace(/__c$/, 'History__c');
}

export async function createCustomField(objectApiName, fieldDef) {
  const apiName = fieldDef.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') + '__c';

  const existingFields = await base44.entities.CustomField.filter({ object_api_name: objectApiName });
  const maxOrder = Math.max(0, ...existingFields.map(f => f.display_order || 0));

  return await base44.entities.CustomField.create({
    object_api_name: objectApiName,
    api_name: apiName,
    label: fieldDef.label,
    field_type: fieldDef.field_type,
    picklist_values: fieldDef.picklist_values || [],
    lookup_object: fieldDef.lookup_object,
    is_required: fieldDef.is_required || false,
    is_unique: fieldDef.is_unique || false,
    default_value: fieldDef.default_value,
    help_text: fieldDef.help_text,
    max_length: fieldDef.max_length,
    decimal_places: fieldDef.decimal_places,
    display_order: maxOrder + 10,
    is_system: false,
  });
}

export async function createCustomObject(objectDef) {
  const apiName = buildCustomObjectApiName(objectDef.label);
  const historyApiName = buildHistoryObjectApiName(apiName);

  const obj = await base44.entities.CustomObject.create({
    api_name: apiName,
    label: objectDef.label,
    label_plural: objectDef.label_plural || objectDef.label + 's',
    description: objectDef.description,
    icon: objectDef.icon || 'box',
    allow_reports: objectDef.allow_reports !== false,
    name_field_label: objectDef.name_field_label || 'Name',
    history_tracking_enabled: true,
    history_object_api_name: historyApiName,
  });

  const baseFields = CUSTOM_SYSTEM_FIELDS.map((field) => ({
    object_api_name: apiName,
    api_name: field.api_name,
    label: field.api_name === 'name' ? (objectDef.name_field_label || 'Name') : field.label,
    field_type: field.field_type,
    is_required: field.is_required,
    is_system: true,
    display_order: field.display_order,
  }));

  for (const field of baseFields) {
    await base44.entities.CustomField.create(field);
  }

  await createHistoryObjectForCustomObject({
    parentApiName: apiName,
    parentLabel: objectDef.label,
    historyApiName,
  });

  return obj;
}

export async function createHistoryObjectForCustomObject({ parentApiName, parentLabel, historyApiName }) {
  await base44.entities.CustomObject.create({
    api_name: historyApiName,
    label: `${parentLabel} History`,
    label_plural: `${parentLabel} Histories`,
    description: `Field history tracking for ${parentLabel}`,
    icon: 'history',
    allow_reports: true,
    allow_activities: false,
    name_field_label: 'History Entry',
    parent_object_api_name: parentApiName,
    is_history_object: true,
  });

  for (const field of HISTORY_SYSTEM_FIELDS) {
    await base44.entities.CustomField.create({
      object_api_name: historyApiName,
      api_name: field.api_name,
      label: field.label,
      field_type: field.field_type,
      is_required: field.is_required,
      is_system: true,
      display_order: field.display_order,
    });
  }
}