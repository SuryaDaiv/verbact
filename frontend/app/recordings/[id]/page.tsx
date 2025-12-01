"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, Calendar, Clock, Share2, Download, Trash2 } from "lucide-react";

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

                const response = await fetch(`http://localhost:8000/api/recordings/${id}?token=${session.access_token}`);
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

            const response = await fetch(`http://localhost:8000/api/recordings/${id}?token=${session.access_token}`, {
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error || !recording) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-red-500">
                <p className="text-xl font-semibold">{error || "Recording not found"}</p>
                <Link href="/recordings" className="mt-4 text-blue-600 hover:underline flex items-center">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Recordings
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <Link
                    href="/recordings"
                    className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Recordings
                </Link>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-4">
                            <h1 className="text-2xl font-bold text-gray-900">{recording.title}</h1>
                            <div className="flex space-x-2">
                                <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Share2 className="w-5 h-5" />
                                </button>
                                <a
                                    href={recording.audio_url}
                                    download
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Download className="w-5 h-5" />
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1.5" />
                                {new Date(recording.created_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1.5" />
                                {Math.floor(recording.duration_seconds / 60)}:{(recording.duration_seconds % 60).toString().padStart(2, '0')}
                            </div>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? "Deleting..." : (
                                    <>
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Audio Player */}
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
                                        style={{ width: `${(currentTime / recording.duration_seconds) * 100}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 -mt-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ left: `${(currentTime / recording.duration_seconds) * 100}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                                    <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}</span>
                                    <span>{Math.floor(recording.duration_seconds / 60)}:{(recording.duration_seconds % 60).toString().padStart(2, '0')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transcript */}
                    <div
                        ref={transcriptRef}
                        className="p-8 max-h-[600px] overflow-y-auto space-y-4 bg-white"
                    >
                        {recording.transcripts.map((segment) => (
                            <div
                                key={segment.id}
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
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
