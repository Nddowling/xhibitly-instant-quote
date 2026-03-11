// ─── Pricing Engine — CPQ-style rules evaluator ───────────────────────────────

export function runPricingEngine({ order, lineItems, rules, dealerSettings, promoCode = null }) {
  let items = lineItems.map(i => ({
    ...i,
    computed_unit_price: i.list_unit_price || i.unit_price,
    computed_total: (i.list_unit_price || i.unit_price) * (i.quantity || 1),
    rule_discount_amount: 0,
  }));

  const activeRules = (rules || [])
    .filter(r => r.is_active)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  let quoteRuleDiscountPct = 0;
  let quoteRuleDiscountFixed = 0;
  const appliedRuleIds = [];
  const generatedPromos = [];
  let exclusiveTriggered = false;

  for (const rule of activeRules) {
    if (exclusiveTriggered) break;
    const conditionsMet = evaluateConditions(rule.conditions, rule.condition_logic, order, items);
    if (!conditionsMet) continue;

    for (const action of (rule.actions || [])) {
      applyAction(action, items, result => {
        quoteRuleDiscountPct += result.quoteDiscountPct || 0;
        quoteRuleDiscountFixed += result.quoteDiscountFixed || 0;
        if (result.promo) generatedPromos.push(result.promo);
      });
    }

    appliedRuleIds.push(rule.id);
    if (rule.exclusive) exclusiveTriggered = true;
    if (!rule.stackable) break;
  }

  const markupPct = order.dealer_markup_pct ?? dealerSettings?.default_markup_pct ?? 0;
  const customerDiscountPct = order.customer_discount_pct ?? 0;

  const itemResults = items.map(item => {
    const itemMarkupPct = item.markup_pct ?? markupPct;
    const itemDiscountPct = item.discount_pct ?? 0;
    const afterMarkup = item.computed_unit_price * (1 + itemMarkupPct / 100);
    const afterDiscount = afterMarkup * (1 - itemDiscountPct / 100);
    const ruleDiscount = item.rule_discount_amount;
    const finalUnit = Math.max(0, afterDiscount - (ruleDiscount / (item.quantity || 1)));
    return {
      ...item,
      final_unit_price: parseFloat(finalUnit.toFixed(2)),
      final_total_price: parseFloat((finalUnit * (item.quantity || 1)).toFixed(2)),
    };
  });

  const listTotal = itemResults.reduce((s, i) => s + (i.list_unit_price || i.unit_price) * (i.quantity || 1), 0);
  const subtotalAfterItems = itemResults.reduce((s, i) => s + i.final_total_price, 0);
  const markupAmount = subtotalAfterItems - listTotal;

  const ruleDiscountOnQuote = (subtotalAfterItems * quoteRuleDiscountPct / 100) + quoteRuleDiscountFixed;
  const afterRuleDiscount = Math.max(0, subtotalAfterItems - ruleDiscountOnQuote);

  const customerDiscountAmount = afterRuleDiscount * customerDiscountPct / 100;
  const afterCustomerDiscount = Math.max(0, afterRuleDiscount - customerDiscountAmount);

  let promoDiscountAmount = 0;
  if (promoCode) {
    promoDiscountAmount = calculatePromoDiscount(promoCode, afterCustomerDiscount, itemResults);
  }

  const finalTotal = Math.max(0, afterCustomerDiscount - promoDiscountAmount);
  const totalRuleDiscount = ruleDiscountOnQuote + itemResults.reduce((s, i) => s + (i.rule_discount_amount || 0), 0);

  return {
    itemResults,
    appliedRuleIds,
    generatedPromos,
    listTotal: parseFloat(listTotal.toFixed(2)),
    markupAmount: parseFloat(Math.max(0, markupAmount).toFixed(2)),
    ruleDiscountAmount: parseFloat(totalRuleDiscount.toFixed(2)),
    customerDiscountAmount: parseFloat(customerDiscountAmount.toFixed(2)),
    promoDiscountAmount: parseFloat(promoDiscountAmount.toFixed(2)),
    finalTotal: parseFloat(finalTotal.toFixed(2)),
  };
}

function evaluateConditions(conditions, logic, order, items) {
  if (!conditions || conditions.length === 0) return true;
  const results = conditions.map(c => ({ id: c.id, result: evalCondition(c, order, items) }));
  const expr = (logic || 'ALL').trim().toUpperCase();
  if (expr === 'ALL') return results.every(r => r.result);
  if (expr === 'ANY') return results.some(r => r.result);
  return parseBoolExpr(expr, results);
}

