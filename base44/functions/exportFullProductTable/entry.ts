import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await base44.entities.Product.list('sku', 5000);
    const rows = products || [];

    if (rows.length === 0) {
      return new Response('No product records found', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="product-table-export.txt"'
        }
      });
    }

    const keySet = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => keySet.add(key));
    });

    const priorityKeys = ['id', 'sku', 'name', 'category', 'subcategory', 'product_line'];
    const remainingKeys = Array.from(keySet).filter((key) => !priorityKeys.includes(key)).sort();
    const headers = [...priorityKeys.filter((key) => keySet.has(key)), ...remainingKeys];

    const csvRows = rows.map((row) => headers.map((header) => escapeCsv(row?.[header])).join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="full-product-table.csv"'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});