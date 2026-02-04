import { supabase, setBase44UserId } from '../api/supabaseClient';

/**
 * Sync Base44 user to Supabase profile
 * Creates or updates a profile in Supabase when a user logs in via Base44
 *
 * @param {Object} base44User - User object from Base44 auth
 * @returns {Object} Supabase profile or null if error
 */
export async function syncProfileToSupabase(base44User) {
  if (!base44User || !base44User.id || !base44User.email) {
    console.error('Invalid Base44 user data:', base44User);
    return null;
  }

  try {
    // Store Base44 user ID for RLS policies
    setBase44UserId(base44User.id);

    // Check if profile already exists
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('base44_user_id', base44User.id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = not found, which is okay
      console.error('Error checking existing profile:', selectError);
      throw selectError;
    }

    // Extract profile data from Base44 user
    const profileData = {
      base44_user_id: base44User.id,
      email: base44User.email,
      company_name: base44User.company_name || null,
      contact_name: base44User.contact_name || base44User.name || null,
      phone: base44User.phone || null,
      user_type: base44User.user_type || 'broker' // Default to broker
    };

    let profile;

    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          email: profileData.email,
          company_name: profileData.company_name,
          contact_name: profileData.contact_name,
          phone: profileData.phone,
          user_type: profileData.user_type
        })
        .eq('id', existingProfile.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw updateError;
      }

      profile = updatedProfile;
      console.log('✓ Profile updated in Supabase:', profile.id);
    } else {
      // Create new profile
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        throw insertError;
      }

      profile = newProfile;
      console.log('✓ Profile created in Supabase:', profile.id);
    }

    return profile;
  } catch (error) {
    console.error('Failed to sync profile to Supabase:', error);
    return null;
  }
}

/**
 * Get Supabase profile for current Base44 user
 *
 * @param {String} base44UserId - Base44 user ID
 * @returns {Object} Supabase profile or null
 */
export async function getSupabaseProfile(base44UserId) {
  if (!base44UserId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('base44_user_id', base44UserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to get Supabase profile:', error);
    return null;
  }
}

/**
 * Link Supabase profile ID to entity records
 * Useful when creating orders or booth designs
 *
 * @param {String} base44UserId - Base44 user ID
 * @returns {String} Supabase profile UUID or null
 */
export async function getSupabaseProfileId(base44UserId) {
  const profile = await getSupabaseProfile(base44UserId);
  return profile ? profile.id : null;
}
