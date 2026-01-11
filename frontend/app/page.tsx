import Link from "next/link";
import { Mic, FileText, Zap, ArrowRight, Play } from "lucide-react";
import FeatureCard from "@/components/ui/FeatureCard";
import FooterLinks from "@/components/ui/FooterLinks";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0E0E12] text-white overflow-hidden relative selection:bg-[#A86CFF]/30 selection:text-white">

      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-gradient-to-b from-[#A86CFF]/10 via-[#0E0E12]/50 to-[#0E0E12] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-[#FF6F61]/10 blur-[120px] rounded-full pointer-events-none" />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 py-20 sm:px-6 sm:py-32">

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-[#FF6F61] animate-pulse"></span>
            <span className="text-xs font-bold text-white tracking-wider uppercase">Live Now</span>
          </div>

          <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl mb-8 leading-tight">
            Real-Time Transcription <br className="hidden sm:block" />
            <span className="text-gradient hover:glow-text transition-all duration-500">Done Right.</span>
          </h1>

          <p className="max-w-2xl text-lg sm:text-xl text-[#BFC2CF] leading-relaxed mb-10">
            Fast, accurate, distraction-free transcription for meetings, calls, and conversations.
            No clutter, just clarity.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link
              href="/recordings/new"
              className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all duration-300 bg-gradient-brand rounded-full hover:scale-105 shadow-[0_0_20px_rgba(168,108,255,0.4)] hover:shadow-[0_0_40px_rgba(255,111,97,0.6)]"
            >
              Start Recording Free
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all duration-300 bg-white/5 border border-white/10 rounded-full hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>

          {/* Demo Preview */}
          <div className="mt-20 w-full max-w-4xl glass-card rounded-[24px] p-2 border border-white/10 shadow-2xl overflow-hidden backdrop-blur-lg">
            <div className="bg-[#181A20]/80 rounded-[20px] p-6 sm:p-10 text-left relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#A86CFF]/20 to-transparent blur-2xl" />

              <div className="flex flex-col gap-6 relative z-10">
                <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                  <div className="h-3 w-3 rounded-full bg-[#EF4444] animate-pulse" />
                  <div className="text-sm font-bold text-white uppercase tracking-wider">Live Session</div>
                  <div className="ml-auto text-xs font-mono text-[#666]">00:14</div>
                </div>

                <div className="space-y-6 font-medium">
                  <div className="flex gap-4 group">
                    <div className="w-12 pt-1 text-xs font-mono text-[#666] group-hover:text-[#A86CFF] transition-colors">0:02</div>
                    <div className="text-lg text-[#BFC2CF]">
                      Welcome to Verbact. This is how a clean transcript looks.
                    </div>
                  </div>
                  <div className="flex gap-4 relative">
                    {/* Active Indicator */}
                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#A86CFF] rounded-full shadow-[0_0_10px_#A86CFF]" />

                    <div className="w-12 pt-1 text-xs font-mono text-[#A86CFF]">0:08</div>
                    <div className="text-lg text-white">
                      It highlights the active segment subtly, without distraction.
                    </div>
                  </div>
                  <div className="flex gap-4 group">
                    <div className="w-12 pt-1 text-xs font-mono text-[#666] group-hover:text-[#A86CFF] transition-colors">0:14</div>
                    <div className="text-lg text-[#BFC2CF]">
                      Everything is designed for readability and speed.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-32 grid gap-8 sm:grid-cols-3">
          <FeatureCard
            icon={<Mic className="h-6 w-6" />}
            title="Live Transcription"
            description="Instant, low-latency speech-to-text powered by advanced AI models."
          />
          <FeatureCard
            icon={<FileText className="h-6 w-6" />}
            title="Clean Notes"
            description="Auto-generated summaries and key moments, formatted for quick review."
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Lightning Fast"
            description="Optimized for performance. No bloat, no lag, just instant results."
          />
        </div>

        {/* Coming Soon Teaser */}
        <div className="mt-32">
          <div className="relative overflow-hidden flex flex-col gap-6 rounded-[32px] border border-white/10 bg-gradient-to-b from-[#181A20] to-[#0E0E12] p-8 text-center sm:p-16">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-brand" />

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#A86CFF]/10 text-[#A86CFF] mb-4">
              <Zap className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-bold text-white">AI Meeting Assistant Coming Soon</h2>
            <p className="mx-auto max-w-lg text-lg text-[#BFC2CF]">
              Verbact will soon join your meetings automatically to generate smart notes and action items.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/ai-assistant" className="group inline-flex items-center text-sm font-bold text-[#A86CFF] hover:text-white transition-colors uppercase tracking-wider">
                Learn more <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <FooterLinks
        links={[
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
          { label: "Contact", href: "/contact" },
          { label: "Twitter", href: "#" },
        ]}
      />
    </div>
  );
}
