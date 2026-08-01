import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (check your .env file).');
}

export const supabase = createClient<Database>(url, anonKey);
