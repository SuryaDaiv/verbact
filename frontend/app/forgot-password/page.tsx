'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setError(null);

        const supabase = createClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage('Check your email for the password reset link.');
        }
        setLoading(false);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 bg-[#0E0E12] relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#A86CFF]/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md px-4">
                <div className="text-center mb-8">
                    <div className="inline-block relative w-12 h-12 mb-4 opacity-80">
                        <Image src="/logo.png" alt="Verbact" fill className="object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
                        Reset Password
                    </h2>
                    <p className="text-[#BFC2CF] text-sm">
                        Enter your email to receive recovery instructions
                    </p>
                </div>

                <div className="glass-card rounded-[24px] p-8 shadow-2xl backdrop-blur-xl border border-white/5">
                    <form onSubmit={handleReset} className="space-y-6">
                        <div>
                            <label htmlFor="email-address" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 text-white placeholder:text-[#666] focus:border-[#A86CFF] focus:ring-[#A86CFF] focus:outline-none focus:ring-1 sm:text-sm sm:leading-6 px-4 transition-colors"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        {message && (
                            <div className="text-[#00C853] text-sm text-center bg-[#00C853]/10 border border-[#00C853]/20 p-3 rounded-lg animate-in fade-in">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div className="text-[#FF6F61] text-sm text-center bg-[#FF6F61]/10 border border-[#FF6F61]/20 p-3 rounded-lg animate-in fade-in">
                                {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative flex w-full justify-center items-center rounded-xl bg-gradient-brand px-3 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(168,108,255,0.3)] hover:shadow-[0_0_30px_rgba(168,108,255,0.5)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                            </button>
                        </div>

                        <div className="text-center text-sm">
                            <Link href="/login" className="flex items-center justify-center font-medium text-[#BFC2CF] hover:text-white transition-colors gap-2 group">
                                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
