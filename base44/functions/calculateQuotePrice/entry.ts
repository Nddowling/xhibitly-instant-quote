import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { product_variant_ids, tier, booth_size, selected_service_ids } = await req.json();

    // Fetch product variants
    const allVariants = await base44.entities.ProductVariant.filter({});
    const selectedProducts = allVariants.filter(v => product_variant_ids.includes(v.id));

    // Calculate base product total
    let productSubtotal = selectedProducts.reduce((sum, p) => sum + (p.base_price || 0), 0);

    // Fetch pricing rules
    const allRules = await base44.entities.PricingRule.filter({ is_active: true });
    const applicableRules = allRules
      .filter(r => r.applies_to_tier === tier || r.applies_to_tier === 'All')
      .sort((a, b) => (a.priority || 10) - (b.priority || 10));

    // Apply pricing rules
    let designFee = 0;
    let graphicsFee = 0;
    let discount = 0;
    let promoDiscount = 0;

    for (const rule of applicableRules) {
      if (rule.rule_type === 'tier_markup') {
        if (rule.calculation_type === 'fixed_amount') {
          designFee += rule.value;
        } else if (rule.calculation_type === 'percentage') {
          designFee += productSubtotal * (rule.value / 100);
        }
      } else if (rule.rule_type === 'service_fee') {
        if (rule.calculation_type === 'percentage') {
          graphicsFee += productSubtotal * (rule.value / 100);
        } else {
          graphicsFee += rule.value;
        }
      } else if (rule.rule_type === 'volume_discount') {
        if (productSubtotal >= 10000 && rule.calculation_type === 'percentage') {
          discount += productSubtotal * (rule.value / 100);
        }
      } else if (rule.rule_type === 'promotional') {
        if (rule.calculation_type === 'percentage') {
          promoDiscount += productSubtotal * (rule.value / 100);
        }
      }
    }

    // Calculate services
    let servicesTotalCost = 0;
    const serviceBreakdown = [];
    if (selected_service_ids && selected_service_ids.length > 0) {
      const allServices = await base44.entities.Service.filter({ is_active: true });
      const selectedServices = allServices.filter(s => selected_service_ids.includes(s.id));
      
      for (const service of selectedServices) {
        let cost = service.base_cost;
        if (service.billing_unit === 'percentage_of_order') {
          cost = productSubtotal * (service.base_cost / 100);
        }
        servicesTotalCost += cost;
        serviceBreakdown.push({ id: service.id, name: service.name, cost });
      }
    }

    const subtotal = productSubtotal + designFee + graphicsFee + servicesTotalCost;
    const totalDiscount = discount + promoDiscount;
    const finalTotal = subtotal - totalDiscount;

    // Dealer commission (10% default)
    const dealerCommission = finalTotal * 0.10;

    return Response.json({
      breakdown: {
        product_subtotal: productSubtotal,
        design_fee: designFee,
        graphics_fee: graphicsFee,
        services_total: servicesTotalCost,
        service_breakdown: serviceBreakdown,
        subtotal: subtotal,
        volume_discount: discount,
        promo_discount: promoDiscount,
        total_discount: totalDiscount,
        final_total: Math.round(finalTotal * 100) / 100,
        dealer_commission: Math.round(dealerCommission * 100) / 100
      },
      products: selectedProducts.map(p => ({
        id: p.id,
        name: p.display_name,
        sku: p.manufacturer_sku,
        price: p.base_price,
        category: p.category_name
      })),
      tier,
      booth_size,
      rules_applied: applicableRules.map(r => r.name)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});