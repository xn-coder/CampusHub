
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// A utility to create a mock Supabase client that throws an informative error when used.
// This prevents the app from crashing on startup if credentials are not yet configured.
const createThrowingClient = (message: string): SupabaseClient => {
  const handler = {
    get(target: any, prop: string) {
      // Allow checks like `if (supabase)` to work, but throw for any method call.
      if (prop === 'then') {
        return null;
      }
      throw new Error(message);
    },
  };
  return new Proxy({}, handler) as SupabaseClient;
};

// Function to initialize the client-side Supabase instance
const initializeSupabaseClient = (url?: string, key?: string): SupabaseClient => {
  if (!url || url.includes("YOUR_SUPABASE_URL_HERE") || !key || key.includes("YOUR_SUPABASE_ANON_KEY_HERE")) {
    const errorMessage = "Supabase client is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.";
    console.error(`[Supabase Client] ${errorMessage}`);
    return createThrowingClient(errorMessage);
  }

  try {
    // This will still throw if the URL format is fundamentally wrong, which is intended.
    new URL(url); 
    return createClient(url, key);
  } catch (error) {
    const errorMessage = `Failed to initialize Supabase client. Please check if the URL is correct. Error: ${(error as Error).message}`;
    console.error(`[Supabase Client] ${errorMessage}`);
    return createThrowingClient(errorMessage);
  }
};

export const supabase = initializeSupabaseClient(supabaseUrl, supabaseAnonKey);


// Function to create a Supabase client for server-side operations
export const createSupabaseServerClient = (): SupabaseClient => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.includes("YOUR_SUPABASE_URL_HERE")) {
    const errorMessage = "Server-side Supabase URL is not configured. Please set NEXT_PUBLIC_SUPABASE_URL in your .env file.";
    console.error(`[Supabase Server Client] ${errorMessage}`);
    return createThrowingClient(errorMessage);
  }
  
  if (!supabaseServiceKey) {
     console.warn(
      "[Supabase Server Client] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to the public anon key. RLS will not be bypassed."
    );
    // Reuse the client-side instance if the service key is missing
    return supabase;
  }
  
  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    const errorMessage = `Failed to initialize Supabase server client. Error: ${(error as Error).message}`;
    console.error(`[Supabase Server Client] ${errorMessage}`);
    return createThrowingClient(errorMessage);
  }
};
