"use client";

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const AudioRecorder = dynamic(() => import('@/components/AudioRecorder'), {
    ssr: false,
    loading: () => <p className="text-center p-8">Loading Recorder...</p>
});

export default function NewRecordingPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        New Recording
                    </h1>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            Back to Dashboard
                        </Link>
                        <form action="/auth/signout" method="post">
                            <button
                                type="submit"
                                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                                Sign out
                            </button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="p-8">
                <div className="max-w-4xl mx-auto">
                    <AudioRecorder />
                </div>
            </main>
        </div>
    );
}
