import { base44 } from '@/api/base44Client';

export const BUILT_IN_OBJECTS = {
  Product: {
    label: 'Products',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      updated_date: { label: 'Last Edited Date', type: 'datetime' },
      sku: { label: 'SKU', type: 'text' },
      name: { label: 'Product Name', type: 'text' },
      category: { label: 'Category', type: 'picklist' },
      subcategory: { label: 'Subcategory', type: 'text' },
      product_line: { label: 'Product Line', type: 'text' },
      base_price: { label: 'Base Price', type: 'currency' },
      retail_price: { label: 'Retail Price', type: 'currency' },
      dealer_cost: { label: 'Dealer Cost', type: 'currency' },
      is_active: { label: 'Active', type: 'checkbox' }
    }
  },
  Order: {
    label: 'Orders',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      updated_date: { label: 'Last Edited Date', type: 'datetime' },
      reference_number: { label: 'Reference Number', type: 'text' },
      status: { label: 'Status', type: 'picklist' },
      quoted_price: { label: 'Quoted Price', type: 'currency' },
      list_price_total: { label: 'List Price Total', type: 'currency' },
      show_name: { label: 'Show Name', type: 'text' },
      show_date: { label: 'Show Date', type: 'date' },
      booth_size: { label: 'Booth Size', type: 'text' },
      customer_name: { label: 'Customer Name', type: 'text' },
      customer_email: { label: 'Customer Email', type: 'email' },
      dealer_id: { label: 'Dealer ID', type: 'text' },
      dealer_company: { label: 'Dealer Company', type: 'text' },
      assigned_sales_rep_id: { label: 'Assigned Sales Rep', type: 'text' },
      dealer_markup_pct: { label: 'Markup %', type: 'number' },
      customer_discount_pct: { label: 'Customer Discount %', type: 'number' }
    }
  },
  LineItem: {
    label: 'Quote Line Items',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      updated_date: { label: 'Last Edited Date', type: 'datetime' },
      order_id: { label: 'Order ID', type: 'text' },
      product_name: { label: 'Product Name', type: 'text' },
      description: { label: 'Description', type: 'textarea' },
      sku: { label: 'SKU', type: 'text' },
      category: { label: 'Category', type: 'picklist' },
      quantity: { label: 'Quantity', type: 'number' },
      unit_price: { label: 'Unit Price', type: 'currency' },
      total_price: { label: 'List Total', type: 'currency' },
      final_total_price: { label: 'Final Total', type: 'currency' },
      discount_pct: { label: 'Discount %', type: 'number' }
    }
  },
  Activity: {
    label: 'Activities',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      order_id: { label: 'Order ID', type: 'text' },
      sales_rep_id: { label: 'Sales Rep', type: 'text' },
      activity_type: { label: 'Activity Type', type: 'picklist' },
      subject: { label: 'Subject', type: 'text' },
      outcome: { label: 'Outcome', type: 'picklist' },
      next_action_date: { label: 'Next Action Date', type: 'date' }
    }
  },
  BrokerInstance: {
    label: 'Broker Workspaces',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      name: { label: 'Name', type: 'text' },
      slug: { label: 'Slug', type: 'text' },
      owner_email: { label: 'Owner Email', type: 'email' },
      company_name: { label: 'Company Name', type: 'text' },
      status: { label: 'Status', type: 'picklist' }
    }
  },
  BrokerMember: {
    label: 'Broker Members',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      broker_instance_id: { label: 'Broker Workspace', type: 'text' },
      user_id: { label: 'User ID', type: 'text' },
      user_email: { label: 'User Email', type: 'email' },
      member_role: { label: 'Member Role', type: 'picklist' },
      is_active: { label: 'Active', type: 'checkbox' }
    }
  },
  CatalogHotspot: {
    label: 'Catalog Hotspots',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      page_number: { label: 'Page Number', type: 'number' },
      hotspots: { label: 'Hotspots', type: 'textarea' }
    }
  },
  CustomObject: {
    label: 'Custom Objects',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      api_name: { label: 'API Name', type: 'text' },
      label: { label: 'Label', type: 'text' },
      label_plural: { label: 'Plural Label', type: 'text' },
      icon: { label: 'Icon', type: 'text' },
      allow_reports: { label: 'Allow Reports', type: 'checkbox' }
    }
  },
  CustomField: {
    label: 'Custom Fields',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      object_api_name: { label: 'Object API Name', type: 'text' },
      api_name: { label: 'API Name', type: 'text' },
      label: { label: 'Label', type: 'text' },
      field_type: { label: 'Field Type', type: 'picklist' },
      is_required: { label: 'Required', type: 'checkbox' },
      is_system: { label: 'System Field', type: 'checkbox' }
    }
  },
  CustomObjectRecord: {
    label: 'Custom Object Records',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      object_api_name: { label: 'Object API Name', type: 'text' },
      record_name: { label: 'Record Name', type: 'text' },
      last_modified_by: { label: 'Last Edited By', type: 'text' },
      last_modified_at: { label: 'Last Edited Date', type: 'datetime' }
    }
  },
  Dashboard: {
    label: 'Dashboards',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      name: { label: 'Name', type: 'text' },
      folder_name: { label: 'Folder', type: 'text' },
      is_public: { label: 'Public', type: 'checkbox' },
      last_modified_at: { label: 'Last Modified', type: 'datetime' }
    }
  },
  DashboardWidget: {
    label: 'Dashboard Widgets',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      dashboard_id: { label: 'Dashboard ID', type: 'text' },
      report_id: { label: 'Report ID', type: 'text' },
      title: { label: 'Title', type: 'text' },
      widget_type: { label: 'Widget Type', type: 'picklist' }
    }
  },
  DealerPricingSettings: {
    label: 'Dealer Pricing Settings',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      user_id: { label: 'User ID', type: 'text' },
      default_markup_pct: { label: 'Default Markup %', type: 'number' },
      max_discount_pct: { label: 'Max Discount %', type: 'number' },
      currency: { label: 'Currency', type: 'text' }
    }
  },
  PermissionSet: {
    label: 'Permission Sets',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      name: { label: 'Name', type: 'text' },
      description: { label: 'Description', type: 'textarea' }
    }
  },
  PricingRule: {
    label: 'Pricing Rules',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      name: { label: 'Name', type: 'text' },
      scope: { label: 'Scope', type: 'picklist' },
      is_active: { label: 'Active', type: 'checkbox' },
      priority: { label: 'Priority', type: 'number' }
    }
  },
  Profile: {
    label: 'Profiles',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      name: { label: 'Name', type: 'text' },
      description: { label: 'Description', type: 'textarea' },
      is_system: { label: 'System Profile', type: 'checkbox' }
    }
  },
  PromoCode: {
    label: 'Promo Codes',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      code: { label: 'Code', type: 'text' },
      discount_pct: { label: 'Discount %', type: 'number' },
      discount_fixed: { label: 'Discount Amount', type: 'currency' },
      expires_at: { label: 'Expires At', type: 'date' },
      is_used: { label: 'Used', type: 'checkbox' }
    }
  },
  Report: {
    label: 'Reports',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      name: { label: 'Name', type: 'text' },
      source_object: { label: 'Source Object', type: 'text' },
      report_type: { label: 'Report Type', type: 'picklist' },
      chart_type: { label: 'Chart Type', type: 'picklist' },
      is_public: { label: 'Public', type: 'checkbox' },
      last_run_at: { label: 'Last Run At', type: 'datetime' }
    }
  },
  SalesRep: {
    label: 'Sales Reps',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      user_id: { label: 'User ID', type: 'text' },
      email: { label: 'Email', type: 'email' },
      company_name: { label: 'Company Name', type: 'text' },
      contact_name: { label: 'Contact Name', type: 'text' },
      territory: { label: 'Territory', type: 'text' },
      total_revenue: { label: 'Total Revenue', type: 'currency' }
    }
  },
  UserPermissionAssignment: {
    label: 'User Permission Assignments',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      user_id: { label: 'User ID', type: 'text' },
      profile_id: { label: 'Profile ID', type: 'text' },
      last_computed_at: { label: 'Last Computed At', type: 'datetime' }
    }
  },
  ObjectHistory: {
    label: 'Object History',
    allow_reports: true,
    fields: {
      id: { label: 'Record ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      created_by: { label: 'Created By', type: 'text' },
      entity_name: { label: 'Entity Name', type: 'text' },
      entity_id: { label: 'Entity ID', type: 'text' },
      record_name: { label: 'Record Name', type: 'text' },
      event_type: { label: 'Event Type', type: 'picklist' },
      field_api_name: { label: 'Field API Name', type: 'text' },
      field_label: { label: 'Field Label', type: 'text' },
      old_value: { label: 'Old Value', type: 'textarea' },
      new_value: { label: 'New Value', type: 'textarea' },
      event_time: { label: 'Event Time', type: 'datetime' },
      event_by: { label: 'Event By', type: 'text' },
      event_action: { label: 'Event Action', type: 'text' }
    }
  }
};

