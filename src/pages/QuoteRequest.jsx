import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, ArrowRight, Grid3X3, MapPin, Building2, Phone, User, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export default function QuoteRequest() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [boothSize, setBoothSize] = useState('');
  const [showDate, setShowDate] = useState(null);
  const [showName, setShowName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Profile fields
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);

  useEffect(() => {
    checkAuth();
    checkSalesCustomerData();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        navigate(createPageUrl('Home'));
        return;
      }
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Check if profile is complete (skip for sales reps and sales rep quotes)
      const salesCustomerData = sessionStorage.getItem('salesCustomerData');
      const isSalesRep = currentUser.is_sales_rep || currentUser.user_type === 'sales_rep';
      if (!salesCustomerData && !isSalesRep && (!currentUser.company_name || !currentUser.contact_name || !currentUser.phone)) {
        setNeedsProfile(true);
        setCompanyName(currentUser.company_name || '');
        setContactName(currentUser.contact_name || '');
        setPhone(currentUser.phone || '');
      }
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
    setIsLoading(false);
  };

  const checkSalesCustomerData = () => {
    const salesCustomerData = sessionStorage.getItem('salesCustomerData');
    if (salesCustomerData) {
      const data = JSON.parse(salesCustomerData);
      setCompanyName(data.dealerCompany || '');
      setContactName(data.dealerName || '');
      setPhone(data.dealerPhone || '');
      setNeedsProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!companyName || !contactName || !phone) return;
    
    await base44.auth.updateMe({
      company_name: companyName,
      contact_name: contactName,
      phone: phone
    });
    
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
    setNeedsProfile(false);
  };

  const handleSubmit = () => {
    if (!boothSize || !showDate || !websiteUrl) return;
    
    // Check if this is a sales rep creating a quote for a customer
    const salesCustomerData = sessionStorage.getItem('salesCustomerData');
    
    const quoteData = salesCustomerData ? {
      boothSize,
      showDate: format(showDate, 'yyyy-MM-dd'),
      showName,
      websiteUrl,
      dealerEmail: JSON.parse(salesCustomerData).dealerEmail,
      dealerCompany: companyName,
      dealerName: contactName,
      dealerPhone: phone,
      dealerId: null, // Customer might not have an account yet
      isSalesRepQuote: true
    } : {
      boothSize,
      showDate: format(showDate, 'yyyy-MM-dd'),
      showName,
      websiteUrl,
      dealerEmail: user.email,
      dealerCompany: user.company_name,
      dealerName: user.contact_name,
      dealerPhone: user.phone,
      dealerId: user.id
    };
    
    sessionStorage.setItem('quoteRequest', JSON.stringify(quoteData));

    // Track analytics
    base44.analytics.track({
      eventName: "quote_started",
      properties: { booth_size: boothSize, website_url: websiteUrl }
    });
    
    // Clear sales customer data after using it
    if (salesCustomerData) {
      sessionStorage.removeItem('salesCustomerData');
    }
    
    navigate(createPageUrl('CustomerProfile'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Profile completion form
  if (needsProfile) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl text-[#e2231a]">Complete Your Profile</CardTitle>
              <CardDescription>
                Please provide your company details to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-slate-700 font-medium">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your Company Name"
                    className="pl-11 h-12"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contactName" className="text-slate-700 font-medium">Contact Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your Full Name"
                    className="pl-11 h-12"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700 font-medium">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="pl-11 h-12"
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleSaveProfile}
                disabled={!companyName || !contactName || !phone}
                className="w-full bg-[#e2231a] hover:bg-[#b01b13] h-14 text-lg font-medium"
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100 relative overflow-hidden">
      {/* ── Hero Background ── */}
      <div className="relative bg-gradient-to-br from-[#0F1D2E] via-[#1a2d44] to-[#0F1D2E] pt-10 pb-32 md:pb-40 px-6 overflow-hidden">
        {/* Geometric accent shapes */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          {/* Large red glow */}
          <div className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-[#e2231a]/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 -left-20 w-[400px] h-[400px] bg-[#e2231a]/5 rounded-full blur-[100px]" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '180px 180px' }} />
          {/* Diagonal accent lines */}
          <div className="absolute top-20 right-10 w-64 h-64 border border-white/[0.04] rounded-3xl rotate-12" />
          <div className="absolute top-32 right-24 w-48 h-48 border border-[#e2231a]/10 rounded-2xl rotate-[25deg]" />
          <div className="absolute -bottom-10 left-10 w-56 h-56 border border-white/[0.03] rounded-3xl -rotate-12" />
          {/* Floating red accent dots */}
          <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute top-24 left-[15%] w-2 h-2 bg-[#e2231a] rounded-full shadow-lg shadow-[#e2231a]/40" />
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-16 right-[25%] w-1.5 h-1.5 bg-[#e2231a]/60 rounded-full" />
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} className="absolute bottom-20 right-[15%] w-2.5 h-2.5 bg-white/20 rounded-full" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 text-white/60 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-[#e2231a] rounded-full animate-pulse" />
              Powered by AI Brand Analysis
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight"
          >
            Design Your <span className="text-[#e2231a]">Brand Experience</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-white/40 text-base md:text-lg max-w-xl mx-auto"
          >
            Tell us about your booth and we'll create a fully branded trade show experience — in under 2 minutes
          </motion.p>
        </div>
      </div>

      {/* ── Form Card (overlapping hero) ── */}
      <div className="relative -mt-20 md:-mt-24 px-6 pb-10 md:pb-16">
        <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-2xl border-0 ring-1 ring-black/[0.04]">
            <CardContent className="p-8 md:p-10">
              <div className="space-y-8">
                {/* Booth Size */}
                <div className="space-y-3">
                  <Label className="text-slate-700 font-semibold text-lg flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5 text-[#e2231a]" />
                    Booth Size
                  </Label>
                  <Select value={boothSize} onValueChange={setBoothSize}>
                    <SelectTrigger className="h-14 text-lg">
                      <SelectValue placeholder="Select booth size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10x10" className="text-lg py-3">10' x 10' (100 sq ft)</SelectItem>
                      <SelectItem value="20x20" className="text-lg py-3">20' x 20' (400 sq ft)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Show Date */}
                <div className="space-y-3">
                  <Label className="text-slate-700 font-semibold text-lg flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-[#e2231a]" />
                    Show Date
                  </Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full h-14 justify-start text-left font-normal text-lg ${!showDate && "text-muted-foreground"}`}
                      >
                        <CalendarIcon className="mr-3 h-5 w-5" />
                        {showDate ? format(showDate, "PPP") : "Select show date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={showDate}
                        onSelect={(date) => { setShowDate(date); setCalendarOpen(false); }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Website URL */}
                <div className="space-y-3">
                  <Label className="text-slate-700 font-semibold text-lg flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#e2231a]" />
                    Your Website URL
                  </Label>
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://www.yourcompany.com"
                    className="h-14 text-lg"
                    type="url"
                  />
                  <p className="text-sm text-slate-500">
                    We'll analyze your brand to design the perfect booth experience
                  </p>
                </div>

                {/* Show Name (Optional) */}
                <div className="space-y-3">
                  <Label className="text-slate-700 font-semibold text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#e2231a]" />
                    Show Name
                    <span className="text-slate-400 font-normal text-sm">(Optional)</span>
                  </Label>
                  <Input
                    value={showName}
                    onChange={(e) => setShowName(e.target.value)}
                    placeholder="e.g., CES 2024, SXSW, etc."
                    className="h-14 text-lg"
                  />
                </div>

                {/* Submit Button */}
                <Button 
                  onClick={handleSubmit}
                  disabled={!boothSize || !showDate || !websiteUrl}
                  className="w-full bg-[#e2231a] hover:bg-[#b01b13] h-14 md:h-16 text-base md:text-xl font-semibold transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                >
                  <span className="hidden sm:inline">Design My Brand Experience</span>
                  <span className="sm:hidden">Design My Booth</span>
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6 ml-2 md:ml-3 shrink-0" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </div>
      </div>
    </div>
  );
}