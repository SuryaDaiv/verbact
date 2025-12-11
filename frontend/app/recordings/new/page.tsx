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
    <div className="min-h-screen bg-[#0E0E12] text-white pt-24">
      {/* Main Content Area */}
      <main className="w-full h-full">
        <AudioRecorder />
      </main>
    </div>
  );
}
