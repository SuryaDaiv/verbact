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

    return (
        <div className="min-h-screen bg-[#0E0E12] text-white overflow-hidden relative selection:bg-[#A86CFF]/30 selection:text-white">

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#A86CFF]/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#FF6F61]/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 mx-auto w-full max-w-4xl px-4 pt-24 pb-8 flex flex-col h-screen">

                {/* Transcription Stream */}
                <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide relative flex flex-col no-scrollbar pb-32">
                    <style jsx global>{`
                        .no-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                        .no-scrollbar {
                            -ms-overflow-style: none;
                            scrollbar-width: none;
                        }
                    `}</style>
                    <div ref={transcriptRef} className={`pb-32 h-full overflow-y-auto no-scrollbar scroll-smooth`}>
                        {recording.transcripts.length === 0 && !interimText ? (
                            <div className="flex flex-col items-center justify-center h-48 text-[#BFC2CF]/30">
                                <p>Waiting for speech...</p>
                            </div>
                        ) : (
                            <>
                                {(() => {
                                    // Combine existing transcripts with interim text for seamless rendering
                                    const allSegments: (TranscriptSegment & { isInterim?: boolean })[] = [...recording.transcripts];
                                    if (interimText) {
                                        const last = allSegments[allSegments.length - 1];
                                        const startTime = last ? last.end_time : 0;
                                        allSegments.push({
                                            id: 'interim-segment',
                                            text: interimText,
                                            start_time: startTime,
                                            end_time: startTime + 1,
                                            confidence: 0,
                                            isInterim: true
                                        });
                                    }

                                    // Merging Logic (Paragraphs)
                                    if (!isMerge) {
                                        // Standard List View
                                        return allSegments.map((segment) => (
                                            <div
                                                key={segment.id}
                                                id={`segment-${segment.id}`}
                                                className={`transition-all duration-500 pl-3 border-l-2 py-2 ${activeSegmentId === segment.id && !segment.isInterim
                                                    ? 'border-[#A86CFF] bg-[#A86CFF]/5'
                                                    : segment.isInterim
                                                        ? 'border-[#A86CFF]/50 bg-[#A86CFF]/5'
                                                        : 'border-transparent hover:border-white/10'
                                                    }`}
                                            >
                                                <p className={`leading-relaxed text-[#BFC2CF] ${activeSegmentId === segment.id ? 'text-white' : ''} ${segment.isInterim ? 'text-[#A86CFF] italic opacity-90' : ''} text-sm md:text-base`}>
                                                    {segment.text} {segment.isInterim ? '...' : ''}
                                                </p>
                                            </div>
                                        ));
                                    } else {
                                        // Merged Paragraph View
                                        const paragraphs: (TranscriptSegment & { isInterim?: boolean })[][] = [];
                                        let currentPara: (TranscriptSegment & { isInterim?: boolean })[] = [];

                                        allSegments.forEach((segment, idx) => {
                                            if (idx === 0) {
                                                currentPara.push(segment);
                                                return;
                                            }
                                            const prev = allSegments[idx - 1];
                                            const gap = segment.start_time - prev.end_time;

                                            if (gap > 1.5) {
                                                paragraphs.push(currentPara);
                                                currentPara = [segment];
                                            } else {
                                                currentPara.push(segment);
                                            }
                                        });
                                        if (currentPara.length > 0) paragraphs.push(currentPara);

                                        return paragraphs.map((para, pIdx) => (
                                            <div key={pIdx} className="mb-6 pl-3 border-l-2 border-transparent hover:border-white/5 transition-colors">
                                                <p className="leading-relaxed text-[#BFC2CF] text-sm md:text-base">
                                                    {para.map((segment) => (
                                                        <span
                                                            key={segment.id}
                                                            id={`segment-${segment.id}`}
                                                            className={`transition-colors duration-300 mr-1 ${segment.isInterim
                                                                    ? 'text-[#A86CFF] italic'
                                                                    : activeSegmentId === segment.id
                                                                        ? 'text-white bg-[#A86CFF]/20 rounded px-1'
                                                                        : ''
                                                                }`}
                                                        >
                                                            {segment.text}
                                                        </span>
                                                    ))}
                                                    {para.some(s => s.isInterim) && <span className="text-[#A86CFF] animate-pulse">...</span>}
                                                </p>
                                            </div>
                                        ));
                                    }
                                })()}
                            </>
                        )}
                    </div>

                    {/* Floating Audio Player (Only if Recorded) */}
                    {!recording.is_live && recording.audio_url && (
                        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
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

                {/* Minimal Header with Controls (Moved to Bottom) */}
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0E0E12]/90 backdrop-blur-md p-4 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                    <div className="mx-auto w-full max-w-4xl flex items-center justify-between">
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
                                onClick={() => setIsMerge(!isMerge)}
                                className={`p-2 rounded-lg transition-all flex items-center space-x-2 ${isMerge ? "bg-white/10 text-white" : "bg-transparent text-[#666] hover:bg-white/5"
                                    }`}
                                title="Toggle Merge Mode"
                            >
                                <AlignLeft size={18} />
                                <span className="text-xs font-medium hidden sm:inline">Text</span>
                            </button>
                            <div className="h-4 w-px bg-white/10 mx-2" />
                            <button
                                onClick={() => setIsAutoScroll(!isAutoScroll)}
                                className={`p-2 rounded-lg transition-all flex items-center space-x-2 ${isAutoScroll ? "bg-white/10 text-white" : "bg-transparent text-[#666] hover:bg-white/5"
                                    }`}
                                title="Toggle Auto-Scroll"
                            >
                                <ArrowDown size={18} />
                                <span className="text-xs font-medium hidden sm:inline">Auto-Scroll</span>
                            </button>
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
