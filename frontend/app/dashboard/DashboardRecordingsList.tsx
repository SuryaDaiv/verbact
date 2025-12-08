"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Calendar, Clock, ChevronRight } from "lucide-react";
import { API_BASE_URL } from "@/utils/config";

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

                const response = await fetch(`${API_BASE_URL}/api/recordings?token=${session.access_token}`);
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
                <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#A86CFF]"></div>
                    <p className="text-sm text-[#BFC2CF]">Loading recordings...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return <p className="text-[#FF6F61] text-sm">{error}</p>;
    }

    if (recordings.length === 0) {
        return (
            <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-[#BFC2CF]">No recordings yet. Start your first one above!</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {recordings.map((recording) => (
                <Link
                    key={recording.id}
                    href={`/recordings/${recording.id}`}
                    className="group glass-card rounded-xl p-5 hover:bg-white/5 transition-all duration-300 flex justify-between items-center border border-white/5 hover:border-[#A86CFF]/30"
                >
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-gradient-to-br from-[#181A20] to-[#252830] border border-white/10 rounded-full text-[#A86CFF] group-hover:text-white group-hover:bg-[#A86CFF] transition-all">
                            <Play className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white group-hover:text-[#A86CFF] transition-colors">
                                {recording.title || "Untitled Recording"}
                            </h3>
                            <div className="flex items-center space-x-4 text-xs text-[#666] mt-1 group-hover:text-[#BFC2CF] transition-colors">
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

                    <div className="p-2 transition-transform duration-300 group-hover:translate-x-1">
                        <ChevronRight className="w-5 h-5 text-[#666] group-hover:text-[#A86CFF]" />
                    </div>
                </Link>
            ))}
        </div>
    );
}
