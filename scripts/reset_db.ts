
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetDb() {
    console.log('Resetting database...');

    // Delete all flows (cascades)
    const { error } = await supabase.from('flows').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
        console.error('Error resetting DB:', error);
    } else {
        console.log('Database reset successfully.');
    }
}

resetDb();
