import { base44 } from '@/api/base44Client';
import { BUILT_IN_OBJECTS } from './reportEngine';

export async function getAllObjects() {
  const customObjects = await base44.entities.CustomObject.list();
  const builtIn = Object.entries(BUILT_IN_OBJECTS).map(([api_name, def]) => ({
    api_name,
    label: def.label,
    label_plural: def.label,
    is_custom: false,
    allow_reports: true,
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
  const apiName = objectDef.label
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('') + '__c';

  const obj = await base44.entities.CustomObject.create({
    api_name: apiName,
    label: objectDef.label,
    label_plural: objectDef.label_plural || objectDef.label + 's',
    description: objectDef.description,
    icon: objectDef.icon || 'box',
    allow_reports: objectDef.allow_reports !== false,
    name_field_label: objectDef.name_field_label || 'Name',
  });

  await base44.entities.CustomField.create({
    object_api_name: apiName,
    api_name: 'name',
    label: objectDef.name_field_label || 'Name',
    field_type: 'text',
    is_required: true,
    is_system: true,
    display_order: 0,
  });

  return obj;
}