import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://egglwssidddhlbffxofe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZ2x3c3NpZGRkaGxiZmZ4b2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDIxNDMsImV4cCI6MjA5NTQxODE0M30.YNWLE93IUdiQtWC1WTENTQPMN2bDBPiSVlalw-XoQJ0');

async function test() {
  console.log("Testing Bookings insert with single...");
  const { data, error } = await supabase
    .from('Bookings')
    .insert({
      check_in_date: '2026-05-27',
      check_out_date: '2026-05-28'
    })
    .select()
    .single();
  
  if (error) {
    console.error("Bookings insert error:", error);
  } else {
    console.log("Bookings insert success:", data);
  }
}

test();
