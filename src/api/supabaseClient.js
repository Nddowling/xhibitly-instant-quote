import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check .env.local');
  throw new Error('Supabase configuration is missing');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Don't use Supabase auth - we use Base44 auth
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      // Custom headers can be added here if needed
    }
  }
});

/**
 * Helper to get current Base44 user ID for RLS policies
 * Base44 user ID is used to link profiles and enforce row-level security
 */
export const getBase44UserId = () => {
  // This will be set by the profileSync utility when user logs in via Base44
  return localStorage.getItem('base44_user_id') || null;
};

/**
 * Helper to set Base44 user ID in storage
 * Called when user authenticates via Base44
 */
export const setBase44UserId = (userId) => {
  if (userId) {
    localStorage.setItem('base44_user_id', userId);
  } else {
    localStorage.removeItem('base44_user_id');
  }
};

export default supabase;
