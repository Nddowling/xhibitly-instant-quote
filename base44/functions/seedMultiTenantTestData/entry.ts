import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ORDER_STATUSES = ['Pending', 'Contacted', 'Quoted', 'Negotiating', 'Ordered', 'In Production', 'Shipped', 'Accepted'];

function normalize(record) {
  return { id: record.id, ...(record.data || {}), ...record };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [dealerInstancesRaw, productsRaw] = await Promise.all([
      base44.asServiceRole.entities.DealerInstance.list('name', 500),
      base44.asServiceRole.entities.Product.list('name', 60),
    ]);

    const dealerInstances = (dealerInstancesRaw || []).map(normalize).slice(0, 50);
    const products = (productsRaw || []).map(normalize).filter(product => product.sku && product.name).slice(0, 12);

    const dealerMembersRaw = await base44.asServiceRole.entities.DealerMember.list('-created_date', 5000);
    const existingMembers = (dealerMembersRaw || []).map(normalize);
    const ordersRaw = await base44.asServiceRole.entities.Order.list('-created_date', 5000);
    const existingOrders = (ordersRaw || []).map(normalize);
    const lineItemsRaw = await base44.asServiceRole.entities.LineItem.list('-created_date', 5000);
    const existingLineItems = (lineItemsRaw || []).map(normalize);
    const contactsRaw = await base44.asServiceRole.entities.Contact.list('-created_date', 5000);
    const existingContacts = (contactsRaw || []).map(normalize);
    const accountsRaw = await base44.asServiceRole.entities.Account.list('-created_date', 5000);
    const existingAccounts = (accountsRaw || []).map(normalize);

    const summary = {
      orgsProcessed: dealerInstances.length,
      simulatedSalesRepsCreated: 0,
      contactsCreated: 0,
      accountsCreated: 0,
      ordersCreated: 0,
      lineItemsCreated: 0,
      inviteEmails: [],
    };

    for (const [orgIndex, dealer] of dealerInstances.entries()) {
      const dealerId = dealer.id;
      const dealerName = dealer.company_name || dealer.name || `Dealer ${orgIndex + 1}`;
      const dealerSlug = slugify(dealer.slug || dealerName || `dealer-${orgIndex + 1}`);
      const orgProducts = products.slice((orgIndex * 3) % Math.max(products.length - 3, 1), ((orgIndex * 3) % Math.max(products.length - 3, 1)) + 3);

      for (let repIndex = 1; repIndex <= 3; repIndex++) {
        const userEmail = `sales.${dealerSlug}.${repIndex}@test.exhibitorshandbook.local`;
        const userId = `seed-${dealerSlug}-${repIndex}`;
        const fullName = `${dealerName} Rep ${repIndex}`;
        const firstName = dealerName.split(' ')[0] || 'Sales';
        const lastName = `Rep ${repIndex}`;
        const existingMembership = existingMembers.find(member => member.dealer_instance_id === dealerId && member.user_email === userEmail);

        if (!existingMembership) {
          const createdMember = await base44.asServiceRole.entities.DealerMember.create({
            dealer_instance_id: dealerId,
            user_id: userId,
            user_email: userEmail,
            member_role: 'sales_rep',
            is_active: true,
          });
          existingMembers.push(normalize(createdMember));
          summary.simulatedSalesRepsCreated += 1;
          summary.inviteEmails.push(userEmail);
        }

        const contactEmail = `client.${dealerSlug}.${repIndex}@example.com`;
        const existingContact = existingContacts.find(contact => contact.dealer_instance_id === dealerId && contact.email === contactEmail);
        if (!existingContact) {
          const createdContact = await base44.asServiceRole.entities.Contact.create({
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            email: contactEmail,
            phone: `555-01${String(orgIndex).padStart(2, '0')}${repIndex}`,
            title: 'Marketing Director',
            department: 'Marketing',
            dealer_instance_id: dealerId,
            owner_user_id: userId,
          });
          existingContacts.push(normalize(createdContact));
          summary.contactsCreated += 1;
        }

        const accountName = `${dealerName} Client ${repIndex}`;
        const existingAccount = existingAccounts.find(account => account.dealer_instance_id === dealerId && account.name === accountName);
        if (!existingAccount) {
          const createdAccount = await base44.asServiceRole.entities.Account.create({
            name: accountName,
            company_name: accountName,
            industry: repIndex === 1 ? 'Technology' : repIndex === 2 ? 'Healthcare' : 'Manufacturing',
            phone: `555-99${String(orgIndex).padStart(2, '0')}${repIndex}`,
            email: contactEmail,
            dealer_instance_id: dealerId,
            owner_user_id: userId,
          });
          existingAccounts.push(normalize(createdAccount));
          summary.accountsCreated += 1;
        }

        for (let orderIndex = 1; orderIndex <= 2; orderIndex++) {
          const referenceNumber = `TEST-${dealerSlug.toUpperCase().slice(0, 8)}-${repIndex}${orderIndex}`;
          const existingOrder = existingOrders.find(order => order.reference_number === referenceNumber);
          if (existingOrder) {
            continue;
          }

          const status = ORDER_STATUSES[(orgIndex + repIndex + orderIndex) % ORDER_STATUSES.length];
          const boothSize = orderIndex % 2 === 0 ? '10x20' : '10x10';
          const quotedPrice = orgProducts.reduce((sum, product) => sum + Number(product.base_price || 0), 0);
          const finalPrice = quotedPrice + repIndex * 500 + orderIndex * 750;

          const createdOrder = await base44.asServiceRole.entities.Order.create({
            dealer_instance_id: dealerId,
            assigned_sales_rep_id: userId,
            dealer_company: dealerName,
            dealer_name: fullName,
            dealer_email: userEmail,
            customer_name: `${firstName} ${lastName}`,
            customer_company: accountName,
            customer_email: contactEmail,
            status,
            reference_number: referenceNumber,
            show_name: `Expo Test ${2026 + orderIndex}`,
            booth_size: boothSize,
            booth_type: boothSize === '10x20' ? 'inline' : 'corner',
            selected_tier: orderIndex % 2 === 0 ? 'Hybrid' : 'Modular',
            quoted_price: quotedPrice,
            final_price: finalPrice,
            probability: Math.min(90, 35 + repIndex * 10 + orderIndex * 5),
            expected_close_date: `2026-0${Math.min(9, repIndex + orderIndex)}-15`,
            follow_up_date: `2026-0${Math.min(9, repIndex + orderIndex)}-10`,
          });

          const normalizedOrder = normalize(createdOrder);
          existingOrders.push(normalizedOrder);
          summary.ordersCreated += 1;

          for (const product of orgProducts) {
            const alreadyExists = existingLineItems.find(item => item.order_id === normalizedOrder.id && item.sku === product.sku);
            if (alreadyExists) continue;

            const quantity = 1 + ((repIndex + orderIndex) % 2);
            const unitPrice = Number(product.base_price || 0);
            const totalPrice = unitPrice * quantity;

            const createdLineItem = await base44.asServiceRole.entities.LineItem.create({
              order_id: normalizedOrder.id,
              dealer_instance_id: dealerId,
              product_name: product.name,
              description: product.description || product.category || product.name,
              category: 'Accessories',
              quantity,
              unit_price: unitPrice,
              total_price: totalPrice,
              sku: product.sku,
              image_url: product.image_url || '',
              list_unit_price: unitPrice,
              final_unit_price: unitPrice,
              final_total_price: totalPrice,
            });
            existingLineItems.push(normalize(createdLineItem));
            summary.lineItemsCreated += 1;
          }
        }
      }
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});