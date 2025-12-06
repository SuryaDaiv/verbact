'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const lastActivityRef = useRef<number>(Date.now());

    useEffect(() => {
        const checkSessionAndInitialize = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    sessionStorage.setItem('verbact_session_active', 'true');
                } else {
                    sessionStorage.removeItem('verbact_session_active');
                }
            } catch (error) {
                console.error("AutoLogout: failed to check session", error);
            }
        };

        checkSessionAndInitialize();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || session) {
                sessionStorage.setItem('verbact_session_active', 'true');
            } else if (event === 'SIGNED_OUT') {
                sessionStorage.removeItem('verbact_session_active');
            }
        });

        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        window.addEventListener('mousemove', updateActivity);
        window.addEventListener('keydown', updateActivity);
        window.addEventListener('click', updateActivity);
        window.addEventListener('scroll', updateActivity);
        window.addEventListener('touchstart', updateActivity);

        const intervalId = setInterval(async () => {
            const now = Date.now();
            if (now - lastActivityRef.current > INACTIVITY_LIMIT_MS) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        console.log("AutoLogout: Inactivity limit reached.");
                        await supabase.auth.signOut();
                        router.push('/login');
                    }
                } catch (error) {
                    console.error("AutoLogout: inactivity check failed", error);
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