function evalCondition(cond, order, items) {
  switch (cond.type) {
    case 'quantity_of_sku_gte': {
      const qty = items.filter(i => i.sku === cond.target).reduce((s, i) => s + (i.quantity || 1), 0);
      return qty >= Number(cond.value);
    }
    case 'quantity_of_category_gte': {
      const qty = items.filter(i => i.category === cond.target).reduce((s, i) => s + (i.quantity || 1), 0);
      return qty >= Number(cond.value);
    }
    case 'has_sku':
      return items.some(i => i.sku === cond.target);
    case 'has_category':
      return items.some(i => i.category === cond.target);
    case 'quote_total_gte': {
      const total = items.reduce((s, i) => s + i.computed_total, 0);
      return total >= Number(cond.value);
    }
    case 'quote_total_lte': {
      const total = items.reduce((s, i) => s + i.computed_total, 0);
      return total <= Number(cond.value);
    }
    case 'promo_code_applied':
      return !!order.promo_code_applied;
    default:
      return false;
  }
}

function parseBoolExpr(expr, results) {
  const byId = Object.fromEntries(results.map(r => [String(r.id), r.result]));
  let normalized = expr;
  for (const [id, val] of Object.entries(byId)) {
    normalized = normalized.replace(new RegExp(`\\b${id}\\b`, 'g'), val ? 'T' : 'F');
  }
  return evalTokens(normalized.trim());
}

function evalTokens(expr) {
  const orParts = splitOuter(expr, 'OR');
  if (orParts.length > 1) return orParts.some(p => evalTokens(p.trim()));
  const andParts = splitOuter(expr, 'AND');
  if (andParts.length > 1) return andParts.every(p => evalTokens(p.trim()));
  if (expr.startsWith('(') && expr.endsWith(')')) return evalTokens(expr.slice(1, -1).trim());
  return expr === 'T';
}

function splitOuter(expr, op) {
  const parts = []; let depth = 0; let cur = '';
  const words = expr.split(/\s+/);
  for (const w of words) {
    if (w === '(') { depth++; cur += ' ('; }
    else if (w === ')') { depth--; cur += ') '; }
    else if (w === op && depth === 0) { parts.push(cur.trim()); cur = ''; }
    else { cur += (cur ? ' ' : '') + w; }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function applyAction(action, items, onQuoteEffect) {
  switch (action.type) {
    case 'discount_pct': {
      if (action.target === 'quote') {
        onQuoteEffect({ quoteDiscountPct: Number(action.value) });
      } else {
        const targets = items.filter(i =>
          (action.target === 'sku' && i.sku === action.target_value) ||
          (action.target === 'category' && i.category === action.target_value) ||
          action.target === 'line_item'
        );
        targets.forEach(i => { i.rule_discount_amount += i.computed_total * Number(action.value) / 100; });
      }
      break;
    }
    case 'discount_fixed': {
      if (action.target === 'quote') {
        onQuoteEffect({ quoteDiscountFixed: Number(action.value) });
      } else {
        const targets = items.filter(i =>
          (action.target === 'sku' && i.sku === action.target_value) ||
          (action.target === 'category' && i.category === action.target_value)
        );
        if (targets.length) {
          const perItem = Number(action.value) / targets.length;
          targets.forEach(i => { i.rule_discount_amount += perItem; });
        }
      }
      break;
    }
    case 'nth_item_discount': {
      const n = Number(action.nth_item) || 3;
      const pct = Number(action.value) / 100;
      const targets = items.filter(i =>
        !action.target_value ||
        i.sku === action.target_value ||
        i.category === action.target_value
      );
      let unitsSeen = 0;
      targets.forEach(i => {
        const qty = i.quantity || 1;
        let discountUnits = 0;
        for (let u = 0; u < qty; u++) {
          unitsSeen++;
          if (unitsSeen % n === 0) discountUnits++;
        }
        i.rule_discount_amount += discountUnits * i.computed_unit_price * pct;
      });
      break;
    }
    case 'generate_promo': {
      if (action.promo_config) {
        onQuoteEffect({
          promo: {
            code: generatePromoCode(),
            discount_pct: action.promo_config.discount_pct,
            applies_to: action.promo_config.applies_to,
            applies_to_value: action.promo_config.applies_to_value,
            expires_days: action.promo_config.expires_days || 90,
            message: action.promo_config.message,
          }
        });
      }
      break;
    }
    default: break;
  }
}

function calculatePromoDiscount(promoCode, subtotal, items) {
  if (promoCode.applies_to === 'quote') {
    return subtotal * (promoCode.discount_pct || 0) / 100 + (promoCode.discount_fixed || 0);
  }
  if (promoCode.applies_to === 'category') {
    const catTotal = items.filter(i => i.category === promoCode.applies_to_value).reduce((s, i) => s + i.final_total_price, 0);
    return catTotal * (promoCode.discount_pct || 0) / 100;
  }
  if (promoCode.applies_to === 'sku') {
    const skuTotal = items.filter(i => i.sku === promoCode.applies_to_value).reduce((s, i) => s + i.final_total_price, 0);
    return skuTotal * (promoCode.discount_pct || 0) / 100;
  }
  return 0;
}

export function generatePromoCode() {
  return Array.from({ length: 8 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');
}