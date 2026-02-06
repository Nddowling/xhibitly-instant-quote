import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Trash2, Moon, Sun, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    loadUser();
    checkDarkMode();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
  };

  const checkDarkMode = () => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', !darkMode ? 'true' : 'false');
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Delete user's orders
      if (user?.email) {
        const orders = await base44.entities.Order.filter({ dealer_email: user.email });
        for (const order of orders) {
          await base44.entities.Order.delete(order.id);
        }
      }

      // Delete user's client profiles
      if (user?.email) {
        const profiles = await base44.entities.ClientProfile.filter({ client_email: user.email });
        for (const profile of profiles) {
          await base44.entities.ClientProfile.delete(profile.id);
        }
      }

      // Delete sales rep record if exists
      if (user?.is_sales_rep) {
        const reps = await base44.entities.SalesRep.filter({ user_id: user.id });
        for (const rep of reps) {
          await base44.entities.SalesRep.delete(rep.id);
        }
      }

      // Logout and redirect
      base44.auth.logout(createPageUrl('Home'));
    } catch (e) {
      console.error('Error deleting account:', e);
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 p-6 pb-24 md:pb-10">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your account preferences</p>
        </motion.div>

        {/* Profile Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-6 dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#e2231a]/10 dark:bg-[#e2231a]/20 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-[#e2231a]" />
                </div>
                <div>
                  <CardTitle className="dark:text-white">Profile Information</CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    Your account details
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-slate-500 dark:text-slate-400 text-sm">Name</Label>
                <p className="text-slate-900 dark:text-white font-medium">
                  {user.contact_name || user.full_name || 'Not set'}
                </p>
              </div>
              <div>
                <Label className="text-slate-500 dark:text-slate-400 text-sm">Email</Label>
                <p className="text-slate-900 dark:text-white font-medium">{user.email}</p>
              </div>
              {user.company_name && (
                <div>
                  <Label className="text-slate-500 dark:text-slate-400 text-sm">Company</Label>
                  <p className="text-slate-900 dark:text-white font-medium">{user.company_name}</p>
                </div>
              )}
              <div>
                <Label className="text-slate-500 dark:text-slate-400 text-sm">Account Type</Label>
                <p className="text-slate-900 dark:text-white font-medium">
                  {user.is_sales_rep ? 'Sales Representative' : 'Customer'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mb-6 dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                Appearance
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Customize how the app looks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-900 dark:text-white font-medium">Dark Mode</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Switch between light and dark themes
                  </p>
                </div>
                <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-red-200 dark:border-red-900 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Irreversible account actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isDeleting}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="dark:text-white">
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="dark:text-slate-400">
                      This action cannot be undone. This will permanently delete your account,
                      all your orders, and remove all associated data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}