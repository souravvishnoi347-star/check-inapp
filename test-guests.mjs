import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://egglwssidddhlbffxofe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZ2x3c3NpZGRkaGxiZmZ4b2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDIxNDMsImV4cCI6MjA5NTQxODE0M30.YNWLE93IUdiQtWC1WTENTQPMN2bDBPiSVlalw-XoQJ0');

async function test() {
  console.log("Testing Guests insert...");
  const { data, error } = await supabase
    .from('Guests')
    .insert({
      booking_id: 1,
      name: 'Test',
      age: 20,
      id_image_url: 'test'
    })
    .select();
  
  if (error) {
    console.error("Guests error:", error);
  } else {
    console.log("Guests success:", data);
  }
}

test();
