'use client'
import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AuthForm() {
    const supabase = createClient()
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [view, setView] = useState<'sign-in' | 'sign-up'>('sign-in')

    const handleGoogleLogin = async () => {
        setLoading(true)
        setError(null)
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        })
        if (error) {
            setError(error.message)
            setLoading(false)
        }
    }

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (view === 'sign-in') {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) {
                setError(error.message)
                setLoading(false)
            } else {
                router.push('/dashboard')
                router.refresh()
            }
        } else {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
                },
            })
            if (error) {
                setError(error.message)
                setLoading(false)
            } else {
                setError('Check your email for the confirmation link.')
                setLoading(false)
            }
        }
    }

    return (
        <div className="mt-8 space-y-6">
            {/* Google Login */}
            <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white text-black px-3 py-3 text-sm font-semibold shadow-sm hover:bg-gray-100 transition-all duration-200 disabled:opacity-50"
            >
                {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#A86CFF]" />
                ) : (
                    <>
                        <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        <span className="text-sm font-bold leading-6">Sign in with Google</span>
                    </>
                )}
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-[#0E0E12] px-2 text-[#666]">Or continue with email</span>
                </div>
            </div>

            {/* Email Login Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-4">
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
                    <div>
                        <label htmlFor="password" className="sr-only">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 text-white placeholder:text-[#666] focus:border-[#A86CFF] focus:ring-[#A86CFF] focus:outline-none focus:ring-1 sm:text-sm sm:leading-6 px-4 transition-colors"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <div className="text-right mt-2">
                                <a href="/forgot-password" className="text-xs font-medium text-[#A86CFF] hover:text-[#FF6F61] transition-colors">
                                    Forgot password?
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="text-[#FF6F61] text-sm text-center bg-[#FF6F61]/10 border border-[#FF6F61]/20 p-3 rounded-lg animate-in fade-in slide-in-from-top-1">
                        {error}
                    </div>
                )}

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative flex w-full justify-center items-center rounded-xl bg-gradient-brand px-3 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(168,108,255,0.3)] hover:shadow-[0_0_30px_rgba(168,108,255,0.5)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (view === 'sign-in' ? 'Sign in' : 'Sign up')}
                    </button>
                </div>

                <div className="text-center text-sm mt-6">
                    <button
                        type="button"
                        className="font-medium text-[#BFC2CF] hover:text-white transition-colors"
                        onClick={() => setView(view === 'sign-in' ? 'sign-up' : 'sign-in')}
                    >
                        {view === 'sign-in'
                            ? <span>Don't have an account? <span className="text-[#A86CFF]">Sign up</span></span>
                            : <span>Already have an account? <span className="text-[#A86CFF]">Sign in</span></span>}
                    </button>
                </div>
            </form>
        </div>
    )
}
