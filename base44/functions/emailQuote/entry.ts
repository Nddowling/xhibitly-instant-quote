import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    const order = await base44.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (!order.customer_email) {
      return Response.json({ error: 'Customer email is missing' }, { status: 400 });
    }

    let shareToken = order.share_token;
    if (!shareToken) {
      shareToken = crypto.randomUUID();
      await base44.entities.Order.update(order.id, { share_token: shareToken });
    }

    const appUrl = req.headers.get('origin') || '';
    const quoteUrl = `${appUrl}/QuoteView?token=${shareToken}`;
    const customerName = order.customer_name || 'there';
    const dealerName = order.dealer_name || order.dealer_company || user.full_name || 'our team';
    const boothLabel = order.booth_size ? ` for your ${order.booth_size} booth` : '';
    const showLabel = order.show_name ? ` for ${order.show_name}` : '';

    await base44.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: `Your quote is ready${showLabel}`,
      body: `Hi ${customerName},\n\nYour exhibit quote${boothLabel}${showLabel} is ready to review.\n\nView your quote here:\n${quoteUrl}\n\nAn account representative will be reaching out shortly to walk through your quote and answer any questions.\n\nIf you have any questions in the meantime, just reply to this email and we can walk through the selected products together.\n\nThanks,\n${dealerName}`,
    });

    await base44.entities.Activity.create({
      order_id: order.id,
      activity_type: 'email',
      subject: 'Quote emailed to customer',
      description: `Quote link sent to ${order.customer_email}`,
      outcome: 'neutral',
    });

    return Response.json({ success: true, quote_url: quoteUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});