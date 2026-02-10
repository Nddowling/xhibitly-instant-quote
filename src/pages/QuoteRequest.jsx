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
    <div className="min-h-[calc(100vh-64px)] bg-slate-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-[#e2231a] mb-3">
            Get Your Instant Quote
          </h1>
          <p className="text-slate-500 text-lg">
            Tell us about your booth requirements and we'll show you the best options
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-xl border-0">
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
                  <Popover>
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
                        onSelect={setShowDate}
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
                  className="w-full bg-[#e2231a] hover:bg-[#b01b13] h-16 text-xl font-semibold transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                >
                  Design My Brand Experience
                  <ArrowRight className="w-6 h-6 ml-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>


      </div>
    </div>
  );
}