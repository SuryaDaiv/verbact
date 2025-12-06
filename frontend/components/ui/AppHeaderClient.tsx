'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { User as UserIcon, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface AppHeaderClientProps {
  rightSlot?: React.ReactNode;
  initialUser?: User | null;
  initialTier?: string;
  initialAuthError?: string | null;
}

export default function AppHeaderClient({
  rightSlot,
  initialUser = null,
  initialTier = "free",
  initialAuthError = null,
}: AppHeaderClientProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [tier, setTier] = useState<string>(initialTier);
  const [loading, setLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(initialAuthError);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setUser(initialUser);
    setTier(initialTier);
    setAuthError(initialAuthError);
    setLoading(false);
  }, [initialUser, initialTier, initialAuthError]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      setAuthError(null);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', session.user.id)
          .single();

        if (profile?.subscription_tier) {
          setTier(profile.subscription_tier);
        }
      } else {
        setTier('free');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await fetch('/auth/signout', { method: 'POST' });
    } catch (err) {
      console.error("AppHeader: sign out failed", err);
    } finally {
      setUser(null);
      setTier('free');
      router.push('/login');
      router.refresh();
    }
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