export async function runReport(report) {
  let records = await fetchObjectRecords(report.source_object);
  records = applyFilters(records, report.filters, report.filter_logic);
  let rows = records.map(r => selectFields(r, report.selected_fields || []));

  if (report.report_type === 'summary' && report.groupings?.length > 0) {
    rows = groupAndAggregate(rows, report.groupings, report.selected_fields || []);
  } else if (report.report_type === 'matrix' && report.groupings?.length >= 2) {
    rows = buildMatrix(rows, report.groupings, report.selected_fields || []);
  }

  rows = rows.slice(0, report.row_limit || 2000);
  return { rows, total: records.length, ranAt: new Date().toISOString() };
}

async function fetchObjectRecords(objectName) {
  if (BUILT_IN_OBJECTS[objectName]) {
    return await base44.entities[objectName].list();
  }
  return await base44.entities.CustomObjectRecord.filter({ object_api_name: objectName });
}

export function applyFilters(records, filters, filterLogic) {
  if (!filters?.length) return records;
  return records.filter(record => {
    const results = filters.map(f => evaluateFilter(record, f));
    if (!filterLogic || filterLogic.trim() === '') return results.every(Boolean);
    return evaluateFilterLogic(filterLogic, results);
  });
}

function evaluateFilter(record, f) {
  const val = record[f.field];
  switch (f.operator) {
    case 'equals':           return String(val) === String(f.value);
    case 'not_equals':       return String(val) !== String(f.value);
    case 'contains':         return String(val || '').toLowerCase().includes(String(f.value).toLowerCase());
    case 'not_contains':     return !String(val || '').toLowerCase().includes(String(f.value).toLowerCase());
    case 'starts_with':      return String(val || '').toLowerCase().startsWith(String(f.value).toLowerCase());
    case 'greater_than':     return Number(val) > Number(f.value);
    case 'less_than':        return Number(val) < Number(f.value);
    case 'greater_or_equal': return Number(val) >= Number(f.value);
    case 'less_or_equal':    return Number(val) <= Number(f.value);
    case 'is_null':          return val == null || val === '';
    case 'is_not_null':      return val != null && val !== '';
    case 'in':               return (f.value || '').split(',').map(s => s.trim()).includes(String(val));
    case 'last_n_days':      return new Date(val) >= new Date(Date.now() - Number(f.value) * 86400000);
    default: return true;
  }
}

