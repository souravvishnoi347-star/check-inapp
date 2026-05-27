import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egglwssidddhlbffxofe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZ2x3c3NpZGRkaGxiZmZ4b2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDIxNDMsImV4cCI6MjA5NTQxODE0M30.YNWLE93IUdiQtWC1WTENTQPMN2bDBPiSVlalw-XoQJ0';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPolicies() {
  console.log("Fetching policies...");
  
  // We can't query pg_policies via REST API without a specific view, but we can try an RPC if they have one.
  // Instead, let's just do a direct API call to see if we can insert something simple.
  
  const { data, error } = await supabase.from('Bookings').insert({ check_in_date: '2026-05-27', check_out_date: '2026-05-28' });
  console.log("Basic Insert without select:", error || data);
}

checkPolicies();
