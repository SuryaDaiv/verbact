import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error("Auth session load error:", error);
                    if (error.message.includes("Refresh Token Not Found") || error.message.includes("Invalid Refresh Token")) {
                        // Token is dead, clear it
                        await supabase.auth.signOut();
                        setSession(null);
                        setUser(null);
                    }
                } else {
                    setSession(session);
                    setUser(session?.user ?? null);
                }
            } catch (err: any) {
                console.error("Auth initialization exception:", err);
                // Force cleanup if something goes really wrong
                if (err?.message?.includes("Invalid Refresh Token")) {
                    await supabase.auth.signOut();
                }
            } finally {
                setLoading(false);
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
