"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { Play, Pause, Calendar, ArrowLeft } from "lucide-react";
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
                            const lastSegment = prev.transcripts[prev.transcripts.length - 1];
                            const startTime = lastSegment ? lastSegment.end_time : 0;
                            const duration = transcript.split(' ').length * 0.5;

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
                        setInterimText("");
                        if (transcriptRef.current) {
                            transcriptRef.current.scrollTo({
                                top: transcriptRef.current.scrollHeight,
                                behavior: "smooth"
                            });
                        }
                    } else {
                        setInterimText(transcript);
                        if (transcriptRef.current) {
                            transcriptRef.current.scrollTo({
                                top: transcriptRef.current.scrollHeight,
                                behavior: "smooth"
                            });
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
    }, [recording?.is_live, token]);

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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0E0E12]">
                <div className="absolute inset-0 bg-gradient-radial from-[#A86CFF]/10 to-transparent pointer-events-none" />
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#A86CFF]"></div>
                <p className="text-sm text-[#BFC2CF] mt-4 tracking-wide">Connecting to stream...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#0E0E12] text-white">
                <div className="p-6 rounded-2xl bg-[#181A20] border border-white/5 max-w-md shadow-2xl">
                    <h3 className="text-xl font-bold mb-2 text-[#FF6F61]">Unavailable</h3>
                    <p className="text-[#BFC2CF] mb-6">{error}</p>
                    <Link href="/" className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    if (!recording) return null;

    return (
        <div className="min-h-screen bg-[#0E0E12] text-white overflow-hidden relative selection:bg-[#A86CFF]/30 selection:text-white">

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#A86CFF]/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#FF6F61]/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 mx-auto w-full max-w-4xl px-6 py-12 flex flex-col h-screen">

                {/* Minimal Header */}
                <div className="flex items-center justify-between mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-[#BFC2CF]">
                                {recording.title}
                            </h1>
                            {recording.is_live ? (
                                <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#FF0000]/10 border border-[#FF0000]/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF0000] animate-pulse" />
                                    <span className="text-[10px] font-bold text-[#FF0000] tracking-wider uppercase">LIVE</span>
                                </span>
                            ) : (
                                <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                    <span className="text-[10px] font-bold text-[#BFC2CF] tracking-wider uppercase">RECORDED</span>
                                </span>
                            )}
                        </div>
                        <div className="flex items-center text-xs text-[#666]">
                            <Calendar className="w-3 h-3 mr-1.5" />
                            {new Date(recording.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    </div>

                    <Link href="/" className="group p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 flex items-center justify-center hover:scale-110 active:scale-95">
                        <span className="text-lg font-bold text-white px-2">V</span>
                    </Link>
                </div>

                {/* Transcription Stream */}
                <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide mask-image-b fade-bottom relative flex flex-col no-scrollbar">
                    <style jsx global>{`
                        .no-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                        .no-scrollbar {
                            -ms-overflow-style: none;
                            scrollbar-width: none;
                        }
                    `}</style>
                    <div ref={transcriptRef} className="space-y-4 pb-32 h-full overflow-y-auto no-scrollbar scroll-smooth">
                        {recording.transcripts.length === 0 && !interimText ? (
                            <div className="flex flex-col items-center justify-center h-48 text-[#BFC2CF]/30">
                                <p>Waiting for speech...</p>
                            </div>
                        ) : (
                            <>
                                {recording.transcripts.map((segment) => (
                                    <div
                                        key={segment.id}
                                        id={`segment-${segment.id}`}
                                        className={`transition-all duration-500 py-1 pl-2 ${activeSegmentId === segment.id ? 'opacity-100 scale-[1.01] border-l-2 border-[#A86CFF]' : 'opacity-60 hover:opacity-80 border-l-2 border-transparent'}`}
                                    >
                                        <p className="text-lg leading-snug">
                                            {segment.text}
                                        </p>
                                    </div>
                                ))}
                                {interimText && (
                                    <div className="animate-pulse py-1 pl-2 border-l-2 border-[#A86CFF]/50">
                                        <p className="text-lg leading-snug text-[#A86CFF] opacity-90 italic">
                                            {interimText}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Floating Audio Player (Only if Recorded) */}
                    {!recording.is_live && recording.audio_url && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-20">
                            <div className="glass-card p-4 rounded-2xl flex items-center space-x-4 shadow-2xl animate-in slide-in-from-bottom-8">
                                <audio
                                    ref={audioRef}
                                    src={recording.audio_url}
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onEnded={() => setIsPlaying(false)}
                                    className="hidden"
                                />
                                <button
                                    onClick={togglePlay}
                                    className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                                >
                                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                                </button>
                                <div className="flex-1 space-y-1">
                                    <input
                                        type="range"
                                        min={0}
                                        max={duration || recording.duration_seconds || 0}
                                        value={currentTime}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            if (audioRef.current) audioRef.current.currentTime = val;
                                            setCurrentTime(val);
                                        }}
                                        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                    />
                                    <div className="flex justify-between text-[10px] text-[#BFC2CF] font-mono">
                                        <span>{formatTimecode(currentTime)}</span>
                                        <span>{formatTimecode(duration || recording.duration_seconds || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
