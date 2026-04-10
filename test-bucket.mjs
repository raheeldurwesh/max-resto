import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Listing bucket menu-images...");
  const { data, error } = await supabase.storage.from('menu-images').list('', { limit: 100 });
  console.log("Error:", error);
  console.log("Data:", data);
}

run();
