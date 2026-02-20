import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Edit2, RefreshCw } from 'lucide-react';
import { createPageUrl } from '../utils';

export default function BrandVerification() {
  const navigate = useNavigate();
  const [brandData, setBrandData] = useState(null);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [selectedColors, setSelectedColors] = useState({
    primary: null,
    secondary: null,
    accent1: null,
    accent2: null
  });
  const [companyName, setCompanyName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    // Load brand data from sessionStorage
    const storedBrandData = sessionStorage.getItem('brandVerification');
    if (!storedBrandData) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const data = JSON.parse(storedBrandData);
    setBrandData(data);

    // Set initial selections
    setCompanyName(data.company_name || '');
    setSelectedLogo(data.logo_url || null);
    setSelectedColors({
      primary: data.primary_color || null,
      secondary: data.secondary_color || null,
      accent1: data.accent_color_1 || null,
      accent2: data.accent_color_2 || null
    });
  }, [navigate]);

  const handleConfirm = () => {
    // Save user's selections back to sessionStorage
    const confirmedBrand = {
      ...brandData,
      company_name: companyName,
      logo_url: selectedLogo,
      primary_color: selectedColors.primary,
      secondary_color: selectedColors.secondary,
      accent_color_1: selectedColors.accent1,
      accent_color_2: selectedColors.accent2,
      user_verified: true
    };

    sessionStorage.setItem('confirmedBrand', JSON.stringify(confirmedBrand));

    // Navigate back to Loading to continue with design generation
    navigate(createPageUrl('Loading'));
  };

  const handleRegenerateBranding = () => {
    // Clear brand data and go back to force re-extraction
    sessionStorage.removeItem('brandVerification');
    sessionStorage.removeItem('confirmedBrand');
    navigate(createPageUrl('Loading'));
  };

  if (!brandData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <p className="text-white">Loading brand data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Verify Your Brand Identity
          </h1>
          <p className="text-white/60">
            Review and select your branding before we generate your booth designs
          </p>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 space-y-8">
          {/* Company Name */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Company Name</h2>
              <button
                onClick={() => setIsEditingName(!isEditingName)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <Edit2 size={18} />
              </button>
            </div>
            {isEditingName ? (
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            ) : (
              <p className="text-2xl font-bold text-white">{companyName}</p>
            )}
          </motion.div>

          {/* Logo Selection */}
          {brandData.logo_options && brandData.logo_options.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold text-white mb-4">Select Logo</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {brandData.logo_options.map((logoOption, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedLogo(logoOption.url)}
                    className={`relative p-6 rounded-xl border-2 transition-all ${
                      selectedLogo === logoOption.url
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <div className="bg-white rounded-lg p-4 mb-2 h-32 flex items-center justify-center">
                      <img
                        src={logoOption.url}
                        alt={`Logo option ${idx + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <p className="text-white/60 text-sm text-center">
                      {logoOption.format?.toUpperCase()} - {logoOption.width}x{logoOption.height}
                    </p>
                    {selectedLogo === logoOption.url && (
                      <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                        <Check size={16} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            brandData.logo_url && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-xl font-semibold text-white mb-4">Logo</h2>
                <div className="bg-white rounded-xl p-8 flex items-center justify-center h-48">
                  <img
                    src={brandData.logo_url}
                    alt="Company logo"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </motion.div>
            )
          )}

          {/* Color Palette */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-semibold text-white mb-4">Brand Colors</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Primary Color */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Primary</label>
                <div
                  className="w-full h-24 rounded-lg border-2 border-white/20 cursor-pointer relative"
                  style={{ backgroundColor: selectedColors.primary }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = selectedColors.primary || '#000000';
                    input.onchange = (e) => setSelectedColors({ ...selectedColors, primary: e.target.value });
                    input.click();
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-mono bg-black/30 px-2 py-1 rounded">
                      {selectedColors.primary}
                    </span>
                  </div>
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Secondary</label>
                <div
                  className="w-full h-24 rounded-lg border-2 border-white/20 cursor-pointer relative"
                  style={{ backgroundColor: selectedColors.secondary }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = selectedColors.secondary || '#000000';
                    input.onchange = (e) => setSelectedColors({ ...selectedColors, secondary: e.target.value });
                    input.click();
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-mono bg-black/30 px-2 py-1 rounded">
                      {selectedColors.secondary}
                    </span>
                  </div>
                </div>
              </div>

              {/* Accent 1 */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Accent 1</label>
                <div
                  className="w-full h-24 rounded-lg border-2 border-white/20 cursor-pointer relative"
                  style={{ backgroundColor: selectedColors.accent1 }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = selectedColors.accent1 || '#000000';
                    input.onchange = (e) => setSelectedColors({ ...selectedColors, accent1: e.target.value });
                    input.click();
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-mono bg-black/30 px-2 py-1 rounded">
                      {selectedColors.accent1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Accent 2 */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Accent 2</label>
                <div
                  className="w-full h-24 rounded-lg border-2 border-white/20 cursor-pointer relative"
                  style={{ backgroundColor: selectedColors.accent2 }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = selectedColors.accent2 || '#000000';
                    input.onchange = (e) => setSelectedColors({ ...selectedColors, accent2: e.target.value });
                    input.click();
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-mono bg-black/30 px-2 py-1 rounded">
                      {selectedColors.accent2}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-white/40 text-sm mt-2">Click any color to edit</p>
          </motion.div>

          {/* Industry */}
          {brandData.industry && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-xl font-semibold text-white mb-2">Industry</h2>
              <p className="text-white/80">{brandData.industry}</p>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-4 pt-6"
          >
            <button
              onClick={handleRegenerateBranding}
              className="flex-1 px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={20} />
              Re-extract Branding
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Confirm & Continue
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}