function evaluateFilterLogic(logic, results) {
  let expr = logic.replace(/\b(\d+)\b/g, (_, n) => results[Number(n) - 1] ? 'true' : 'false');
  expr = expr.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||').replace(/\bNOT\b/gi, '!');
  try { return new Function(`return ${expr}`)(); } catch { return true; }
}

function selectFields(record, selectedFields) {
  const row = {};
  for (const f of selectedFields) {
    row[f.field] = record[f.field] ?? null;
  }
  return row;
}

function groupAndAggregate(rows, groupings, selectedFields) {
  const groupField = groupings[0].field;
  const groups = {};
  for (const row of rows) {
    const key = row[groupField] ?? '(blank)';
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return Object.entries(groups).map(([key, groupRows]) => {
    const result = { [groupField]: key, _count: groupRows.length };
    for (const f of selectedFields) {
      if (f.aggregate) {
        result[`${f.field}_${f.aggregate}`] = computeAggregate(groupRows, f.field, f.aggregate);
      }
    }
    result._rows = groupRows;
    return result;
  });
}

export function computeAggregate(rows, field, agg) {
  const vals = rows.map(r => Number(r[field])).filter(v => !isNaN(v));
  switch (agg) {
    case 'sum':   return vals.reduce((a, b) => a + b, 0);
    case 'avg':   return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    case 'min':   return Math.min(...vals);
    case 'max':   return Math.max(...vals);
    case 'count': return rows.length;
    default:      return rows.length;
  }
}

function buildMatrix(rows, groupings, selectedFields) {
  const rowField = groupings[0].field;
  const colField = groupings[1].field;
  const valueField = selectedFields.find(f => f.aggregate);
  const colValues = [...new Set(rows.map(r => r[colField] ?? '(blank)'))].sort();
  const rowGroups = {};
  for (const row of rows) {
    const rk = row[rowField] ?? '(blank)';
    const ck = row[colField] ?? '(blank)';
    if (!rowGroups[rk]) rowGroups[rk] = {};
    if (!rowGroups[rk][ck]) rowGroups[rk][ck] = [];
    rowGroups[rk][ck].push(row);
  }
  return Object.entries(rowGroups).map(([rk, cols]) => {
    const matrixRow = { [rowField]: rk };
    for (const ck of colValues) {
      const cellRows = cols[ck] || [];
      matrixRow[ck] = valueField
        ? computeAggregate(cellRows, valueField.field, valueField.aggregate)
        : cellRows.length;
    }
    matrixRow._colValues = colValues;
    return matrixRow;
  });
}