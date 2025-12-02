"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Calendar, Clock, FileAudio, Trash2 } from "lucide-react";
import AppHeader from "@/components/ui/AppHeader";
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
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3454F5] border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-white text-[#B91C1C]">
                <p className="text-lg font-semibold">{error}</p>
                <Link href="/" className="mt-4 text-sm text-[#3454F5]">
                    Go back home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-[#111111]">
            <AppHeader />
            <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-2xl font-semibold leading-tight">My Recordings</h1>
                    <Link
                        href="/recordings/new"
                        className="inline-flex items-center justify-center rounded-lg bg-[#3454F5] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        New Recording
                    </Link>
                </div>

                {recordings.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#3454F5] text-[#3454F5]">
                            <FileAudio className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-semibold">No recordings yet</h3>
                        <p className="mt-2 text-sm text-[#666666]">Start recording to see your sessions here.</p>
                        <Link
                            href="/recordings/new"
                            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#3454F5] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        >
                            Start Recording
                        </Link>
                    </div>
                ) : (
                    <div className="mt-6 grid gap-3">
                        {recordings.map((recording) => (
                            <div
                                key={recording.id}
                                className="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#3454F5]">
                                            <Play className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="text-sm font-semibold">{recording.title || "Untitled Recording"}</div>
                                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#666666]">
                                                <span className="inline-flex items-center">
                                                    <Calendar className="mr-1.5 h-4 w-4" />
                                                    {formatDate(recording.created_at)}
                                                </span>
                                                <span className="inline-flex items-center">
                                                    <Clock className="mr-1.5 h-4 w-4" />
                                                    {formatDuration(recording.duration_seconds)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/recordings/${recording.id}`}
                                            className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-semibold text-[#111111]"
                                        >
                                            View
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(recording.id)}
                                            disabled={deletingId === recording.id}
                                            className="inline-flex items-center rounded-lg border border-[#FCA5A5] px-3 py-1.5 text-sm font-semibold text-[#B91C1C] disabled:opacity-50"
                                        >
                                            {deletingId === recording.id ? "Deleting…" : (
                                                <span className="flex items-center space-x-1">
                                                    <Trash2 className="h-4 w-4" />
                                                    <span>Delete</span>
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
