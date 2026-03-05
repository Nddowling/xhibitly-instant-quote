import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, useTexture } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Product Mesh Component
 * Renders a single product with texture from Supabase
 */
function ProductMesh({ product, position, onRemove }) {
  const w = product.footprint_w_ft || 2;
  const h = product.height_ft || 6;
  const d = product.footprint_d_ft || 0.5;

  // Load texture from Supabase URL
  const texture = product.primary_image_url
    ? useTexture(product.primary_image_url)
    : null;

  // Create materials with texture on front face
  const materials = [
    <meshStandardMaterial key="right" color="#cccccc" />, // right
    <meshStandardMaterial key="left" color="#cccccc" />,  // left
    <meshStandardMaterial key="top" color="#cccccc" />,   // top
    <meshStandardMaterial key="bottom" color="#cccccc" />, // bottom
    texture
      ? <meshStandardMaterial key="front" map={texture} />  // front with image
      : <meshStandardMaterial key="front" color="#4a90e2" />,
    <meshStandardMaterial key="back" color="#cccccc" />   // back
  ];

  return (
    <mesh
      position={position}
      castShadow
      receiveShadow
      onClick={() => onRemove?.(product.id)}
    >
      <boxGeometry args={[w, h, d]} />
      {materials}
    </mesh>
  );
}

/**
 * Booth Floor with Grid
 */
function BoothFloor({ width, depth }) {
  return (
    <>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.8} />
      </mesh>

      {/* Grid */}
      <Grid
        args={[Math.max(width, depth), Math.max(width, depth)]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#cccccc"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#999999"
        fadeDistance={50}
        fadeStrength={1}
        position={[0, 0.01, 0]}
      />

      {/* Booth Boundary */}
      <line position={[0, 0.02, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(width, depth)]} />
        <lineBasicMaterial color="#0066cc" linewidth={2} />
      </line>
    </>
  );
}

/**
 * Scene Lighting
 */
function Lighting({ boothWidth, boothDepth }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[boothWidth, boothWidth * 2, boothDepth]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
    </>
  );
}

/**
 * React Three Fiber Booth Editor - "The TV"
 *
 * Modern 3D booth editor using R3F for better React integration
 */
export default function BoothEditor3D_R3F({
  boothSize = '10x10',
  brandIdentity = {},
  onLayoutChange,
  aiSuggestions = [],
  availableProducts = [] // Products from Base44
}) {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Parse booth dimensions
  const [boothW, boothD] = boothSize.split('x').map(n => parseInt(n) || 10);

  // Add product to scene
  const addProduct = (product, position = { x: 0, y: 0, z: 0 }) => {
    const newProduct = {
      id: Date.now(),
      ...product,
      position: {
        x: position.x || 0,
        y: position.y || (product.height_ft || 4) / 2,
        z: position.z || 0
      }
    };

    const updated = [...products, newProduct];
    setProducts(updated);
    onLayoutChange?.(updated);
  };

  // Remove product
  const removeProduct = (productId) => {
    const updated = products.filter(p => p.id !== productId);
    setProducts(updated);
    onLayoutChange?.(updated);
  };

  // Apply AI suggestion
  const applyAISuggestion = (suggestion) => {
    addProduct(suggestion.product, suggestion.position);
  };

  return (
    <div className="flex h-screen">
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas shadows>
          {/* Camera */}
          <PerspectiveCamera
            makeDefault
            position={[boothW * 0.8, boothW * 1.2, boothD * 1.5]}
            fov={50}
          />

          {/* Controls */}
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2}
          />

          {/* Lighting */}
          <Lighting boothWidth={boothW} boothDepth={boothD} />

          {/* Booth Floor */}
          <BoothFloor width={boothW} depth={boothD} />

          {/* Products - with Suspense for texture loading */}
          <Suspense fallback={null}>
            {products.map((product) => (
              <ProductMesh
                key={product.id}
                product={product}
                position={[
                  product.position.x - boothW / 2,
                  product.position.y,
                  product.position.z - boothD / 2
                ]}
                onRemove={removeProduct}
              />
            ))}
          </Suspense>
        </Canvas>

        {/* Editor Controls Overlay */}
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm text-gray-700">Booth: {boothSize}</h3>
          <div className="text-xs text-gray-500">
            {products.length} products placed
          </div>
          <div className="text-xs text-gray-400">
            Click products to remove
          </div>
        </div>

        {/* Save Button */}
        <div className="absolute bottom-4 right-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700"
            onClick={() => onLayoutChange?.(products)}
          >
            Save Layout
          </button>
        </div>
      </div>

      {/* Right Sidebar - Product Library & AI */}
      <div className="w-80 bg-gray-50 border-l border-gray-200 overflow-y-auto">
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-bold">Booth Editor</h2>

          {/* AI Suggestions Section */}
          {aiSuggestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="text-blue-600">🤖</span>
                AI Suggestions
              </h3>
              {aiSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  className="w-full text-left text-sm p-2 hover:bg-blue-100 rounded"
                  onClick={() => applyAISuggestion(suggestion)}
                >
                  {suggestion.description}
                </button>
              ))}
            </div>
          )}

          {/* Product Library from Base44 */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Product Library</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg p-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => addProduct(product)}
                >
                  {/* Product Thumbnail */}
                  {product.primary_image_url && (
                    <img
                      src={product.primary_image_url}
                      alt={product.name}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  )}
                  <div className="text-sm font-medium">{product.name}</div>
                  <div className="text-xs text-gray-500">
                    {product.footprint_w_ft}' × {product.footprint_d_ft}' × {product.height_ft}'
                  </div>
                  {product.sku && (
                    <div className="text-xs text-gray-400 mt-1">
                      SKU: {product.sku}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Products */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Products in Booth</h3>
            {products.length === 0 ? (
              <p className="text-xs text-gray-500">
                Click products above to add to booth
              </p>
            ) : (
              <div className="space-y-1">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 bg-white rounded text-xs hover:bg-gray-50"
                  >
                    <span>{product.name}</span>
                    <button
                      onClick={() => removeProduct(product.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
