import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { Target, Lightbulb, Package, Presentation, Users, Palette, LayoutGrid, Truck, ArrowRight, ArrowLeft } from 'lucide-react';

export default function CustomerProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [quoteData, setQuoteData] = useState(null);

  // Form state
  const [objectives, setObjectives] = useState([]);
  const [needsMultipleSizes, setNeedsMultipleSizes] = useState('');
  const [displayProducts, setDisplayProducts] = useState('');
  const [needsDemoSpace, setNeedsDemoSpace] = useState('');
  const [needsConferenceArea, setNeedsConferenceArea] = useState('');
  const [needsGraphicDesign, setNeedsGraphicDesign] = useState('');
  const [desiredLook, setDesiredLook] = useState([]);
  const [desiredFeel, setDesiredFeel] = useState([]);
  const [needsLogistics, setNeedsLogistics] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    checkQuoteData();
  }, []);

  const checkQuoteData = async () => {
    const storedQuote = sessionStorage.getItem('quoteRequest');
    if (!storedQuote) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const quoteInfo = JSON.parse(storedQuote);
    setQuoteData(quoteInfo);

    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
  };

  const handleObjectiveToggle = (objective) => {
    setObjectives(prev =>
      prev.includes(objective)
        ? prev.filter(o => o !== objective)
        : [...prev, objective]
    );
  };

  const handleLookToggle = (look) => {
    setDesiredLook(prev =>
      prev.includes(look)
        ? prev.filter(l => l !== look)
        : [...prev, look]
    );
  };

  const handleFeelToggle = (feel) => {
    setDesiredFeel(prev =>
      prev.includes(feel)
        ? prev.filter(f => f !== feel)
        : [...prev, feel]
    );
  };

  const handleSubmit = async () => {
    if (objectives.length === 0 || desiredLook.length === 0 || desiredFeel.length === 0) {
      alert('Please answer all required questions');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save customer profile to database
      const profile = await base44.entities.ClientProfile.create({
        dealer_id: user.id,
        dealer_email: user.email,
        objectives: objectives,
        needs_multiple_sizes: needsMultipleSizes === 'yes',
        display_products: displayProducts === 'yes',
        needs_demo_space: needsDemoSpace === 'yes',
        needs_conference_area: needsConferenceArea === 'yes',
        needs_graphic_design: needsGraphicDesign === 'yes',
        desired_look: desiredLook,
        desired_feel: desiredFeel,
        needs_logistics: needsLogistics === 'yes',
        additional_notes: additionalNotes,
        booth_size: quoteData.boothSize,
        show_date: quoteData.showDate,
        website_url: quoteData.websiteUrl
      });

      // Add profile to quote data
      const updatedQuoteData = {
        ...quoteData,
        customerProfileId: profile.id,
        customerProfile: profile
      };

      sessionStorage.setItem('quoteRequest', JSON.stringify(updatedQuoteData));
      navigate(createPageUrl('Loading'));
    } catch (error) {
      console.error('Failed to save customer profile:', error);
      setIsSubmitting(false);
    }
  };

  const objectiveOptions = [
    { value: 'lead_generation', label: 'Lead Generation', icon: Target },
    { value: 'brand_awareness', label: 'Brand Awareness', icon: Lightbulb },
    { value: 'education', label: 'Education', icon: Users },
    { value: 'relationships', label: 'Building Relationships', icon: Users },
    { value: 'short_term_sales', label: 'Short-term Sales', icon: Package },
    { value: 'long_term_sales', label: 'Long-term Sales', icon: Package }
  ];

  const lookOptions = [
    { value: 'conservative', label: 'Conservative' },
    { value: 'elegant', label: 'Elegant' },
    { value: 'high_tech', label: 'High Tech' },
    { value: 'minimalist', label: 'Minimalist' },
    { value: 'modern', label: 'Modern' },
    { value: 'industrial', label: 'Industrial' }
  ];

  const feelOptions = [
    { value: 'open', label: 'Open' },
    { value: 'symmetrical', label: 'Symmetrical' },
    { value: 'freeform', label: 'Freeform' },
    { value: 'intimate', label: 'Intimate' },
    { value: 'spacious', label: 'Spacious' }
  ];

  if (!quoteData || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2C5282] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('QuoteRequest'))}
            className="mb-4 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <h1 className="text-4xl font-bold text-[#2C5282] mb-3">
            Tell Us About Your Vision
          </h1>
          <p className="text-lg text-slate-600">
            Help us create the perfect booth experience by answering a few questions
          </p>
        </motion.div>

        {/* Question 1: Objectives */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#2C5282]" />
                What are your main objectives for this trade show? *
              </CardTitle>
              <CardDescription>Select all that apply</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {objectiveOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.value}
                      onClick={() => handleObjectiveToggle(option.value)}
                      className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        objectives.includes(option.value)
                          ? 'border-[#2C5282] bg-[#2C5282]/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Checkbox
                        checked={objectives.includes(option.value)}
                        className="pointer-events-none"
                      />
                      <Icon className="w-5 h-5 text-slate-600" />
                      <span className="font-medium text-slate-700">{option.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 2: Multiple Sizes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-[#2C5282]" />
                Will you need multiple booth sizes for future events?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={needsMultipleSizes} onValueChange={setNeedsMultipleSizes}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="yes" id="multiple-yes" />
                  <Label htmlFor="multiple-yes" className="cursor-pointer">Yes, I'll need different sizes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="multiple-no" />
                  <Label htmlFor="multiple-no" className="cursor-pointer">No, just this size</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 3: Display Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#2C5282]" />
                Will you need to display products in your booth?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={displayProducts} onValueChange={setDisplayProducts}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="yes" id="display-yes" />
                  <Label htmlFor="display-yes" className="cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="display-no" />
                  <Label htmlFor="display-no" className="cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 4: Demo Space */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-[#2C5282]" />
                Will you need space for demonstrations or presentations?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={needsDemoSpace} onValueChange={setNeedsDemoSpace}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="yes" id="demo-yes" />
                  <Label htmlFor="demo-yes" className="cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="demo-no" />
                  <Label htmlFor="demo-no" className="cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 5: Conference Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#2C5282]" />
                Will you need a conference or meeting area?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={needsConferenceArea} onValueChange={setNeedsConferenceArea}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="yes" id="conference-yes" />
                  <Label htmlFor="conference-yes" className="cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="conference-no" />
                  <Label htmlFor="conference-no" className="cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 6: Graphic Design Assistance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#2C5282]" />
                Will you need assistance designing graphics for your booth?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={needsGraphicDesign} onValueChange={setNeedsGraphicDesign}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="yes" id="graphics-yes" />
                  <Label htmlFor="graphics-yes" className="cursor-pointer">Yes, I need design help</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="graphics-no" />
                  <Label htmlFor="graphics-no" className="cursor-pointer">No, I have my own graphics</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 7: Desired Look */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#2C5282]" />
                Describe the look you desire *
              </CardTitle>
              <CardDescription>Select all that apply</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {lookOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => handleLookToggle(option.value)}
                    className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      desiredLook.includes(option.value)
                        ? 'border-[#2C5282] bg-[#2C5282]/5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Checkbox
                      checked={desiredLook.includes(option.value)}
                      className="pointer-events-none"
                    />
                    <span className="font-medium text-slate-700">{option.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 8: Desired Feel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-[#2C5282]" />
                Describe the feel you desire *
              </CardTitle>
              <CardDescription>Select all that apply</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {feelOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => handleFeelToggle(option.value)}
                    className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      desiredFeel.includes(option.value)
                        ? 'border-[#2C5282] bg-[#2C5282]/5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Checkbox
                      checked={desiredFeel.includes(option.value)}
                      className="pointer-events-none"
                    />
                    <span className="font-medium text-slate-700">{option.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 9: Logistics Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#2C5282]" />
                Will you need shipping, storing, and logistic support for your exhibit?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={needsLogistics} onValueChange={setNeedsLogistics}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="yes" id="logistics-yes" />
                  <Label htmlFor="logistics-yes" className="cursor-pointer">Yes, full logistics support</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="logistics-no" />
                  <Label htmlFor="logistics-no" className="cursor-pointer">No, I'll handle it myself</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question 10: Additional Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mb-8"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Any additional requirements or notes?</CardTitle>
              <CardDescription>Optional - Tell us anything else that would help us design your perfect booth</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="e.g., specific brand colors, product sizes, accessibility needs, etc."
                rows={4}
                className="w-full"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="flex justify-end"
        >
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || objectives.length === 0 || desiredLook.length === 0 || desiredFeel.length === 0}
            className="bg-[#2C5282] hover:bg-[#1E3A5F] h-14 px-8 text-lg"
          >
            {isSubmitting ? (
              'Saving...'
            ) : (
              <>
                Continue to Design Generation
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
