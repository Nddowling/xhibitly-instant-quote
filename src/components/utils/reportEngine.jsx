import { base44 } from '@/api/base44Client';

export const BUILT_IN_OBJECTS = {
  Order: {
    label: 'Orders',
    fields: {
      id: { label: 'Order ID', type: 'text' },
      status: { label: 'Status', type: 'picklist' },
      quoted_price: { label: 'Quoted Price', type: 'currency' },
      list_price_total: { label: 'List Price Total', type: 'currency' },
      show_name: { label: 'Show Name', type: 'text' },
      show_date: { label: 'Show Date', type: 'date' },
      booth_size: { label: 'Booth Size', type: 'text' },
      customer_name: { label: 'Customer Name', type: 'text' },
      customer_email: { label: 'Customer Email', type: 'email' },
      dealer_id: { label: 'Dealer ID', type: 'text' },
      created_date: { label: 'Created Date', type: 'datetime' },
      dealer_markup_pct: { label: 'Markup %', type: 'number' },
      customer_discount_pct: { label: 'Customer Discount %', type: 'number' },
    }
  },
  Product: {
    label: 'Products',
    fields: {
      sku: { label: 'SKU', type: 'text' },
      name: { label: 'Product Name', type: 'text' },
      category: { label: 'Category', type: 'picklist' },
      base_price: { label: 'Base Price', type: 'currency' },
      is_active: { label: 'Active', type: 'checkbox' },
    }
  },
  LineItem: {
    label: 'Quote Line Items',
    fields: {
      order_id: { label: 'Order ID', type: 'text' },
      product_name: { label: 'Product Name', type: 'text' },
      sku: { label: 'SKU', type: 'text' },
      quantity: { label: 'Quantity', type: 'number' },
      unit_price: { label: 'Unit Price', type: 'currency' },
      final_total_price: { label: 'Total Price', type: 'currency' },
      discount_pct: { label: 'Discount %', type: 'number' },
    }
  },
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