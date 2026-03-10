import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const { offset } = await req.json();
  if (!offset || typeof offset !== 'number') {
    return Response.json({ error: 'offset (number) required' }, { status: 400 });
  }

  const all = await base44.asServiceRole.entities.CatalogHotspot.list('page_number', 500);
  let updated = 0;

  for (const record of all) {
    const newPage = record.page_number + offset;
    if (newPage < 1) continue;
    await base44.asServiceRole.entities.CatalogHotspot.update(record.id, { page_number: newPage });
    updated++;
  }

  return Response.json({ success: true, updated, offset });
});