"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { Play, Pause, Calendar, Clock, Download } from "lucide-react";
import AppHeader from "@/components/ui/AppHeader";
import TranscriptList from "@/components/ui/TranscriptList";
import { API_BASE_URL, WS_BASE_URL } from "@/utils/config";

interface TranscriptSegment {
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
}

interface SharedRecording {
    title: string;
    created_at: string;
    transcripts: TranscriptSegment[];
    is_live: boolean;
    audio_url: string;
    duration_seconds?: number;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [recording, setRecording] = useState<SharedRecording | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const transcriptRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchShare = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/shares/${token}`);
                if (!response.ok) {
                    if (response.status === 410) throw new Error("This share link has expired");
                    throw new Error("Failed to load shared recording");
                }

                const data = await response.json();
                setRecording(data);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to load recording";
                console.error("Error fetching share:", err);
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchShare();
    }, [token]);

    const [interimText, setInterimText] = useState("");

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

    // Live WebSocket Connection
    useEffect(() => {
        if (!recording || !recording.is_live) return;

        const ws = new WebSocket(`${WS_BASE_URL}/ws/watch/${token}`);

        ws.onopen = () => {
            console.log("Connected to live share");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const { transcript, is_final, confidence } = data;

                if (transcript) {
                    if (is_final) {
                        setRecording(prev => {
                            if (!prev) return null;

                            // Calculate start/end times based on previous segment or timestamp
                            const lastSegment = prev.transcripts[prev.transcripts.length - 1];
                            const startTime = lastSegment ? lastSegment.end_time : 0;
                            const duration = transcript.split(' ').length * 0.5; // Rough estimate

                            const newSegment: TranscriptSegment = {
                                id: crypto.randomUUID(),
                                text: transcript,
                                start_time: startTime,
                                end_time: startTime + duration,
                                confidence: confidence
                            };

                            return {
                                ...prev,
                                transcripts: [...prev.transcripts, newSegment]
                            };
                        });
                        setInterimText(""); // Clear interim when final arrives

                        // Auto-scroll to bottom for live
                        if (transcriptRef.current) {
                            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
                        }
                    } else {
                        // Update interim text
                        setInterimText(transcript);

                        // Auto-scroll for interim updates too
                        if (transcriptRef.current) {
                            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
                        }
                    }
                }
            } catch (e) {
                console.error("Error parsing live message:", e);
            }
        };

        return () => {
            ws.close();
        };
    }, [recording, token]);

    const togglePlay = async () => {
        if (audioRef.current) {
            try {
                if (isPlaying) {
                    audioRef.current.pause();
                } else {
                    await audioRef.current.play();
                }
                setIsPlaying(!isPlaying);
            } catch (e) {
                console.error("Playback error", e);
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
            } catch (e) {
                console.error("Playback error", e);
            }
        }
    };

    const handleSelectSegment = async (id?: string | number) => {
        if (!id || !recording) return;
        const target = recording.transcripts.find((t) => t.id === id);
        if (!target) return;
        await handleSegmentClick(target.start_time);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                <div className="bg-red-50 text-red-600 p-6 rounded-xl max-w-md">
                    <h3 className="text-xl font-bold mb-2">Unable to View Recording</h3>
                    <p>{error}</p>
                </div>
                <Link href="/" className="mt-8 text-blue-600 hover:underline">
                    Go to Verbact Home
                </Link>
            </div>
        );
    }

    if (!recording) return null;

    return (
        <div className="min-h-screen bg-white text-[#111111]">
            <AppHeader rightSlot={<Link href="/recordings" className="text-sm text-[#3454F5]">Record your own</Link>} />
            <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-tight">{recording.title}</h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#666666]">
                        <span className="inline-flex items-center">
                            <Calendar className="mr-1.5 h-4 w-4" />
                            {new Date(recording.created_at).toLocaleDateString()}
                        </span>
                        {recording.is_live && (
                            <span className="inline-flex items-center space-x-1 rounded-full bg-[#FEE2E2] px-2 py-1 text-[11px] font-semibold uppercase text-[#B91C1C]">
                                <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                                <span>Live</span>
                            </span>
                        )}
                        {recording.audio_url && (
                            <a
                                href={recording.audio_url}
                                download
                                className="inline-flex items-center rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-semibold text-[#111111]"
                            >
                                <Download className="mr-1.5 h-4 w-4" />
                                Download Audio
                            </a>
                        )}
                    </div>
                </div>

                {recording.audio_url && (
                    <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
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
                                    <span>{formatTimecode(duration || recording.duration_seconds || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <div className="mb-3 text-sm font-semibold text-[#111111]">Transcript</div>
                    <div
                        ref={transcriptRef}
                        className="max-h-[560px] overflow-y-auto rounded-lg border border-[#E5E7EB]"
                    >
                        {recording.transcripts && recording.transcripts.length > 0 ? (
                            <TranscriptList
                                items={recording.transcripts.map((segment) => ({
                                    id: segment.id,
                                    timecode: formatTimecode(segment.start_time),
                                    text: segment.text,
                                    active: segment.id === activeSegmentId,
                                }))}
                                onSelect={handleSelectSegment}
                            />
                        ) : (
                            !interimText && (
                                <div className="p-4 text-center text-sm text-[#666666]">
                                    Waiting for live transcription…
                                </div>
                            )
                        )}
                        {interimText && (
                            <div className="px-3 py-2 text-sm italic text-[#666666]">
                                {interimText}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 text-sm text-[#666666]">
                    Want your own live transcript?{" "}
                    <Link href="/recordings/new" className="text-[#3454F5]">
                        Start a recording
                    </Link>
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
