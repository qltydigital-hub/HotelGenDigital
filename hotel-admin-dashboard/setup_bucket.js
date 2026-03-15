const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setup() {
  console.log("Checking storage buckets...");
  const { data: buckets, error: getError } = await supabase.storage.listBuckets();
  
  if (getError) {
    console.error("Error fetching buckets:", getError);
    return;
  }

  const bucketExists = buckets.some(b => b.name === 'hotel-documents');

  if (!bucketExists) {
    console.log("Creating 'hotel-documents' bucket...");
    const { data, error } = await supabase.storage.createBucket('hotel-documents', {
      public: true,
      allowedMimeTypes: null,
      fileSizeLimit: null
    });

    if (error) {
      console.error("Failed to create bucket:", error.message);
    } else {
      console.log("✅ Bucket 'hotel-documents' created successfully!");
    }
  } else {
    console.log("✅ Bucket 'hotel-documents' already exists.");
  }
}

setup();
