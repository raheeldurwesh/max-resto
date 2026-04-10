import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function checkRealtime() {
  console.log("Checking DB publication...");
  const serviceKeyMatch = env.match(/VITE_SUPABASE_SERVICE_KEY=(.*)/);
  if (serviceKeyMatch) {
     const serviceDb = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());
     // query the publication tables
     const { data, error } = await serviceDb.rpc('execute_sql', { sql: "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';" });
     console.log("Publication tables:", data, error);
  } else {
     console.log("No service key to check pg metadata. Will perform a basic RT test.");
  }
}
checkRealtime();
