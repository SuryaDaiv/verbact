"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, Calendar, Clock, Download, Trash2, Search, Mic } from "lucide-react";
import { API_BASE_URL } from "@/utils/config";

interface TranscriptSegment {
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
}

interface Recording {
    id: string;
    title: string;
    created_at: string;
    duration_seconds: number;
    audio_url: string;
    transcripts: TranscriptSegment[];
}

export default function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [recording, setRecording] = useState<Recording | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [duration, setDuration] = useState(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const transcriptRef = useRef<HTMLDivElement | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchRecording = async () => {
            try {
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    setError("Please log in to view this recording");
                    setLoading(false);
                    return;
                }

                const response = await fetch(`${API_BASE_URL}/api/recordings/${id}?token=${session.access_token}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch recording");
                }

                const data = await response.json();
                setRecording(data);
            } catch (err) {
                console.error("Error fetching recording:", err);
                setError("Failed to load recording");
            } finally {
                setLoading(false);
            }
        };

        fetchRecording();
    }, [id]);

    // Audio-Text Sync Logic
    useEffect(() => {
        if (!recording) return;

        const segment = recording.transcripts.find(
            (t) => currentTime >= t.start_time && currentTime <= t.end_time
        );

        if (segment && segment.id !== activeSegmentId) {
            setActiveSegmentId(segment.id);

            // Auto-scroll to active segment
            const element = document.getElementById(`segment-${segment.id}`);
            if (element && transcriptRef.current) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [currentTime, recording, activeSegmentId]);

    const togglePlay = async () => {
        if (audioRef.current) {
            try {
                if (isPlaying) {
                    audioRef.current.pause();
                } else {
                    await audioRef.current.play();
                }
                setIsPlaying(!isPlaying);
            } catch (err) {
                console.error("Playback error:", err);
                setIsPlaying(false);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current?.duration) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSegmentClick = async (startTime: number) => {
        if (audioRef.current) {
            try {
                audioRef.current.currentTime = startTime;
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (err) {
                console.error("Playback error:", err);
            }
        }
    };

    const handleDelete = async () => {
        const confirmed = window.confirm("Delete this recording? This will remove the audio, transcript, and any share links.");
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const { createClient } = await import('@/utils/supabase/client');
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch(`${API_BASE_URL}/api/recordings/${id}?token=${session.access_token}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete recording");
            }

            router.push("/dashboard");
        } catch (err) {
            console.error("Error deleting recording:", err);
            alert("Failed to delete recording. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredTranscripts = recording?.transcripts.filter((segment) =>
        segment.text.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#A86CFF] border-t-transparent" />
            </div>
        );
    }

    if (error || !recording) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] text-white">
                <p className="text-lg font-semibold text-[#FF6F61]">{error || "Recording not found"}</p>
                <Link href="/dashboard" className="mt-4 inline-flex items-center text-sm text-[#A86CFF] hover:underline">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0E0E12] text-white">
            <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
                <div className="mb-6 flex items-center text-sm">
                    <Link href="/dashboard" className="inline-flex items-center text-[#BFC2CF] hover:text-white transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                    </Link>
                </div>

                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-2">{recording.title}</h1>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-[#BFC2CF] font-medium">
                                <span className="inline-flex items-center">
                                    <Calendar className="mr-1.5 h-4 w-4 opacity-70" />
                                    {new Date(recording.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                                <span className="inline-flex items-center">
                                    <Clock className="mr-1.5 h-4 w-4 opacity-70" />
                                    {formatTimecode(recording.duration_seconds)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <a
                                href={recording.audio_url}
                                download
                                className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Audio
                            </a>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="inline-flex items-center rounded-lg border border-[#FF6F61]/30 bg-[#FF6F61]/10 px-4 py-2 text-sm font-semibold text-[#FF6F61] hover:bg-[#FF6F61]/20 disabled:opacity-50 transition-colors"
                            >
                                {isDeleting ? "Deleting…" : (<><Trash2 className="mr-2 h-4 w-4" /> Delete</>)}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Audio Player Card */}
                <div className="mb-6 rounded-2xl border border-white/10 bg-[#181A20] p-6 shadow-xl">
                    <div className="flex flex-col gap-4">
                        <audio
                            ref={audioRef}
                            src={recording.audio_url}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={() => setIsPlaying(false)}
                            className="hidden"
                        />
                        <div className="flex items-center gap-4">
                            <button
                                onClick={togglePlay}
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#A86CFF] text-white hover:bg-[#9755f5] hover:scale-105 transition-all shadow-lg shadow-[#A86CFF]/20"
                                aria-label={isPlaying ? "Pause" : "Play"}
                            >
                                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-1" />}
                            </button>
                            <div className="flex flex-1 flex-col gap-2">
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || recording.duration_seconds || 0}
                                    step={0.1}
                                    value={currentTime}
                                    onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (audioRef.current) {
                                            audioRef.current.currentTime = value;
                                        }
                                        setCurrentTime(value);
                                    }}
                                    className="h-1.5 w-full appearance-none rounded-full bg-white/10 accent-[#A86CFF] hover:accent-[#9755f5] cursor-pointer"
                                />
                                <div className="flex justify-between text-xs font-mono text-[#BFC2CF]">
                                    <span>{formatTimecode(currentTime)}</span>
                                    <span>{formatTimecode(duration || recording.duration_seconds)}</span>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transcript Section */}
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#181A20] p-6 h-[600px] flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 text-white font-semibold">
                            <Mic className="w-4 h-4 text-[#A86CFF]" />
                            Transcript
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search transcript..."
                                className="w-full sm:w-64 bg-[#0E0E12] border border-white/10 rounded-full py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-[#A86CFF]"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        <div
                            ref={transcriptRef}
                            className="h-full overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
                        >
                            {filteredTranscripts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-[#BFC2CF]/40">
                                    <p>No matching text found</p>
                                </div>
                            ) : (
                                filteredTranscripts.map((segment) => (
                                    <div
                                        key={segment.id}
                                        id={`segment-${segment.id}`}
                                        onClick={() => handleSegmentClick(segment.start_time)}
                                        className={`group px-3 py-2 rounded-lg cursor-pointer transition-all border border-transparent ${segment.id === activeSegmentId
                                            ? "bg-[#A86CFF]/10 border-[#A86CFF]/20 text-white"
                                            : "hover:bg-white/5 text-[#BFC2CF] hover:text-white"
                                            }`}
                                    >
                                        <div className="flex gap-4">
                                            <span className="flex-shrink-0 text-xs font-mono text-[#666] pt-1 w-12 group-hover:text-[#A86CFF]/70 transition-colors">
                                                {formatTimecode(segment.start_time)}
                                            </span>
                                            <p className="text-base leading-relaxed">{segment.text}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Bottom fade mask */}
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#181A20] to-transparent pointer-events-none" />
                    </div>
                </div>
            </main>
        </div>
    );
}

function formatTimecode(value: number) {
    if (!value || Number.isNaN(value) || !Number.isFinite(value)) return "0:00";

    // Heuristic for different time units
    if (value > 86400) { // If > 24 hours, it's likely not seconds
        if (value > 10000000) { // > 10 million: assume microseconds (e.g. 29,000,000 = 29s)
            value = value / 1000000;
        } else { // Assume milliseconds
            value = value / 1000;
        }
    }

    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
