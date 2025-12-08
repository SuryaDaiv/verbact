```
"use client";

import dynamic from "next/dynamic";
import LiveSessionHeader from "@/components/ui/LiveSessionHeader";
import { Mic } from "lucide-react";

const AudioRecorder = dynamic(() => import("@/components/AudioRecorder"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#A86CFF]"></div>
        <p className="text-sm text-[#BFC2CF]">Loading recorder...</p>
    </div>
  ),
});

export default function NewRecordingPage() {
  const now = new Date();
  const dateLabel = now.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#0E0E12] text-white">
      {/* Header */}
      <div className="w-full border-b border-white/5 bg-[#0E0E12]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-3">
            <div className="flex flex-col">
                <div className="text-xs uppercase tracking-wide text-[#FF6F61] font-bold">Live Recording</div>
                <div className="text-lg font-bold text-white">New Session</div>
                <div className="text-xs text-[#666]">{dateLabel}</div>
            </div>
            <span className="inline-flex items-center space-x-1 rounded-full bg-[#FF0000]/10 border border-[#FF0000]/20 px-2 py-1 text-[11px] font-bold uppercase text-[#FF0000]">
                <span className="h-2 w-2 rounded-full bg-[#FF0000] animate-pulse" />
                <span>Live</span>
            </span>
            </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 rounded-[24px] border border-white/5 bg-white/5 p-6 backdrop-blur-xl hover:border-white/10 transition-colors">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-[#A86CFF]" />
                Capture and share instantly
            </h2>
            <p className="text-sm leading-relaxed text-[#BFC2CF]">
              Tap record to start streaming audio and transcripts in real time. The feed stays lightweight and mobile-friendly.
            </p>
          </div>
          
          <div className="rounded-2xl border border-white/5 bg-[#0E0E12]/50 overflow-hidden">
            <AudioRecorder />
          </div>
        </div>
      </main>
    </div>
  );
}
```
