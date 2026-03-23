import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.is_sales_rep) {
      return Response.json({ error: 'Forbidden: Sales rep access required' }, { status: 403 });
    }

    const { email, company_name, contact_name, phone } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if customer exists by searching for orders with this email
    const existingOrders = await base44.entities.Order.filter(
      { dealer_email: email },
      '-created_date',
      100
    );

    // Check if there's a User account with this email
    let userAccount = null;
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: email });
      if (users.length > 0) {
        userAccount = users[0];
      }
    } catch (e) {
      // User might not exist, that's okay
    }

    return Response.json({
      exists: existingOrders.length > 0,
      orders: existingOrders,
      userAccount: userAccount,
      customerInfo: existingOrders.length > 0 ? {
        email: existingOrders[0].dealer_email,
        company_name: existingOrders[0].dealer_company,
        contact_name: existingOrders[0].dealer_name,
        phone: existingOrders[0].dealer_phone
      } : {
        email,
        company_name,
        contact_name,
        phone
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});