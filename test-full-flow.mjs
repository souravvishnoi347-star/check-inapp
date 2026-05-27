import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egglwssidddhlbffxofe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZ2x3c3NpZGRkaGxiZmZ4b2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDIxNDMsImV4cCI6MjA5NTQxODE0M30.YNWLE93IUdiQtWC1WTENTQPMN2bDBPiSVlalw-XoQJ0';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFlow() {
  console.log("1. Testing Bookings insert with select...");
  const { data: bookingData, error: bookingError } = await supabase
    .from('Bookings')
    .insert({
      check_in_date: '2026-05-27',
      check_out_date: '2026-05-28'
    })
    .select()
    .single();
  
  if (bookingError) {
    console.error("Bookings insert error:", bookingError);
    return;
  }
  console.log("Bookings success. ID:", bookingData.id);

  console.log("2. Testing Storage upload...");
  // create dummy file blob
  const dummyFile = new Blob(['dummy content'], { type: 'text/plain' });
  const fileName = `test_${Date.now()}.txt`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('id_proofs')
    .upload(fileName, dummyFile);
    
  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return;
  }
  console.log("Storage success.");

  console.log("3. Testing Guests insert...");
  const { data: guestData, error: guestError } = await supabase
    .from('Guests')
    .insert({
      booking_id: bookingData.id,
      name: 'Test Guest',
      age: 25,
      id_image_url: 'test_url'
    });
    
  if (guestError) {
    console.error("Guests insert error:", guestError);
    return;
  }
  
  console.log("All steps succeeded!");
}

testFlow();
