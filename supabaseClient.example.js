// supabaseClient.example.js
//
// This is the template. The real file is supabaseClient.js — it is listed in
// .gitignore and should NEVER be committed to the repository.
//
// Setup:
//   1. Copy this file:  cp supabaseClient.example.js supabaseClient.js
//   2. Fill in your values from:
//      Supabase Dashboard → Project Settings → API
//   3. supabaseClient.js is already in .gitignore — it won't be committed.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL  = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON = "YOUR_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
