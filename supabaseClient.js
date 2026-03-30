import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://vwyupivwafvhwyladpth.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3eXVwaXZ3YWZ2aHd5bGFkcHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTY5MjIsImV4cCI6MjA4NTczMjkyMn0.PGltYTmqjQ8_3JiGlWmdLi7s8wDaNBjXFd74e5FL03U";

export const supabase = createClient(supabaseUrl, supabaseKey);
