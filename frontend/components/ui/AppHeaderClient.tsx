'use client';

import Link from "next/link";
import Image from "next/image";
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
      case 'pro': return <span className="text-[#A86CFF] text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border border-[#A86CFF]/30 bg-[#A86CFF]/10">PRO</span>;
      case 'unlimited': return <span className="text-[#A86CFF] text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border border-[#A86CFF]/30 bg-[#A86CFF]/10">UNLIMITED</span>;
      default: return null;
    }
  };

  return (
    <header className="fixed top-0 z-50 w-full bg-[#0E0E12]/90 backdrop-blur-md border-b border-white/5 p-6">
      <div className="mx-auto flex items-center justify-between">

        {/* Left: Brand Monogram */}
        <Link href="/" className="group relative flex items-center justify-center p-2 rounded-xl hover:bg-white/5 transition-colors">
          <div className="relative h-10 w-10 overflow-hidden">
            <Image
              src="/logo.png"
              alt="Verbact Logo"
              fill
              className="object-contain"
            />
          </div>
          {/* Optional glow effect behind logo */}
          <div className="absolute inset-0 bg-[#A86CFF] opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 rounded-full" />
        </Link>

        {/* Right: User User/Nav */}
        <div className="flex items-center space-x-6">
          {loading ? (
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="h-2 w-2 bg-[#FFB55A] rounded-full animate-pulse" />
              <span>Connecting...</span>
            </div>
          ) : user ? (
            <div className="flex items-center space-x-6">

              {/* User Profile */}
              <div className="flex items-center space-x-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-white/90">{user.email?.split('@')[0]}</span>
                  {getTierBadge(tier)}
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#181A20] to-[#252830] border border-white/10 flex items-center justify-center shadow-lg">
                  <UserIcon className="h-5 w-5 text-[#BFC2CF]" />
                </div>
              </div>

              {/* Logout (Minimal) */}
              <button
                onClick={handleSignOut}
                className="text-[#666] hover:text-[#FF6F61] transition-colors p-2"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-6">
              <Link href="/pricing" className="text-sm font-medium text-[#BFC2CF] hover:text-white transition-colors">Pricing</Link>
              <Link href="/login" className="px-5 py-2 rounded-full border border-white/10 text-sm font-medium text-white hover:bg-white/5 transition-all hover:border-[#A86CFF]/50 hover:shadow-[0_0_15px_rgba(168,108,255,0.3)]">
                Login
              </Link>
              {authError && (
                <span className="text-xs text-[#FF6F61]">{authError}</span>
              )}
            </div>
          )}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
