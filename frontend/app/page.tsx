import Link from "next/link";
import { Mic, FileText, Zap, ArrowRight } from "lucide-react";
import AppHeader from "@/components/ui/AppHeader";
import FeatureCard from "@/components/ui/FeatureCard";
import FooterLinks from "@/components/ui/FooterLinks";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <AppHeader
        rightSlot={
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/login" className="text-[#666666] hover:text-[#111111]">
              Log in
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#111111] px-4 py-2 text-white hover:bg-black"
            >
              Sign up
            </Link>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-16 sm:px-6 sm:py-24">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Real-Time Transcription <br className="hidden sm:block" />
            <span className="text-[#3454F5]">Done Right.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[#666666] sm:text-xl">
            Fast, accurate, distraction-free transcription for meetings, calls, and conversations.
            No clutter, just clarity.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/recordings/new"
              className="inline-flex items-center justify-center rounded-lg bg-[#3454F5] px-6 py-3 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Recording
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-6 py-3 text-base font-semibold text-[#111111] hover:bg-[#F9FAFB]"
            >
              View Demo
            </Link>
          </div>
        </div>

        {/* Mockup / Visual */}
        <div className="mt-16 w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 sm:p-8">
          <div className="flex flex-col gap-4 rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#E5E7EB] pb-4">
              <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
              <div className="text-sm font-medium text-[#111111]">Live Session</div>
              <div className="ml-auto text-xs text-[#666666]">00:14</div>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-12 pt-1 text-xs font-medium text-[#666666]">0:02</div>
                <div className="text-base text-[#111111]">
                  Welcome to Verbact. This is how a clean transcript looks.
                </div>
              </div>
              <div className="flex gap-4 bg-[#F5F8FF] px-2 py-1 -mx-2 rounded">
                <div className="w-12 pt-1 text-xs font-medium text-[#666666]">0:08</div>
                <div className="relative text-base text-[#111111]">
                  <span className="absolute -left-3 top-1 h-4 w-[3px] rounded-full bg-[#3454F5]" />
                  It highlights the active segment subtly, without distraction.
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-12 pt-1 text-xs font-medium text-[#666666]">0:14</div>
                <div className="text-base text-[#111111]">
                  Everything is designed for readability and speed.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid gap-6 sm:grid-cols-3">
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
        <div className="mt-20">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF] text-[#3454F5]">
              <Zap className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-[#111111]">AI Meeting Assistant Coming Soon</h2>
            <p className="mx-auto max-w-lg text-[#666666]">
              Verbact will soon join your meetings automatically to generate smart notes and action items.
            </p>
            <div className="mt-4 flex justify-center">
              <Link href="/ai-assistant" className="text-sm font-semibold text-[#3454F5] hover:underline flex items-center">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
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
