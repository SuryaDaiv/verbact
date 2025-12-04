"use client";

import dynamic from "next/dynamic";
import LiveSessionHeader from "@/components/ui/LiveSessionHeader";

const AudioRecorder = dynamic(() => import("@/components/AudioRecorder"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-[#666666]">Loading recorder…</p>,
});

export default function NewRecordingPage() {
  const now = new Date();
  const dateLabel = now.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <LiveSessionHeader title="Live Recording" dateLabel={dateLabel} showLive />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold text-[#111111]">Capture and share instantly</div>
            <p className="text-sm leading-6 text-[#666666]">
              Tap record to start streaming audio and transcripts in real time. The feed stays lightweight and mobile-friendly.
            </p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-white">
            <AudioRecorder />
          </div>
        </div>
      </main>
    </div>
  );
}
