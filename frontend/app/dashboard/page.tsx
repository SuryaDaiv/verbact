import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Mic, ChevronRight } from 'lucide-react'

import DashboardRecordingsList from './DashboardRecordingsList';
import DashboardUsage from './DashboardUsage';

// Force rebuild
export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    return (
        <div className="min-h-screen bg-[#0E0E12] text-white">

            <main className="pt-24 pb-12">
                <div className="mx-auto max-w-5xl px-6 md:px-8">

                    {/* Welcome Section */}
                    <div className="mb-16 text-center">
                        <div className="inline-block p-1 rounded-full border border-white/5 bg-white/5 backdrop-blur-sm mb-6 animate-in fade-in zoom-in duration-500">
                            <div className="w-12 h-12 rounded-full bg-gradient-brand flex items-center justify-center shadow-[0_0_30px_rgba(168,108,255,0.3)]">
                                <Mic className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                            Welcome Back, <span className="text-gradient hover:glow-text transition-all duration-300">Creator.</span>
                        </h1>
                        <p className="text-[#BFC2CF] max-w-lg mx-auto text-lg leading-relaxed">
                            Your voice is ready to be captured. Start a new session or review your archives.
                        </p>
                    </div>

                    {/* Main CTA */}
                    <div className="mb-20 flex justify-center">
                        <Link
                            href="/recordings/new"
                            className="group relative inline-flex items-center justify-center px-10 py-5 text-lg font-bold text-white transition-all duration-300 bg-gradient-brand rounded-full hover:scale-105 shadow-[0_0_20px_rgba(168,108,255,0.4)] hover:shadow-[0_0_40px_rgba(255,111,97,0.6)]"
                        >
                            <span className="relative z-10 flex items-center">
                                Start New Recording
                                <ChevronRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                            </span>
                            {/* Inner Shine */}
                            <div className="absolute inset-0 rounded-full bg-white/20 blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                        </Link>
                    </div>


                    {/* Usage Stats (Synced from Mobile) */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-50">
                        <DashboardUsage />
                    </div>

                    {/* Recent Recordings */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-4">
                            <div>
                                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#BFC2CF]">Recent Sessions</h2>
                                <p className="text-xs text-[#666] mt-1 uppercase tracking-widest">Archive</p>
                            </div>
                            <Link href="/recordings" className="text-sm font-medium text-[#A86CFF] hover:text-[#FF6F61] transition-colors flex items-center group">
                                View all <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                        <DashboardRecordingsList token={user.id} />
                    </div>
                </div>
            </main >
        </div >
    )
}


