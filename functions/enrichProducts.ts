import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

const rateLimiter = new Map();
function checkRateLimit(userId, max = 15, windowMs = 3600000) {
  const now = Date.now();
  const limit = rateLimiter.get(userId) || { count: 0, reset: now + windowMs };
  if (now > limit.reset) { limit.count = 0; limit.reset = now + windowMs; }
  if (limit.count >= max) throw new Error('Rate limit exceeded');
  limit.count++;
  rateLimiter.set(userId, limit);
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (!user.is_sales_rep && user.role !== 'admin')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        checkRateLimit(user.id);

        // Fetch up to 10 products that don't have handbook_page or market_value
        // This is meant to be run multiple times (e.g., via automation or repeated clicks)
        const products = await base44.asServiceRole.entities.Product.list();
        const toEnrich = products.filter(p => !p.handbook_page || !p.market_value).slice(0, 10);
        
        if (toEnrich.length === 0) {
            return Response.json({ message: 'All products have been enriched!' });
        }

        const enriched = [];
        for (const p of toEnrich) {
            const prompt = `You need to find or estimate the market value (USD) and the page number in the "2026 Exhibitors Handbook" online for the following trade show product:
Product Name: ${p.name}
SKU: ${p.sku}
Category: ${p.category || 'N/A'}

Use the internet to search for "2026 Exhibitors Handbook ${p.name} ${p.sku} page number" and "market value for ${p.name} ${p.sku} trade show display".
If you can't find the exact page, estimate a section or put "Unknown".
For market value, give a realistic retail estimate as a number based on typical trade show display prices if you can't find an exact match. Do NOT return strings for market_value, only numbers.`;

            try {
                const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt,
                    add_context_from_internet: true,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            market_value: { type: "number" },
                            handbook_page: { type: "string" }
                        }
                    }
                });
                
                if (res) {
                    await base44.asServiceRole.entities.Product.update(p.id, {
                        market_value: res.market_value,
                        handbook_page: res.handbook_page || String(res.handbook_page)
                    });
                    enriched.push({ sku: p.sku, name: p.name, ...res });
                }
            } catch (err) {
                console.error(`Failed to enrich ${p.sku}: ${err.message}`);
            }
        }

        return Response.json({ 
            message: `Successfully enriched ${enriched.length} products. Keep calling to enrich the rest.`,
            enriched 
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});