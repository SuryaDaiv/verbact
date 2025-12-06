'use client';

import Link from "next/link";
import { MoreHorizontal, User as UserIcon, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface AppHeaderProps {
  rightSlot?: React.ReactNode;
}

export function AppHeader({ rightSlot }: AppHeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      console.log("AppHeader: Effect mounted - checking session");
      console.log("AppHeader: getUser started");
      console.log("AppHeader: SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log("AppHeader: API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL);
      try {
        // Create a timeout promise that rejects after 5 seconds
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );

        // Race the actual session check against the timeout
        const { data: { session }, error: sessionError } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]) as any;

        if (sessionError) {
          console.error("AppHeader: session error", sessionError);
          setAuthError("Unable to fetch session");
        }

        setUser(session?.user ?? null);

        if (session?.user) {
          console.log("AppHeader: Fetching profile for user", session.user.id);
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error("AppHeader: profile error", profileError);
            // Don't set authError here, as the user is logged in, just profile fetch failed.
            // Maybe they don't have a profile yet (race condition with trigger).
          }

          console.log("AppHeader: Fetched profile:", profile);
          if (profile) {
            setTier(profile.subscription_tier);
          }
        }
      } catch (error) {
        console.error("AppHeader: unexpected error or timeout", error);
        // If it's a timeout or other error, strictly speaking we don't know if they are logged in.
        // But to stop the spinner, we should assume 'not logged in' or just show 'error'.
        // For UX, assuming not logged in (and letting them try to login) is safer than hanging.
        setUser(null);
        setAuthError("Connection timeout");
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', session.user.id)
          .single();
        if (profile) setTier(profile.subscription_tier);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'pro': return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded border border-blue-400">PRO</span>;
      case 'unlimited': return <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded border border-purple-400">UNLIMITED</span>;
      default: return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded border border-gray-500">FREE</span>;
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full bg-white border-b border-[#E5E7EB]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3454F5] text-white text-sm font-semibold">
            V
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#111111]">
            Verbact
          </span>
        </Link>
        <div className="flex items-center space-x-4 text-[#666666]">
          {loading ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse" />
              <span>Connecting...</span>
            </div>
          ) : user ? (
            <>
              {tier === 'free' && (
                <Link href="/pricing" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  Upgrade
                </Link>
              )}
              <div className="flex items-center space-x-2 text-sm text-gray-900 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                <UserIcon className="h-4 w-4 text-gray-500" />
                <span className="max-w-[150px] truncate">{user.email}</span>
                {getTierBadge(tier)}
              </div>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <Link href="/pricing" className="text-sm font-medium hover:text-gray-900">Pricing</Link>
              <Link href="/login" className="text-sm font-medium hover:text-gray-900">Login</Link>
              {authError && (
                <span className="text-xs text-red-500">{authError}</span>
              )}
            </>
          )}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
