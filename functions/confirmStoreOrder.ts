import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  try {
    const base44 = createClientFromRequest(req);

    const {
      payment_intent_id,
      customer_email,
      customer_name,
      customer_phone,
      shipping_address,
      line_items,
    } = await req.json();

    if (!payment_intent_id || !customer_email || !customer_name || !line_items) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify payment with Stripe (never trust client claim of success)
    const stripeRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment_intent_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });

    if (!stripeRes.ok) {
      return Response.json({ error: 'Could not verify payment' }, { status: 502 });
    }

    const pi = await stripeRes.json();
    if (pi.status !== 'succeeded') {
      return Response.json({ error: `Payment not completed (status: ${pi.status})` }, { status: 400 });
    }

    // Idempotency: check if order already exists for this payment intent
    const existing = await base44.asServiceRole.entities.StoreOrder.filter({
      stripe_payment_intent_id: payment_intent_id,
    });
    if (existing && existing.length > 0) {
      return Response.json({ order_id: existing[0].id, order_number: existing[0].order_number });
    }

    // Generate order number
    const allOrders = await base44.asServiceRole.entities.StoreOrder.list('-created_date', 1);
    const orderCount = (allOrders?.[0]?.order_number?.split('-')?.[2] ?? '0');
    const nextNum = String(parseInt(orderCount) + 1).padStart(5, '0');
    const order_number = `BH-${new Date().getFullYear()}-${nextNum}`;

    // Create order
    const order = await base44.asServiceRole.entities.StoreOrder.create({
      order_number,
      customer_email,
      customer_name,
      customer_phone: customer_phone ?? null,
      line_items,
      subtotal: pi.amount / 100,
      total: pi.amount / 100,
      status: 'paid',
      stripe_payment_intent_id: payment_intent_id,
      stripe_charge_id: pi.latest_charge ?? null,
      shipping_address: shipping_address ?? null,
    });

    return Response.json({ order_id: order.id, order_number });
  } catch (err) {
    console.error('confirmStoreOrder error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
