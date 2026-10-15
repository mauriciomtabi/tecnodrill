import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://dkscchjzztwyjzjpllob.supabase.co';
const PUBLIC_KEY = 'sb_publishable_vAiCBdEioA9vqF6dzHjADQ_TkVsFWuj';
// Do not read the old VITE_* key variables: their values may contain a leaked
// administrative key and Vite would inline it even if runtime code rejected it.
export const supabase = createClient(SUPABASE_URL, PUBLIC_KEY);
