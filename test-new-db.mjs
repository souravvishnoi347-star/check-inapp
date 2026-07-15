import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yaeejdgcplpxbmdenkoo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhZWVqZGdjcGxweGJtZGVua29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MjkzODEsImV4cCI6MjA5OTQwNTM4MX0.BKXDxleBL3aIju7GIuNC8zsNMTJli3hu-jZB1p49NRA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Testing connection and Bookings insert...");
  const { data, error } = await supabase
    .from('Bookings')
    .insert({
      check_in_date: '2026-07-15',
      check_out_date: '2026-07-16',
      agreed_price: 1500,
      payment_type: 'cash',
      male_guests: 1,
      female_guests: 0,
      status: 'checked_in'
    })
    .select()
    .single();
  
  if (error) {
    console.error("❌ Bookings insert error:", error);
    return;
  }
  console.log("✅ Bookings insert success! ID:", data.id);

  console.log("Testing Guests insert...");
  const { data: guestData, error: guestError } = await supabase
    .from('Guests')
    .insert({
      booking_id: data.id,
      name: 'Test Guest',
      age: 30,
      phone: '1234567890',
      id_image_url: 'test.jpg'
    })
    .select();
    
  if (guestError) {
    console.error("❌ Guests insert error:", guestError);
    return;
  }
  console.log("✅ Guests insert success!");

  console.log("Testing storage upload access...");
  const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket('id_proofs');
  if (bucketError) {
     console.error("❌ Storage bucket error:", bucketError);
  } else {
     console.log("✅ Storage bucket exists:", bucketInfo.name);
  }
  
  // Cleanup test booking
  await supabase.from('Bookings').delete().eq('id', data.id);
  console.log("✅ Cleanup done.");
}

test();
