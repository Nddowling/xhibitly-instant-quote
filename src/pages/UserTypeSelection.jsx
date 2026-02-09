import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Building2, Users, GraduationCap } from 'lucide-react';

export default function UserTypeSelection() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserType();
  }, []);

  const checkUserType = async () => {
    try {
      const user = await base44.auth.me();
      
      // If user already has a type set, redirect them to appropriate dashboard
      if (user.user_type) {
        if (user.is_sales_rep) {
          navigate(createPageUrl('SalesDashboard'));
        } else if (user.user_type === 'student') {
          navigate(createPageUrl('StudentHome'));
        } else {
          navigate(createPageUrl('QuoteRequest'));
        }
        return;
      }
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
    setIsLoading(false);
  };

  const handleSelectType = async (type) => {
    setSelectedType(type);
    
    try {
      // Update user type
      await base44.auth.updateMe({
        user_type: type,
        is_sales_rep: type === 'sales_rep'
      });
      
      if (type === 'sales_rep') {
        // Create SalesRep entity
        const user = await base44.auth.me();
        
        // Check if SalesRep record already exists
        const existingReps = await base44.entities.SalesRep.filter({ user_id: user.id });
        
        if (existingReps.length === 0) {
          await base44.entities.SalesRep.create({
            user_id: user.id,
            email: user.email,
            company_name: user.company_name || '',
            contact_name: user.full_name || '',
            phone: user.phone || '',
            is_active: true
          });
        }
      }
      
      // Redirect based on user type
      if (type === 'sales_rep') {
        navigate(createPageUrl('SalesDashboard'));
      } else {
        navigate(createPageUrl('QuoteRequest'));
      }
    } catch (e) {
      console.error('Error setting user type:', e);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-[#e2231a] mb-3">
            Welcome to Xhibitly Instant Quote
          </h1>
          <p className="text-slate-600 text-lg">
            Let's get started by identifying your role
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Customer Option */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                selectedType === 'dealer' ? 'ring-4 ring-[#e2231a] shadow-xl' : 'hover:ring-2 hover:ring-slate-300'
              }`}
              onClick={() => handleSelectType('dealer')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl">I Need a Booth Designed</CardTitle>
                <CardDescription className="text-base mt-2">
                  For customers looking to design and order trade show booths
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 border-t">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>Get instant AI-powered booth designs</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>View quotes and manage orders</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>Access order history and tracking</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sales Rep Option */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                selectedType === 'sales_rep' ? 'ring-4 ring-[#e2231a] shadow-xl' : 'hover:ring-2 hover:ring-slate-300'
              }`}
              onClick={() => handleSelectType('sales_rep')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-[#e2231a] to-[#b01b13] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl">I'm a Sales Representative</CardTitle>
                <CardDescription className="text-base mt-2">
                  Managing client relationships and booth design projects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 border-t">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>Manage multiple client accounts</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>Track sales pipeline and opportunities</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>View performance analytics and goals</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Student Option */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                selectedType === 'student' ? 'ring-4 ring-[#e2231a] shadow-xl' : 'hover:ring-2 hover:ring-slate-300'
              }`}
              onClick={() => handleSelectType('student')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl">I'm a Student</CardTitle>
                <CardDescription className="text-base mt-2">
                  Learning about trade show booth design and marketing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 border-t">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>Explore booth design tools</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>Request quotes for projects</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-2 flex-shrink-0" />
                  <span>Access learning resources</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}