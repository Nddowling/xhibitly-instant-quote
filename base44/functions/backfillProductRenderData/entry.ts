import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FILE_URL = 'https://media.base44.com/files/public/69834d9e0d7220d671bfd124/db42db34d_render-backfill-data.json';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileResponse = await fetch(FILE_URL);
    if (!fileResponse.ok) {
      return Response.json({ error: 'Failed to load backfill file' }, { status: 400 });
    }

    const backfillMap = await fileResponse.json();
    const entries = Object.entries(backfillMap || {});
    const skuList = entries.map(([sku]) => sku);

    const allProducts = await base44.asServiceRole.entities.Product.list('sku', 5000);
    const productBySku = new Map(
      (allProducts || []).map((product) => [product?.sku || product?.data?.sku, product]).filter(([sku]) => Boolean(sku))
    );

    const matched = [];
    const unmatched = [];
    const updates = [];

    for (const [sku, payload] of entries) {
      const product = productBySku.get(sku);
      if (!product?.id) {
        unmatched.push(sku);
        continue;
      }

      updates.push({
        id: product.id,
        sku,
        data: {
          render_category: payload?.render_category ?? null,
          physical_description: payload?.physical_description ?? null,
          placement_zone: payload?.placement_zone ?? null,
          render_instruction: payload?.render_instruction ?? null,
          material: payload?.material ?? null,
          footprint_w_ft: payload?.footprint_w_ft ?? null,
          footprint_d_ft: payload?.footprint_d_ft ?? null,
          height_ft: payload?.height_ft ?? null,
        }
      });
    }

    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await Promise.all(batch.map((item) =>
        base44.asServiceRole.entities.Product.update(item.id, item.data)
      ));
      matched.push(...batch.map((item) => item.sku));
    }

    return Response.json({
      total_json_skus: skuList.length,
      matched_count: matched.length,
      unmatched_count: unmatched.length,
      unmatched_skus: unmatched,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});