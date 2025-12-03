import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

import DashboardRecordingsList from './DashboardRecordingsList';

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Dashboard
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">{user.email}</span>
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
            <main>
                <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                    <div className="mb-12">
                        <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-100 flex flex-col items-center justify-center text-center">
                            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Ready to record?</h2>
                            <p className="text-gray-500 mb-6 max-w-md">Start a new recording to transcribe your voice in real-time and share it with others.</p>
                            <Link
                                href="/recordings/new"
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:text-lg transition-colors"
                            >
                                Start New Recording
                            </Link>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Recent Recordings</h2>
                            <Link href="/recordings" className="text-sm text-blue-600 hover:underline">View all</Link>
                        </div>
                        <DashboardRecordingsList token={user.id} />
                    </div>
                </div>
            </main>
        </div>
    )
}


