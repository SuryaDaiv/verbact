'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const supabase = createClient();
    const lastActivityRef = useRef<number>(Date.now());

    useEffect(() => {
        // 1. Tab Close / New Tab Logic
        // We use sessionStorage to detect if this is a new session (new tab/window)
        const sessionActive = sessionStorage.getItem('verbact_session_active');

        const checkSessionAndInitialize = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                if (!sessionActive) {
                    // User is logged in (cookie exists), but sessionStorage is empty.
                    // This means they opened a NEW tab or closed/reopened.
                    // Force logout.
                    console.log("AutoLogout: New tab detected, logging out.");
                    await supabase.auth.signOut();
                    router.push('/login');
                } else {
                    // Session is valid and active in this tab.
                    // Ensure flag is set (redundant but safe)
                    sessionStorage.setItem('verbact_session_active', 'true');
                }
            } else {
                // No session, ensure flag is cleared
                sessionStorage.removeItem('verbact_session_active');
            }
        };

        checkSessionAndInitialize();

        // Set flag on login (or if we are already explicitly collecting activity)
        // Actually, simply setting it here is safe if we survived the check above.
        // If we were logged out above, this won't matter much as next login will set it.
        // But to be precise: we should set it when we confirm a user IS logged in.
        // However, simpler: Just set it. If user is anon, it doesn't hurt. 
        // If user logs in effectively, we need to make sure we set this.
        // We can rely on 'onAuthStateChange' for that.

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || session) {
                sessionStorage.setItem('verbact_session_active', 'true');
            } else if (event === 'SIGNED_OUT') {
                sessionStorage.removeItem('verbact_session_active');
            }
        });

        // 2. Inactivity Logic
        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        // Throttle listeners slightly? Native events are fast, but Date.now is cheap.
        // Let's just add them.
        window.addEventListener('mousemove', updateActivity);
        window.addEventListener('keydown', updateActivity);
        window.addEventListener('click', updateActivity);
        window.addEventListener('scroll', updateActivity);
        window.addEventListener('touchstart', updateActivity);

        const intervalId = setInterval(async () => {
            const now = Date.now();
            if (now - lastActivityRef.current > INACTIVITY_LIMIT_MS) {
                // Double check session to avoid unnecessary redirects if already out
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log("AutoLogout: Inactivity limit reached.");
                    await supabase.auth.signOut();
                    router.push('/login');
                }
            }
        }, CHECK_INTERVAL_MS);

        return () => {
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
            window.removeEventListener('click', updateActivity);
            window.removeEventListener('scroll', updateActivity);
            window.removeEventListener('touchstart', updateActivity);
            clearInterval(intervalId);
            subscription.unsubscribe();
        };
    }, [router, supabase]);

    return <>{children}</>;
}
