"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Calendar, Clock, FileAudio } from "lucide-react";

interface Recording {
    id: string;
    title: string;
    created_at: string;
    duration_seconds: number;
    audio_url: string;
}

export default function DashboardRecordingsList({ token }: { token?: string }) {
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
                    return;
                }

                // Fetch only recent 5 recordings
                const response = await fetch(`http://localhost:8000/api/recordings?token=${session.access_token}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch recordings");
                }

                const data = await response.json();
                setRecordings(data.slice(0, 5));
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
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return <p className="text-red-500 text-sm">{error}</p>;
    }

    if (recordings.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
                <p className="text-gray-500">No recordings yet. Start your first one above!</p>
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            {recordings.map((recording) => (
                <div
                    key={recording.id}
                    className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow border border-gray-100 flex justify-between items-center"
                >
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Play className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900">
                                {recording.title || "Untitled Recording"}
                            </h3>
                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                                <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {formatDate(recording.created_at)}
                                </div>
                                <div className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatDuration(recording.duration_seconds)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Link
                        href={`/recordings/${recording.id}`}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                    >
                        View
                    </Link>
                </div>
            ))}
        </div>
    );
}
