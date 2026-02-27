import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

const BRANDFETCH_API_KEY = Deno.env.get("BRANDFETCH_API_KEY");

const rateLimiter = new Map();
function checkRateLimit(userId, max = 15, windowMs = 3600000) {
  const now = Date.now();
  const limit = rateLimiter.get(userId) || { count: 0, reset: now + windowMs };
  if (now > limit.reset) { limit.count = 0; limit.reset = now + windowMs; }
  if (limit.count >= max) throw new Error('Rate limit exceeded');
  limit.count++;
  rateLimiter.set(userId, limit);
}

function extractDomain(url) {
  try {
    const cleanUrl = url.replace(/^https?:\/\/(www\.)?/, '');
    const domain = cleanUrl.split('/')[0].split('?')[0];
    return domain;
  } catch {
    return url;
  }
}

function parseBrandfetchResponse(brandfetchData) {
  if (!brandfetchData) return null;
  
  try {
    const result = {
      company_name: brandfetchData.name || null,
      primary_color: null,
      secondary_color: null,
      accent_color_1: null,
      accent_color_2: null,
      logo_url: null,
      logo_options: [],
      industry: null
    };

    if (brandfetchData.colors && brandfetchData.colors.length > 0) {
      const colors = brandfetchData.colors
        .filter(c => c.hex && c.hex.startsWith('#'))
        .map(c => c.hex.toLowerCase())
        .slice(0, 4);

      if (colors[0]) result.primary_color = colors[0];
      if (colors[1]) result.secondary_color = colors[1];
      if (colors[2]) result.accent_color_1 = colors[2];
      if (colors[3]) result.accent_color_2 = colors[3];
    }

    if (brandfetchData.logos && brandfetchData.logos.length > 0) {
      brandfetchData.logos.forEach(logo => {
        if (logo.formats && logo.formats.length > 0) {
          logo.formats.forEach(format => {
            if (format.src && (format.format === 'svg' || format.format === 'png')) {
              result.logo_options.push({
                url: format.src,
                format: format.format,
                width: format.width,
                height: format.height,
                type: logo.type || 'logo'
              });
            }
          });
        }
      });

      if (result.logo_options.length > 0) {
        result.logo_url = result.logo_options[0].url;
      }
    }

    if (brandfetchData.industries && brandfetchData.industries.length > 0) {
      result.industry = brandfetchData.industries[0];
    }

    return result;
  } catch (e) {
    return null;
  }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        checkRateLimit(user.id);

        const { website_url } = await req.json();

        if (!website_url) {
            return Response.json({ error: 'website_url is required' }, { status: 400 });
        }

        // Clean input: remove whitespace, handle "Name" vs "Name.com"
        let cleanUrl = website_url.trim();
        if (!cleanUrl.includes('.') && !cleanUrl.includes('://')) {
            cleanUrl = `${cleanUrl.replace(/\s+/g, '')}.com`;
        }

        const domain = extractDomain(cleanUrl);

        // Check if we already have it in CompanyBrand
        const existing = await base44.asServiceRole.entities.CompanyBrand.filter({ domain });
        if (existing && existing.length > 0) {
            return Response.json({ 
                source: 'database',
                brand: existing[0].brand_identity 
            });
        }

        // Otherwise fetch from Brandfetch
        const url = `https://api.brandfetch.io/v2/brands/${domain}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${BRANDFETCH_API_KEY}`
            }
        });

        if (!response.ok) {
            return Response.json({ error: `Brandfetch API returned ${response.status}` }, { status: 400 });
        }

        const data = await response.json();
        const parsed = parseBrandfetchResponse(data);

        if (parsed) {
            // Store in CompanyBrand
            await base44.asServiceRole.entities.CompanyBrand.create({
                domain,
                company_name: parsed.company_name || domain,
                brand_identity: parsed
            });

            return Response.json({
                source: 'brandfetch',
                brand: parsed
            });
        }

        return Response.json({ error: 'Failed to parse Brandfetch response' }, { status: 500 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});