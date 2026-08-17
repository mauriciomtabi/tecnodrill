import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const SUPABASE_URL = metaEnv.VITE_SUPABASE_URL || 'https://dkscchjzztwyjzjpllob.supabase.co';
const SUPABASE_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc2NjaGp6enR3eWp6anBsbG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0NDcwMCwiZXhwIjoyMDk2ODIwNzAwfQ.QDco_35MhHsnHWDMrtcAsQyRXKJOntO1otClAWTA5KU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
