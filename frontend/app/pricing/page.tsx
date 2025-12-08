'use client';

import React, { useState, useEffect } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '@/utils/config';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [currentTier, setCurrentTier] = useState<string>('free');
    const router = useRouter();

    useEffect(() => {
        const getTier = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_tier')
                    .eq('id', session.user.id)
                    .single();
                if (profile) setCurrentTier(profile.subscription_tier);
            }
        };
        getTier();
    }, []);

    const handleUpgrade = async (tier: string) => {
        try {
            setLoading(tier);
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login?next=/pricing');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/payments/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    price_id: tier.toLowerCase(),
                    user_id: session.user.id,
                    email: session.user.email,
                    return_url: window.location.origin + '/dashboard',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error('Error upgrading:', error);
            alert('Failed to start upgrade. Please try again.');
        } finally {
            setLoading(null);
        }
    };

    const tiers = [
        {
            name: 'Free',
            price: '$0',
            description: 'Perfect for trying out Verbact.',
            features: ['10 minutes of transcription', 'Real-time transcription', 'Basic support'],
            cta: 'Current Plan',
            current: currentTier === 'free',
            id: 'free',
            highlight: false
        },
        {
            name: 'Pro',
            price: '$7',
            period: '/month',
            description: 'For professionals and creators.',
            features: ['1,200 minutes / month', 'Priority processing', 'Email support', 'Export to PDF/TXT'],
            cta: currentTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
            highlight: true,
            current: currentTier === 'pro',
            id: 'pro'
        },
        {
            name: 'Unlimited',
            price: '$15',
            period: '/month',
            description: 'For power users and businesses.',
            features: ['Unlimited transcription', 'Highest priority', '24/7 Priority support', 'Advanced analytics'],
            cta: currentTier === 'unlimited' ? 'Current Plan' : 'Go Unlimited',
            current: currentTier === 'unlimited',
            id: 'unlimited',
            highlight: false
        },
    ];

    return (
        <div className="min-h-screen bg-[#0E0E12] text-white py-24 sm:py-32 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-[#A86CFF]/10 to-transparent pointer-events-none" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-4xl text-center mb-16">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6">
                        <Sparkles className="w-4 h-4 text-[#A86CFF]" />
                        <span className="text-xs font-bold text-[#A86CFF] uppercase tracking-wider">Early Access Pricing</span>
                    </div>
                    <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
                        Choose the right plan for <span className="text-gradient hover:glow-text transition-all duration-300">you</span>
                    </h2>
                    <p className="text-lg leading-8 text-[#BFC2CF] max-w-2xl mx-auto">
                        Start for free, upgrade when you need more power. Cancel anytime.
                    </p>
                </div>

                <div className="isolate mx-auto grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`relative rounded-[28px] p-8 transition-all duration-300 ${tier.highlight
                                ? 'glass-card border-[#A86CFF]/50 shadow-[0_0_40px_rgba(168,108,255,0.15)] transform scale-105 z-10'
                                : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10'
                                }`}
                        >
                            {tier.highlight && (
                                <div className="absolute -top-4 -right-4">
                                    <span className="bg-[#A86CFF] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">MOST POPULAR</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-x-4">
                                <h3 className="text-xl font-bold text-white">
                                    {tier.name}
                                </h3>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-[#BFC2CF]">
                                {tier.description}
                            </p>
                            <p className="mt-6 flex items-baseline gap-x-1">
                                <span className="text-4xl font-bold tracking-tight text-white">{tier.price}</span>
                                {tier.period && (
                                    <span className="text-sm font-semibold leading-6 text-[#666]">
                                        {tier.period}
                                    </span>
                                )}
                            </p>
                            <button
                                onClick={() => !tier.current && handleUpgrade(tier.id)}
                                disabled={tier.current || loading !== null}
                                className={`mt-8 block w-full rounded-xl px-3 py-3 text-center text-sm font-bold shadow-sm transition-all duration-300 hover:scale-[1.02] ${tier.highlight
                                    ? 'bg-gradient-brand text-white hover:shadow-[0_0_25px_rgba(168,108,255,0.4)]'
                                    : tier.current
                                        ? 'bg-white/10 text-[#666] cursor-default hover:scale-100'
                                        : 'bg-white text-black hover:bg-gray-100'
                                    }`}
                            >
                                {loading === tier.id ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : (
                                    tier.cta
                                )}
                            </button>
                            <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-[#BFC2CF]">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex gap-x-3 items-center">
                                        <div className={`flex-none rounded-full p-1 ${tier.highlight ? 'bg-[#A86CFF]/20' : 'bg-white/10'}`}>
                                            <Check className={`h-3 w-3 ${tier.highlight ? 'text-[#A86CFF]' : 'text-white'}`} aria-hidden="true" />
                                        </div>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
