"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, Calendar, Clock, Download, Trash2, Search } from "lucide-react";
import TranscriptList from "@/components/ui/TranscriptList";
import KeyMomentsList from "@/components/ui/KeyMomentsList";
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

            router.push("/recordings");
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

    const transcriptItems = filteredTranscripts.map((segment) => ({
        id: segment.id,
        timecode: formatTimecode(segment.start_time),
        text: segment.text,
        active: segment.id === activeSegmentId,
    }));

    const keyMoments = filteredTranscripts.slice(0, 3).map((segment) => ({
        label: segment.text.substring(0, 60) + (segment.text.length > 60 ? "…" : ""),
        time: formatTimecode(segment.start_time),
    }));

    const handleSelectSegment = async (segmentId?: string | number) => {
        if (!segmentId || !recording) return;
        const target = recording.transcripts.find((t) => t.id === segmentId);
        if (!target) return;
        await handleSegmentClick(target.start_time);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3454F5] border-t-transparent" />
            </div>
        );
    }

    if (error || !recording) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-white text-[#B91C1C]">
                <p className="text-lg font-semibold">{error || "Recording not found"}</p>
                <Link href="/recordings" className="mt-4 inline-flex items-center text-sm text-[#3454F5]">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back to Recordings
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-[#111111]">
            <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
                <div className="mb-4 flex items-center text-sm text-[#666666]">
                    <Link href="/recordings" className="inline-flex items-center text-[#3454F5]">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Link>
                </div>

                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-tight">{recording.title}</h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#666666]">
                        <span className="inline-flex items-center">
                            <Calendar className="mr-1.5 h-4 w-4" />
                            {new Date(recording.created_at).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center">
                            <Clock className="mr-1.5 h-4 w-4" />
                            {formatTimecode(recording.duration_seconds)}
                        </span>
                        <a
                            href={recording.audio_url}
                            download
                            className="inline-flex items-center rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-semibold text-[#111111]"
                        >
                            <Download className="mr-1.5 h-4 w-4" />
                            Download Audio
                        </a>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="inline-flex items-center rounded-lg border border-[#FCA5A5] px-3 py-1.5 text-sm font-semibold text-[#B91C1C] disabled:opacity-50"
                        >
                            {isDeleting ? "Deleting…" : (<><Trash2 className="mr-1.5 h-4 w-4" /> Delete</>)}
                        </button>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <audio
                                ref={audioRef}
                                src={recording.audio_url}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onEnded={() => setIsPlaying(false)}
                                className="hidden"
                            />
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={togglePlay}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#3454F5] text-[#3454F5]"
                                    aria-label={isPlaying ? "Pause" : "Play"}
                                >
                                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </button>
                                <div className="flex flex-1 flex-col gap-1">
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
                                        className="h-1 w-full accent-[#3454F5]"
                                    />
                                    <div className="flex justify-between text-[11px] text-[#666666]">
                                        <span>{formatTimecode(currentTime)}</span>
                                        <span>{formatTimecode(duration || recording.duration_seconds)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-[#111111]">Transcript</div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <div className="flex items-center rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#666666]">
                                <Search className="mr-2 h-4 w-4" />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search transcript"
                                    className="w-full bg-transparent text-sm outline-none"
                                />
                            </div>
                            <div className="flex gap-2 text-xs font-semibold text-[#666666]">
                                <span className="rounded-full border border-[#E5E7EB] px-3 py-1">All</span>
                                <span className="rounded-full border border-[#E5E7EB] px-3 py-1">Important</span>
                                <span className="rounded-full border border-[#E5E7EB] px-3 py-1">Speaker A/B</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                        <div
                            ref={transcriptRef}
                            className="max-h-[540px] overflow-y-auto rounded-lg border border-[#E5E7EB]"
                        >
                            <TranscriptList items={transcriptItems} onSelect={handleSelectSegment} />
                        </div>
                        <div className="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] p-3">
                            <div className="text-sm font-semibold text-[#111111]">Key moments</div>
                            <KeyMomentsList moments={keyMoments} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function formatTimecode(value: number) {
    if (!value || Number.isNaN(value)) return "0:00";
    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
