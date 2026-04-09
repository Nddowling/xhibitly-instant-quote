import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  try {
    const base44 = createClientFromRequest(req);

    const { line_items, customer_email } = await req.json();

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return Response.json({ error: 'line_items is required' }, { status: 400 });
    }
    if (!customer_email) {
      return Response.json({ error: 'customer_email is required' }, { status: 400 });
    }

    // Fetch products server-side to verify prices (never trust client-sent prices)
    const productIds = line_items.map((i: any) => i.product_id);
    const products: any[] = [];
    for (const pid of productIds) {
      try {
        const p = await base44.asServiceRole.entities.StoreProduct.get(pid);
        products.push(p);
      } catch {
        return Response.json({ error: `Product ${pid} not found` }, { status: 400 });
      }
    }

    // Calculate total server-side
    let totalCents = 0;
    for (const item of line_items) {
      const product = products.find((p: any) => p.id === item.product_id);
      if (!product) return Response.json({ error: 'Product not found' }, { status: 400 });
      if (!product.in_stock) return Response.json({ error: `${product.name} is out of stock` }, { status: 400 });
      totalCents += Math.round(product.price * 100) * (item.quantity ?? 1);
    }

    if (totalCents < 50) {
      return Response.json({ error: 'Order total too small' }, { status: 400 });
    }

    // Create Stripe PaymentIntent
    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(totalCents),
        currency: 'usd',
        receipt_email: customer_email,
        'metadata[store]': 'recoveredge',
      }).toString(),
    });

    if (!stripeRes.ok) {
      const errData = await stripeRes.json();
      console.error('Stripe error:', errData);
      return Response.json({ error: 'Payment processing unavailable' }, { status: 502 });
    }

    const pi = await stripeRes.json();

    return Response.json({
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      total: totalCents / 100,
    });
  } catch (err) {
    console.error('createStorePaymentIntent error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
