'use client';

import React, { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
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
            id: 'free'
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
            id: 'unlimited'
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto max-w-4xl text-center">
                        <h2 className="text-base font-semibold leading-7 text-indigo-600">Pricing</h2>
                        <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                            Choose the right plan for you
                        </p>
                    </div>
                    <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
                        Start for free, upgrade when you need more power. Cancel anytime.
                    </p>

                    <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8">
                        {tiers.map((tier) => (
                            <div
                                key={tier.name}
                                className={`rounded-3xl p-8 ring-1 xl:p-10 ${tier.highlight
                                    ? 'bg-gray-900 ring-gray-900 text-white shadow-2xl scale-105 z-10'
                                    : 'bg-white ring-gray-200 text-gray-900 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-x-4">
                                    <h3 className={`text-lg font-semibold leading-8 ${tier.highlight ? 'text-white' : 'text-gray-900'}`}>
                                        {tier.name}
                                    </h3>
                                </div>
                                <p className={`mt-4 text-sm leading-6 ${tier.highlight ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {tier.description}
                                </p>
                                <p className="mt-6 flex items-baseline gap-x-1">
                                    <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                                    {tier.period && (
                                        <span className={`text-sm font-semibold leading-6 ${tier.highlight ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {tier.period}
                                        </span>
                                    )}
                                </p>
                                <button
                                    onClick={() => !tier.current && handleUpgrade(tier.id)}
                                    disabled={tier.current || loading !== null}
                                    className={`mt-6 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${tier.highlight
                                        ? 'bg-indigo-500 text-white hover:bg-indigo-400 focus-visible:outline-indigo-500'
                                        : tier.current
                                            ? 'bg-gray-100 text-gray-600 cursor-default'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                                        }`}
                                >
                                    {loading === tier.id ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    ) : (
                                        tier.cta
                                    )}
                                </button>
                                <ul role="list" className={`mt-8 space-y-3 text-sm leading-6 ${tier.highlight ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex gap-x-3">
                                            <Check className={`h-6 w-5 flex-none ${tier.highlight ? 'text-indigo-400' : 'text-indigo-600'}`} aria-hidden="true" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
