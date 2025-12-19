// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL (check Vercel env vars + redeploy)");
}
if (!anon) {
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY (check Vercel env vars + redeploy)");
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
