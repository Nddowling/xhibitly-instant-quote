import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { share_token } = await req.json();

    if (!share_token) {
      return Response.json({ error: 'share_token required' }, { status: 400 });
    }

    const orders = await base44.asServiceRole.entities.Order.filter({ share_token });
    if (!orders || orders.length === 0) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const order = orders[0];
    const lineItems = await base44.asServiceRole.entities.LineItem.filter({ order_id: order.id });

    return Response.json({ order, lineItems });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});