#!/usr/bin/env node
/**
 * Update Supabase bucket file size limit to 200MB
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase.storage.updateBucket('orbus-assets', {
  public: true,
  fileSizeLimit: 209715200 // 200MB
});

if (error) {
  console.error('❌ Failed:', error.message);
} else {
  console.log('✅ Bucket updated to 200MB file size limit');
  console.log(data);
}
