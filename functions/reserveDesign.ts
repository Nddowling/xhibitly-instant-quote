import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id, design, quote_data } = await req.json();

    // Find the assigned sales rep (or use default notification)
    let brokerEmail = 'orders@xhibitly.com';
    let brokerName = 'Xhibitly Team';

    // Check if there's an assigned sales rep
    if (quote_data.isSalesRepQuote) {
      brokerEmail = user.email;
      brokerName = user.full_name || user.contact_name || 'Sales Rep';
    } else {
      // Try to find a sales rep for this territory
      const salesReps = await base44.asServiceRole.entities.SalesRep.filter({ is_active: true });
      if (salesReps.length > 0) {
        const assignedRep = salesReps[0]; // Simple assignment for demo
        brokerEmail = assignedRep.email;
        brokerName = assignedRep.contact_name;

        // Update order with assigned rep
        await base44.asServiceRole.entities.Order.update(order_id, {
          assigned_sales_rep_id: assignedRep.id,
          status: 'Contacted',
          status_history: [{
            status: 'Contacted',
            timestamp: new Date().toISOString(),
            notes: 'Auto-assigned to ' + brokerName,
            changed_by: 'system'
          }]
        });
      }
    }

    // Send urgent broker notification
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: brokerEmail,
      subject: `🔥 URGENT: New Design Reserved - Call within 10 minutes!`,
      body: `
URGENT: A customer just reserved a booth design!

ACTION REQUIRED: Call them within 10 minutes.

CUSTOMER DETAILS:
━━━━━━━━━━━━━━━━━━━━━━
Company: ${quote_data.dealerCompany}
Contact: ${quote_data.dealerName}
Phone: ${quote_data.dealerPhone}
Email: ${quote_data.dealerEmail}
Website: ${quote_data.websiteUrl}

DESIGN DETAILS:
━━━━━━━━━━━━━━━━━━━━━━
Design: ${design.design_name}
Tier: ${design.tier}
Booth Size: ${quote_data.boothSize}
Quoted Price: $${design.total_price?.toLocaleString()}
Show: ${quote_data.showName || 'Not specified'}
Show Date: ${quote_data.showDate}

Products Selected: ${design.product_skus?.length || 0} items

EXPERIENCE STORY:
${design.experience_story || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━
This is an automated notification from The Exhibitors' Handbook.
The customer is expecting a call within 10 minutes.
      `
    });

    // Create activity record
    await base44.asServiceRole.entities.Activity.create({
      order_id: order_id,
      activity_type: 'status_change',
      subject: 'Design Reserved - Broker Notified',
      description: `Customer reserved "${design.design_name}" (${design.tier} tier). Broker ${brokerName} notified via email.`,
      outcome: 'positive'
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      user_email: user.email,
      action: 'Order.reserve',
      entity_name: 'Order',
      entity_id: order_id,
      details: `Design "${design.design_name}" reserved. Broker ${brokerName} notified.`,
      new_value: { status: 'Contacted', assigned_to: brokerName }
    });

    return Response.json({
      success: true,
      broker_notified: brokerName,
      broker_email: brokerEmail,
      message: 'Design reserved and broker notified successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});