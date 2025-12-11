"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Calendar, Clock, FileAudio, Trash2, Mic } from "lucide-react";
import { API_BASE_URL } from "@/utils/config";

interface Recording {
    id: string;
    title: string;
    created_at: string;
    duration_seconds: number;
    audio_url: string;
}

export default function RecordingsPage() {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchRecordings = async () => {
            try {
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    setError("Please log in to view recordings");
                    setLoading(false);
                    return;
                }

                const response = await fetch(`${API_BASE_URL}/api/recordings?token=${session.access_token}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch recordings");
                }

                const data = await response.json();
                setRecordings(data);
            } catch (err) {
                console.error("Error fetching recordings:", err);
                setError("Failed to load recordings");
            } finally {
                setLoading(false);
            }
        };

        fetchRecordings();
    }, []);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleDelete = async (id: string) => {
        const confirmed = window.confirm("Delete this recording? This will remove the audio, transcript, and any share links.");
        if (!confirmed) return;

        setDeletingId(id);
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

            setRecordings((prev) => prev.filter((rec) => rec.id !== id));
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Could not delete recording. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#A86CFF] border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] text-white">
                <p className="text-lg font-semibold text-[#FF6F61]">{error}</p>
                <Link href="/" className="mt-4 text-sm text-[#A86CFF] hover:underline">
                    Go back home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0E0E12] text-white">
            <main className="mx-auto w-full max-w-5xl px-4 py-8 pt-24 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#BFC2CF]">
                            My Recordings
                        </h1>
                        <p className="text-[#BFC2CF] text-sm mt-1">Manage your sessions and transcripts</p>
                    </div>

                    <Link
                        href="/recordings/new"
                        className="inline-flex items-center justify-center rounded-full bg-[#A86CFF] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#9755f5] hover:scale-105 shadow-lg shadow-[#A86CFF]/20 group"
                    >
                        <Mic className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                        New Recording
                    </Link>
                </div>

                {recordings.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-white/5 bg-[#181A20] p-12 text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#A86CFF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#A86CFF]/10 text-[#A86CFF] relative z-10">
                            <FileAudio className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white relative z-10">No recordings yet</h3>
                        <p className="mt-2 text-sm text-[#BFC2CF] max-w-sm mx-auto relative z-10">
                            Start recording to create transcripts and shareable audio links.
                        </p>
                        <Link
                            href="/recordings/new"
                            className="mt-6 inline-flex items-center justify-center rounded-full bg-white/10 border border-white/10 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 relative z-10"
                        >
                            Start Recording
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {recordings.map((recording) => (
                            <div
                                key={recording.id}
                                className="group relative flex flex-col gap-4 rounded-xl border border-white/5 bg-[#181A20] p-5 transition-all hover:border-[#A86CFF]/30 hover:bg-[#1C1E26] hover:shadow-lg hover:shadow-[#A86CFF]/5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#A86CFF]/10 text-[#A86CFF] group-hover:bg-[#A86CFF] group-hover:text-white transition-all duration-300">
                                            <Play className="h-5 w-5 ml-0.5" />
                                        </div>
                                        <div className="flex flex-col pt-0.5">
                                            <Link href={`/recordings/${recording.id}`} className="text-lg font-semibold text-white hover:text-[#A86CFF] transition-colors line-clamp-1">
                                                {recording.title || "Untitled Recording"}
                                            </Link>
                                            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs font-medium text-[#666]">
                                                <span className="inline-flex items-center text-[#BFC2CF]">
                                                    <Calendar className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                                                    {formatDate(recording.created_at)}
                                                </span>
                                                <span className="inline-flex items-center text-[#BFC2CF]">
                                                    <Clock className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                                                    {formatDuration(recording.duration_seconds)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/recordings/${recording.id}`}
                                            className="hidden sm:inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#BFC2CF] hover:bg-white/10 hover:text-white transition-colors"
                                        >
                                            View
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(recording.id)}
                                            disabled={deletingId === recording.id}
                                            className="inline-flex items-center justify-center rounded-lg p-2 text-[#666] transition-colors hover:bg-[#FF6F61]/10 hover:text-[#FF6F61] disabled:opacity-50"
                                            title="Delete Recording"
                                        >
                                            {deletingId === recording.id ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF6F61] border-t-transparent" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <Link href={`/recordings/${recording.id}`} className="absolute inset-0 sm:hidden" aria-label="View Recording" />
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
