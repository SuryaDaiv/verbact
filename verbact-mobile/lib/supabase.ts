
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// PLACEHOLDERS - User needs to replace these or we inject them via .env
// We will look for process.env first
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ycbnhccwtcdbzjvujhzg.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYm5oY2N3dGNkYnpqdnVqaHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0OTQ4MDYsImV4cCI6MjA4MDA3MDgwNn0.URW6yJzBbCp9ZV_kQFOtebz4GjRXzoK4YHLU8nCvonw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// AppState listener to refresh auth
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
