
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "CRITICAL: Missing environment variable NEXT_PUBLIC_SUPABASE_URL. Please set it in your .env file."
  );
}
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  throw new Error(
    `CRITICAL: Invalid format for NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}". It must start with http:// or https://.`
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "CRITICAL: Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY. Please set it in your .env file."
  );
}

// Client for client-side operations (uses anon key)
let supabaseInstance: SupabaseClient;
try {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} catch (error: any) {
  console.error("Error initializing Supabase client (anon key):", error);
  throw new Error(
    `Failed to initialize Supabase client with URL "${supabaseUrl}". Check console for details. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are correct in your .env file.`
  );
}
export const supabase = supabaseInstance;


// Function to create a Supabase client for server-side operations (uses service_role key)
export const createSupabaseServerClient = (): SupabaseClient => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // serverSupabaseUrl is already validated and available as supabaseUrl from the top scope
  
  if (!supabaseServiceKey) {
    // This is a critical warning for developers, as it indicates a less secure fallback.
    console.warn(
      "SECURITY WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Server client will use the public anon key. " +
      "Row Level Security (RLS) will NOT be bypassed for server-side operations as intended. " +
      "Set SUPABASE_SERVICE_ROLE_KEY for proper admin privileges on the backend."
    );
    try {
      // supabaseUrl and supabaseAnonKey are guaranteed to be defined and valid here
      return createClient(supabaseUrl, supabaseAnonKey); 
    } catch (error: any) {
      console.error("Error initializing Supabase server client (fallback to anon key):", error);
      throw new Error(
        `Failed to initialize Supabase server client (fallback to anon) with URL "${supabaseUrl}". Check console for details.`
      );
    }
  }
  
  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error: any) {
      console.error("Error initializing Supabase server client (with service key):", error);
      throw new Error(
        `Failed to initialize Supabase server client (with service key) and URL "${supabaseUrl}". Check console for details.`
      );
  }
};
