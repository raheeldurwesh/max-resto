import { supabase } from './src/supabase/client.js';

async function run() {
  console.log("Listing bucket menu-images...");
  const { data, error } = await supabase.storage.from('menu-images').list();
  console.log("Error:", error);
  console.log("Data:", data);
  
  // also get menu items
  const { data: menuData } = await supabase.from('menu').select('image_url');
  console.log("Menu items URLs:", menuData);
}

run();
