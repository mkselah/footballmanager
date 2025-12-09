export const SUPABASE_URL = "https://exqaziqinrxrvowfhnst.supabase.co"; // REPLACE
export const SUPABASE_KEY = ""; // REPLACE

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);