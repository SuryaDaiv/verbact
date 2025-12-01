"use client";

import AudioRecorder from '@/components/AudioRecorder';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewRecordingPage() {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">New Recording</h1>
                </div>

                <AudioRecorder />
            </div>
        </div>
    );
}
