import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function escapeCsv(value) {
  const text = String(value ?? '');
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

    const products = await base44.entities.Product.list('sku', 2000);
    const selectableProducts = (products || [])
      .filter((product) => product?.is_active !== false && product?.sku)
      .sort((a, b) => String(a.sku).localeCompare(String(b.sku)));

    const header = ['sku', 'name', 'category'];
    const rows = selectableProducts.map((product) => [
      escapeCsv(product.sku),
      escapeCsv(product.name),
      escapeCsv(product.category),
    ].join(','));

    const csv = [header.join(','), ...rows].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="catalog-selectable-skus.csv"'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});