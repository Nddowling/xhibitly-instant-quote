import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Edit2, RefreshCw, ArrowRight } from 'lucide-react';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DraggableColorSlot from '../components/brand/DraggableColorSlot';
import LogoSelector from '../components/brand/LogoSelector';

export default function BrandVerification() {
  const navigate = useNavigate();
  const [brandData, setBrandData] = useState(null);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [colors, setColors] = useState([null, null, null, null]);
  const [companyName, setCompanyName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  const COLOR_LABELS = ['Primary', 'Secondary', 'Accent 1', 'Accent 2'];

  useEffect(() => {
    const storedBrandData = sessionStorage.getItem('brandVerification');
    if (!storedBrandData) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const data = JSON.parse(storedBrandData);
    setBrandData(data);
    setCompanyName(data.company_name || '');
    setSelectedLogo(data.logo_url || null);
    setColors([
      data.primary_color || null,
      data.secondary_color || null,
      data.accent_color_1 || null,
      data.accent_color_2 || null
    ]);
  }, [navigate]);

  const handleSwapColors = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setColors(prev => {
      const next = [...prev];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    });
  }, []);

  const handleRemoveColor = useCallback((idx) => {
    setColors(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  }, []);

  const handleChangeColor = useCallback((idx, value) => {
    setColors(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleConfirm = () => {
    const confirmedBrand = {
      ...brandData,
      company_name: companyName,
      logo_url: selectedLogo,
      primary_color: colors[0],
      secondary_color: colors[1],
      accent_color_1: colors[2],
      accent_color_2: colors[3],
      user_verified: true
    };

    sessionStorage.setItem('confirmedBrand', JSON.stringify(confirmedBrand));
    navigate(createPageUrl('Loading'));
  };

  const handleRegenerateBranding = () => {
    sessionStorage.removeItem('brandVerification');
    sessionStorage.removeItem('confirmedBrand');
    navigate(createPageUrl('Loading'));
  };

  if (!brandData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100 p-4 md:p-10 pb-24 md:pb-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-[#e2231a] mb-2">
            Verify Your Brand
          </h1>
          <p className="text-slate-500 text-lg">
            Review and adjust your branding before we design your booth
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-xl border-0">
            <CardContent className="p-6 md:p-8 space-y-8">
              {/* Company Name */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-slate-800">Company Name</h2>
                  <button
                    onClick={() => setIsEditingName(!isEditingName)}
                    className="text-slate-400 hover:text-[#e2231a] transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
                {isEditingName ? (
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    autoFocus
                    className="h-12 text-lg"
                  />
                ) : (
                  <p className="text-2xl font-bold text-slate-900">{companyName}</p>
                )}
              </div>

              {/* Logo Selection */}
              <LogoSelector
                logoOptions={brandData.logo_options}
                selectedLogo={selectedLogo}
                singleLogoUrl={brandData.logo_url}
                onSelect={setSelectedLogo}
              />

              {/* Draggable Color Palette */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-slate-800">Brand Colors</h2>
                  <span className="text-xs text-slate-400">Drag to reorder</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {colors.map((color, idx) => (
                    <DraggableColorSlot
                      key={idx}
                      label={COLOR_LABELS[idx]}
                      color={color}
                      slotIndex={idx}
                      onRemove={() => handleRemoveColor(idx)}
                      onColorChange={(val) => handleChangeColor(idx, val)}
                      onDragStart={() => {}}
                      onDragOver={() => {}}
                      onDrop={handleSwapColors}
                    />
                  ))}
                </div>
              </div>

              {/* Industry */}
              {brandData.industry && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 mb-1">Industry</h2>
                  <p className="text-slate-600">{brandData.industry}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleRegenerateBranding}
                  className="flex-1 h-14 text-base gap-2"
                >
                  <RefreshCw size={18} />
                  Re-extract Branding
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 h-14 text-base bg-[#e2231a] hover:bg-[#b01b13] gap-2"
                >
                  <Check size={18} />
                  Confirm & Generate Designs
                  <ArrowRight size={18} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}