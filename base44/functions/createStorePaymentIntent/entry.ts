import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { line_items, customer_email } = await req.json();

    if (!STRIPE_SECRET_KEY) {
      return Response.json({ error: 'Stripe secret key is not configured' }, { status: 500 });
    }

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return Response.json({ error: 'line_items is required' }, { status: 400 });
    }

    if (!customer_email) {
      return Response.json({ error: 'customer_email is required' }, { status: 400 });
    }

    const productIds = line_items.map((item) => item.product_id);
    const products = await Promise.all(productIds.map(async (productId) => {
      const product = await base44.asServiceRole.entities.Product.get(productId);
      return product;
    }));

    let totalCents = 0;
    for (const item of line_items) {
      const product = products.find((entry) => entry.id === item.product_id);
      if (!product) {
        return Response.json({ error: 'Product not found' }, { status: 400 });
      }
      if (product.is_active === false) {
        return Response.json({ error: `${product.name} is unavailable` }, { status: 400 });
      }

      const unitPrice = Number(product.retail_price || product.base_price || product.market_value || 0);
      totalCents += Math.round(unitPrice * 100) * (item.quantity ?? 1);
    }

    if (totalCents < 50) {
      return Response.json({ error: 'Order total too small' }, { status: 400 });
    }

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
        automatic_payment_methods: 'enabled',
        'metadata[store]': 'orbus',
      }).toString(),
    });

    if (!stripeRes.ok) {
      const errData = await stripeRes.json();
      console.error('Stripe error:', errData);
      return Response.json({ error: errData?.error?.message || 'Payment processing unavailable' }, { status: 502 });
    }

    const paymentIntent = await stripeRes.json();
    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      total: totalCents / 100,
    });
  } catch (error) {
    console.error('createStorePaymentIntent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});