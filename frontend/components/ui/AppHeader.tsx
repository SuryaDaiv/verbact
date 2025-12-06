import { createClient } from "@/utils/supabase/server";
import { User } from "@supabase/supabase-js";
import AppHeaderClient from "./AppHeaderClient";

interface AppHeaderProps {
  rightSlot?: React.ReactNode;
}

export default async function AppHeader({ rightSlot }: AppHeaderProps) {
  const supabase = await createClient();

  let user: User | null = null;
  let tier = "free";
  let authError: string | null = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.message === "Auth session missing!" || error.status === 400) {
        // Treat missing session as logged-out without showing an error
        authError = null;
        user = null;
      } else {
        authError = error.message;
      }
    } else {
      user = data.user;
    }

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (profile?.subscription_tier) {
        tier = profile.subscription_tier;
      } else if (profileError) {
        authError = profileError.message;
      }
    }
  } catch (error: any) {
    authError = error?.message ?? "Unable to fetch session";
  }

  return (
    <AppHeaderClient
      rightSlot={rightSlot}
      initialUser={user}
      initialTier={tier}
      initialAuthError={authError}
    />
  );
}
