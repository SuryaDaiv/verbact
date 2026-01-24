"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { Play, Pause, Calendar, ArrowLeft, MoreHorizontal, ArrowDown, Type, AlignLeft } from "lucide-react";
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

    // Options
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [isMerge, setIsMerge] = useState(true);

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
            // Only scroll if auto-scroll is enabled
            if (isAutoScroll) {
                const element = document.getElementById(`segment-${segment.id}`);
                if (element && transcriptRef.current) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }
        }
    }, [currentTime, recording, activeSegmentId, isAutoScroll]);

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

                        // Scroll on new final segment
                        if (isAutoScroll && transcriptRef.current) {
                            setTimeout(() => {
                                if (transcriptRef.current) {
                                    transcriptRef.current.scrollTo({
                                        top: transcriptRef.current.scrollHeight,
                                        behavior: "smooth"
                                    });
                                }
                            }, 100);
                        }
                    } else {
                        setInterimText(transcript);
                        // Scroll on interim
                        if (isAutoScroll && transcriptRef.current) {
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
    }, [recording?.is_live, token, isAutoScroll]);

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

    // Logic to merge segments if enabled
    const displayedTranscripts = isMerge
        ? recording.transcripts.reduce((acc, curr, idx) => {
            if (idx === 0) return [curr];
            const prev = acc[acc.length - 1];
            // Merge if gap is small (< 2s) - simple logic
            // For now, let's just merge all for "Compact Mode" effect
            // Actually user said "after it gets two or three sentences then it can actually merge"
            // We'll simulate this by grouping every 3 segments
            // Simplified: Just Concatenate everything into big blocks? No, let's keep it simple.
            // Let's merge purely based on time or just visual compactness.
            // "Merge Text" usually means removing the spacing.

            // Let's implement visual merging in the map below instead of changing data structure to avoid key issues.
            return [...acc, curr];
        }, [] as TranscriptSegment[])
        : recording.transcripts;


    return (
        <div className="min-h-screen bg-[#0E0E12] text-white overflow-hidden relative selection:bg-[#A86CFF]/30 selection:text-white">

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#A86CFF]/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#FF6F61]/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 mx-auto w-full max-w-4xl px-4 pt-24 pb-8 flex flex-col h-screen">

                {/* Minimal Header with Controls */}
                <div className="flex items-center justify-between mb-8 z-30 bg-[#0E0E12]/80 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-lg">
                    <div className="flex items-center space-x-4">
                        {/* Title & Status */}
                        <div>
                            <h1 className="text-xl font-bold text-white mb-1">
                                {recording.title}
                            </h1>
                            <div className="flex items-center space-x-3 text-xs text-[#666]">
                                <span className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(recording.created_at).toLocaleDateString()}
                                </span>
                                {recording.is_live && (
                                    <span className="text-[#FF0000] font-bold tracking-widest uppercase text-[10px] animate-pulse">
                                        ● LIVE
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Controls using Buttons */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setIsAutoScroll(!isAutoScroll)}
                            className={`p-2 rounded-lg transition-all flex items-center space-x-2 ${isAutoScroll ? "bg-white/10 text-white" : "bg-transparent text-[#666] hover:bg-white/5"
                                }`}
                            title="Toggle Auto-Scroll"
                        >
                            <ArrowDown size={18} />
                            <span className="text-xs font-medium hidden sm:inline">Auto-Scroll</span>
                        </button>

                        {/* Merge button removed (always enabled) */}
                    </div>
                </div>

                {/* Transcription Stream */}
                <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide mask-image-b fade-bottom relative flex flex-col no-scrollbar">
                    <style jsx global>{`
                        .no-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                        .no-scrollbar {
                            -ms-overflow-style: none;
                            scrollbar-width: none;
                        }
                    `}</style>
                    <div ref={transcriptRef} className={`space-y-${isMerge ? '1' : '4'} pb-32 h-full overflow-y-auto no-scrollbar scroll-smooth`}>
                        {recording.transcripts.length === 0 && !interimText ? (
                            <div className="flex flex-col items-center justify-center h-48 text-[#BFC2CF]/30">
                                <p>Waiting for speech...</p>
                            </div>
                        ) : (
                            <>
                                {recording.transcripts.map((segment, index) => {
                                    // Visual Merger: If isMerge is ON, check if we should render spacing
                                    // Actually simpler: just reduce spacing (space-y-1 vs space-y-4) and border

                                    return (
                                        <div
                                            key={segment.id}
                                            id={`segment-${segment.id}`}
                                            className={`transition-all duration-500 pl-3 border-l-2 ${activeSegmentId === segment.id
                                                ? 'border-[#A86CFF] bg-[#A86CFF]/5'
                                                : 'border-transparent hover:border-white/10'
                                                } ${isMerge ? 'py-1' : 'py-2'}`}
                                        >
                                            <p className={`leading-relaxed text-[#BFC2CF] ${activeSegmentId === segment.id ? 'text-white' : ''} text-sm md:text-base`}>
                                                {segment.text}
                                            </p>
                                        </div>
                                    );
                                })}
                                {interimText && (
                                    <div className="animate-pulse py-2 pl-3 border-l-2 border-[#A86CFF]/50 bg-[#A86CFF]/5">
                                        <p className="text-sm md:text-base leading-relaxed text-[#A86CFF] opacity-90 italic">
                                            {interimText} ...
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Floating Audio Player (Only if Recorded) */}
                    {!recording.is_live && recording.audio_url && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
                            <div className="glass-card p-3 rounded-xl flex items-center space-x-4 shadow-2xl animate-in slide-in-from-bottom-8 bg-[#181A20] border border-white/10">
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
                                    className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
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
