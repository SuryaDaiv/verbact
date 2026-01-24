"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Clock, Shield, Zap } from 'lucide-react';
import { API_BASE_URL } from '@/utils/config';
import Link from 'next/link';

interface UsageData {
    remaining_seconds: number;
    limit_seconds: number;
    used_seconds: number;
    tier: string;
}

export default function DashboardUsage() {
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const response = await fetch(`${API_BASE_URL}/api/user/usage?token=${session.access_token}`);
                if (response.ok) {
                    const data = await response.json();
                    setUsage(data);
                }
            } catch (err) {
                console.error("Failed to fetch usage:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, []);

    const formatTime = (seconds: number | undefined | null) => {
        if (seconds === undefined || seconds === null || isNaN(seconds)) return "0m";
        if (seconds === -1) return "Unlimited";
        const mins = Math.floor(seconds / 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) return `${hrs}h ${mins % 60}m`;
        return `${mins}m`;
    };

    if (loading) {
        return (
            <div className="animate-pulse flex space-x-4 mb-8">
                <div className="h-24 bg-white/5 rounded-xl flex-1"></div>
                <div className="h-24 bg-white/5 rounded-xl flex-1"></div>
                <div className="h-24 bg-white/5 rounded-xl flex-1"></div>
            </div>
        );
    }

    const tier = usage?.tier || 'free';
    const isPro = tier !== 'free';

    return (
        <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <Zap className="w-5 h-5 mr-2 text-[#FFB02E]" />
                        Your Plan: <span className="text-[#FFB02E] ml-2 uppercase tracking-wider">{tier}</span>
                    </h2>
                    <p className="text-sm text-[#BFC2CF]">
                        {isPro ? "You are on the Pro plan." : "Upgrade to unlock more recording time."}
                    </p>
                </div>
                {!isPro && (
                    <Link href="/pricing" className="px-4 py-2 bg-[#A86CFF]/10 hover:bg-[#A86CFF]/20 border border-[#A86CFF]/50 rounded-full text-[#A86CFF] text-sm font-bold transition-colors">
                        Upgrade Plan
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Remaining Time */}
                <div className="bg-[#181A20] border border-white/5 p-5 rounded-xl flex items-center space-x-4">
                    <div className="p-3 bg-[#A86CFF]/10 rounded-full">
                        <Clock className="w-6 h-6 text-[#A86CFF]" />
                    </div>
                    <div>
                        <p className="text-[#BFC2CF] text-xs uppercase tracking-wider font-bold">Remaining</p>
                        <p className="text-2xl font-bold text-white">{usage ? formatTime(usage.remaining_seconds) : '--'}</p>
                    </div>
                </div>

                {/* Monthly Limit */}
                <div className="bg-[#181A20] border border-white/5 p-5 rounded-xl flex items-center space-x-4">
                    <div className="p-3 bg-white/5 rounded-full">
                        <Shield className="w-6 h-6 text-white/50" />
                    </div>
                    <div>
                        <p className="text-[#BFC2CF] text-xs uppercase tracking-wider font-bold">Monthly Limit</p>
                        <p className="text-2xl font-bold text-white">{usage ? formatTime(usage.limit_seconds) : '--'}</p>
                    </div>
                </div>

                {/* Used */}
                <div className="bg-[#181A20] border border-white/5 p-5 rounded-xl flex items-center space-x-4">
                    <div className="p-3 bg-white/5 rounded-full">
                        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/80 animate-spin-slow" />
                    </div>
                    <div>
                        <p className="text-[#BFC2CF] text-xs uppercase tracking-wider font-bold">Minutes Used</p>
                        <p className="text-2xl font-bold text-white">{usage ? formatTime(usage.used_seconds) : '--'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
