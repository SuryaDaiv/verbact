"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Calendar, Clock, FileAudio, Share2 } from "lucide-react";

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

                const response = await fetch(`http://localhost:8000/api/recordings?token=${session.access_token}`);
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-red-500">
                <p className="text-xl font-semibold">{error}</p>
                <Link href="/" className="mt-4 text-blue-600 hover:underline">
                    Go back home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">My Recordings</h1>
                    <Link
                        href="/dashboard"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        New Recording
                    </Link>
                </div>

                {recordings.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileAudio className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No recordings yet</h3>
                        <p className="text-gray-500 mb-6">Start recording your voice to see them here.</p>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                        >
                            Start Recording
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {recordings.map((recording) => (
                            <div
                                key={recording.id}
                                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-100"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                <Play className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {recording.title || "Untitled Recording"}
                                            </h3>
                                        </div>

                                        <div className="flex items-center space-x-6 text-sm text-gray-500 ml-12">
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-1.5" />
                                                {formatDate(recording.created_at)}
                                            </div>
                                            <div className="flex items-center">
                                                <Clock className="w-4 h-4 mr-1.5" />
                                                {formatDuration(recording.duration_seconds)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex space-x-2">
                                        <Link
                                            href={`/recordings/${recording.id}`}
                                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                        >
                                            View Transcript
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
