import React, { useState } from 'react';
import { base44 } from '@/lib/base44';

/**
 * AI Assistant - "The Remote Control"
 *
 * Natural language interface for the 3D editor:
 * - "Add a counter in the back"
 * - "Suggest products for a tech booth"
 * - "Make it more modern"
 * - "Optimize for foot traffic"
 *
 * The AI generates suggestions that users click to apply in the editor.
 */
export default function AIAssistant({
  boothSize = '10x10',
  brandIdentity = {},
  currentProducts = [],
  onSuggestion,
  onApply
}) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Handle AI query
  const handleQuery = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);

    try {
      // Call AI function to generate suggestions
      const result = await base44.functions.call('generateBoothSuggestions', {
        query: input,
        boothSize,
        brandIdentity,
        currentProducts,
        catalogFilters: {
          is_active: true
        }
      });

      // Result format:
      // {
      //   suggestions: [
      //     {
      //       description: "Counter at back center",
      //       product: { sku, name, ... },
      //       position: { x: 5, z: 1 },
      //       rotation: 0,
      //       reasoning: "..."
      //     }
      //   ]
      // }

      setSuggestions(result.suggestions || []);
    } catch (error) {
      console.error('AI suggestion error:', error);
      // Fallback: suggest from catalog
      const fallback = await suggestFromCatalog(input);
      setSuggestions(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Fallback: Simple catalog search
  const suggestFromCatalog = async (query) => {
    try {
      const products = await base44.entities.Product.list({
        where: {
          is_active: true,
          _or: [
            { name: { _ilike: `%${query}%` } },
            { category: { _ilike: `%${query}%` } },
            { description: { _ilike: `%${query}%` } }
          ]
        },
        limit: 3
      });

      // Parse booth dimensions
      const [boothW, boothD] = boothSize.split('x').map(n => parseInt(n) || 10);

      return products.map((product, i) => ({
        description: product.name,
        product,
        position: {
          x: boothW / 2,
          z: boothD - (product.footprint_d_ft || 1)
        },
        rotation: 0,
        reasoning: 'Matching your search query'
      }));
    } catch (error) {
      console.error('Catalog search error:', error);
      return [];
    }
  };

  // Quick actions
  const quickActions = [
    { label: 'Add a counter', query: 'Add a counter at the back' },
    { label: 'Suggest banners', query: 'Suggest banner stands for the sides' },
    { label: 'Add lighting', query: 'Add lighting displays' },
    { label: 'Complete layout', query: 'Generate a complete booth layout' }
  ];

  return (
    <div className="space-y-4">
      {/* AI Chat Input */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🤖</span>
          <h3 className="font-semibold text-gray-800">AI Assistant</h3>
        </div>

        <form onSubmit={handleQuery} className="space-y-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Try: 'Add a counter at the back'"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? 'Thinking...' : 'Ask AI'}
          </button>
        </form>

        {/* Quick Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                setInput(action.query);
                // Auto-submit
                setTimeout(() => handleQuery({ preventDefault: () => {} }), 100);
              }}
              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Suggestions</h4>
          {suggestions.map((suggestion, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <h5 className="font-medium text-sm text-gray-800">
                    {suggestion.product.name}
                  </h5>
                  <p className="text-xs text-gray-500 mt-1">
                    {suggestion.description}
                  </p>
                </div>
                <button
                  onClick={() => onApply(suggestion)}
                  className="shrink-0 bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700"
                >
                  Add
                </button>
              </div>

              {/* Product Preview */}
              {suggestion.product.image_cached_url && (
                <img
                  src={suggestion.product.image_cached_url}
                  alt={suggestion.product.name}
                  className="w-full h-20 object-contain bg-gray-50 rounded"
                />
              )}

              {/* Reasoning */}
              {suggestion.reasoning && (
                <p className="text-xs text-gray-400 mt-2 italic">
                  💡 {suggestion.reasoning}
                </p>
              )}

              {/* Dimensions */}
              <div className="flex gap-3 mt-2 text-xs text-gray-500">
                {suggestion.product.footprint_w_ft && (
                  <span>W: {suggestion.product.footprint_w_ft.toFixed(1)}ft</span>
                )}
                {suggestion.product.footprint_d_ft && (
                  <span>D: {suggestion.product.footprint_d_ft.toFixed(1)}ft</span>
                )}
                {suggestion.product.height_ft && (
                  <span>H: {suggestion.product.height_ft.toFixed(1)}ft</span>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={() => setSuggestions([])}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Clear suggestions
          </button>
        </div>
      )}

      {/* Context Info */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
        <p className="font-medium mb-1">Current Context:</p>
        <ul className="space-y-1">
          <li>• Booth: {boothSize}</li>
          <li>• Products: {currentProducts.length}</li>
          {brandIdentity?.company_name && (
            <li>• Brand: {brandIdentity.company_name}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
