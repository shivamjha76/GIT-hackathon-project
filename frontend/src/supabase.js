import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://oqzhaswlztjuylauxekq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Kvh8JBONTLdcM6YyawKLLw_HFAxj5Oa";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
