/**
 * Catalog Search Utilities
 *
 * Provides semantic and keyword search across the Exhibitor's Handbook PDF catalog.
 * Supports:
 * - Page number lookup
 * - Keyword search
 * - Semantic vector search
 * - Product matching
 */

import { OpenAI } from 'openai';
import { base44 } from '../api/base44Client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Search catalog by page number
 *
 * @param {number} pageNumber - Page number to retrieve
 * @returns {Promise<Object|null>} CatalogPage entity or null
 */
export async function searchByPageNumber(pageNumber) {
  try {
    const results = await base44.entities.CatalogPage.filter({
      page_number: pageNumber
    });

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[CatalogSearch] Page lookup failed:', error);
    return null;
  }
}

/**
 * Search catalog by product query (semantic + keyword)
 *
 * @param {string} query - Natural language query (e.g., "LED light boxes")
 * @param {Object} options - Search options
 * @param {number} options.limit - Max results (default: 5)
 * @param {number} options.pageNumber - Optional page number to search within
 * @returns {Promise<Array>} Array of matching products with page info
 */
export async function searchProducts(query, options = {}) {
  const { limit = 5, pageNumber = null } = options;

  try {
    let pages = [];

    // If page number specified, search that page only
    if (pageNumber) {
      const page = await searchByPageNumber(pageNumber);
      if (page) pages = [page];
    } else {
      // Semantic search across all pages
      pages = await semanticSearch(query, { limit: 10 });
    }

    // Extract and score products
    const allProducts = [];

    for (const page of pages) {
      if (!page.products || page.products.length === 0) continue;

      for (const product of page.products) {
        const score = scoreProduct(product, query);

        allProducts.push({
          ...product,
          page_number: page.page_number,
          page_image_url: page.page_image_url,
          relevance_score: score
        });
      }
    }

    // Sort by relevance and return top results
    return allProducts
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);

  } catch (error) {
    console.error('[CatalogSearch] Product search failed:', error);
    return [];
  }
}

/**
 * Semantic search using vector embeddings
 *
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.limit - Max results (default: 5)
 * @returns {Promise<Array>} Array of CatalogPage entities sorted by relevance
 */
export async function semanticSearch(query, options = {}) {
  const { limit = 5 } = options;

  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    if (!embedding) {
      console.warn('[CatalogSearch] Embedding generation failed, falling back to keyword search');
      return keywordSearch(query, options);
    }

    // Fetch all pages with embeddings
    const allPages = await base44.entities.CatalogPage.list();

    // Calculate cosine similarity for each page
    const scoredPages = allPages
      .filter(page => page.embedding_vector && page.embedding_vector.length > 0)
      .map(page => ({
        ...page,
        similarity: cosineSimilarity(embedding, page.embedding_vector)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scoredPages;

  } catch (error) {
    console.error('[CatalogSearch] Semantic search failed:', error);
    return keywordSearch(query, options);
  }
}

/**
 * Keyword search (fallback when embeddings unavailable)
 *
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of CatalogPage entities
 */
export async function keywordSearch(query, options = {}) {
  const { limit = 5 } = options;

  try {
    const allPages = await base44.entities.CatalogPage.list();
    const keywords = query.toLowerCase().split(' ');

    // Score pages by keyword matches
    const scoredPages = allPages
      .map(page => {
        const text = (page.page_text || '').toLowerCase();
        let score = 0;

        for (const keyword of keywords) {
          const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
          score += matches;
        }

        return { ...page, keyword_score: score };
      })
      .filter(page => page.keyword_score > 0)
      .sort((a, b) => b.keyword_score - a.keyword_score)
      .slice(0, limit);

    return scoredPages;

  } catch (error) {
    console.error('[CatalogSearch] Keyword search failed:', error);
    return [];
  }
}

/**
 * Score a product's relevance to a query
 *
 * @param {Object} product - Product object
 * @param {string} query - Search query
 * @returns {number} Relevance score (0-100)
 */
function scoreProduct(product, query) {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(' ');

  let score = 0;

  // Exact name match: +50
  if (product.name && product.name.toLowerCase().includes(queryLower)) {
    score += 50;
  }

  // Category match: +30
  if (product.category && product.category.toLowerCase().includes(queryLower)) {
    score += 30;
  }

  // Description keyword matches: +5 each
  if (product.description) {
    const descLower = product.description.toLowerCase();
    for (const keyword of keywords) {
      if (descLower.includes(keyword)) {
        score += 5;
      }
    }
  }

  // SKU match: +20
  if (product.sku && product.sku.toLowerCase().includes(queryLower)) {
    score += 20;
  }

  return Math.min(score, 100);
}

/**
 * Generate embedding for text
 *
 * @param {string} text - Text to embed
 * @returns {Promise<Array|null>} Embedding vector or null
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000)
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[CatalogSearch] Embedding generation failed:', error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 *
 * @param {Array} vecA - First vector
 * @param {Array} vecB - Second vector
 * @returns {number} Similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find products by category
 *
 * @param {string} category - Category name (e.g., "Lighting", "Backwalls")
 * @returns {Promise<Array>} Array of products in that category
 */
export async function searchByCategory(category) {
  try {
    const allPages = await base44.entities.CatalogPage.list();
    const products = [];

    for (const page of allPages) {
      if (!page.products) continue;

      const matching = page.products.filter(p =>
        p.category && p.category.toLowerCase().includes(category.toLowerCase())
      );

      for (const product of matching) {
        products.push({
          ...product,
          page_number: page.page_number,
          page_image_url: page.page_image_url
        });
      }
    }

    return products;
  } catch (error) {
    console.error('[CatalogSearch] Category search failed:', error);
    return [];
  }
}
