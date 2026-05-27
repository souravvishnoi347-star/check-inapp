import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://egglwssidddhlbffxofe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZ2x3c3NpZGRkaGxiZmZ4b2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDIxNDMsImV4cCI6MjA5NTQxODE0M30.YNWLE93IUdiQtWC1WTENTQPMN2bDBPiSVlalw-XoQJ0');

async function test() {
  console.log("Testing Bookings insert...");
  const { data, error } = await supabase
    .from('Bookings')
    .insert({
      check_in_date: '2026-05-27',
      check_out_date: '2026-05-28'
    })
    .select();
  
  if (error) {
    console.error("Bookings error:", error);
    
    // Fallback: try lowercase
    console.log("Trying lowercase 'bookings'...");
    const { data: d2, error: e2 } = await supabase
      .from('bookings')
      .insert({
        check_in_date: '2026-05-27',
        check_out_date: '2026-05-28'
      })
      .select();
      
    if (e2) {
      console.error("lowercase bookings error:", e2);
    } else {
      console.log("Lowercase bookings worked!", d2);
    }
    
  } else {
    console.log("Bookings success:", data);
  }
}

test();
