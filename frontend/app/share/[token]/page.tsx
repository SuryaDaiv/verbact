"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { Play, Pause, Calendar, Download, ExternalLink } from "lucide-react";
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
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [recording, setRecording] = useState<SharedRecording | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

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
                const data = JSON.parse(event.data) as {
                    transcript?: string;
                    is_final?: boolean;
                    confidence?: number;
                };
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
                                confidence: confidence ?? 0
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
    }, [recording?.is_live, token]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleSegmentClick = (startTime: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = startTime;
            audioRef.current.play();
            setIsPlaying(true);
        }
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
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold">V</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">Verbact</span>
                    </div>
                    <Link
                        href="/dashboard"
                        className="text-sm text-blue-600 hover:underline flex items-center"
                    >
                        Create your own <ExternalLink className="w-3 h-3 ml-1" />
                    </Link>
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">{recording.title}</h1>
                                <div className="flex items-center space-x-4 text-sm text-gray-600">
                                    <div className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-1.5" />
                                        {new Date(recording.created_at).toLocaleDateString()}
                                    </div>
                                    {recording.is_live && (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold animate-pulse">
                                            LIVE
                                        </span>
                                    )}
                                </div>
                            </div>

                            {recording.audio_url && (
                                <a
                                    href={recording.audio_url}
                                    download
                                    className="flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors text-sm font-medium"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Audio
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Audio Player */}
                    {recording.audio_url && (
                        <div className="p-6 bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                            <audio
                                ref={audioRef}
                                src={recording.audio_url}
                                onTimeUpdate={handleTimeUpdate}
                                onEnded={() => setIsPlaying(false)}
                                className="w-full hidden"
                            />

                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={togglePlay}
                                    className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg transform hover:scale-105"
                                >
                                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                                </button>

                                <div className="flex-1">
                                    <div className="relative w-full h-2 bg-gray-200 rounded-full cursor-pointer group"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const percent = (e.clientX - rect.left) / rect.width;
                                            if (audioRef.current) {
                                                audioRef.current.currentTime = percent * audioRef.current.duration;
                                            }
                                        }}>
                                        <div
                                            className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-100"
                                            style={{ width: `${audioRef.current ? (currentTime / audioRef.current.duration) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                                        <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}</span>
                                        <span>--:--</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Transcript */}
                    <div
                        ref={transcriptRef}
                        className="p-8 max-h-[600px] overflow-y-auto space-y-4 bg-white"
                    >
                        {recording.transcripts && recording.transcripts.length > 0 ? (
                            recording.transcripts.map((segment) => (
                                <div
                                    key={segment.id || Math.random()}
                                    id={`segment-${segment.id}`}
                                    onClick={() => handleSegmentClick(segment.start_time)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ${activeSegmentId === segment.id
                                        ? "bg-blue-50 border-l-4 border-blue-500 shadow-sm"
                                        : "border-l-4 border-transparent"
                                        }`}
                                >
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-xs font-mono text-gray-400">
                                            {Math.floor(segment.start_time / 60)}:{(Math.floor(segment.start_time) % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <p className={`text-lg leading-relaxed ${activeSegmentId === segment.id ? "text-gray-900 font-medium" : "text-gray-600"
                                        }`}>
                                        {segment.text}
                                    </p>
                                </div>
                            ))
                        ) : (
                            !interimText && (
                                <div className="text-center py-12 text-gray-400 italic">
                                    Waiting for live transcription...
                                </div>
                            )
                        )}

                        {/* Interim Text Display */}
                        {interimText && (
                            <div className="p-3 rounded-lg border-l-4 border-blue-200 bg-blue-50/50 animate-pulse">
                                <p className="text-lg leading-relaxed text-gray-500 italic">
                                    {interimText}
                                    <span className="inline-block w-1 h-4 bg-blue-400 ml-1 animate-pulse"></span>
                                </p>
                            </div>
                        )}
                        <div className="h-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}
