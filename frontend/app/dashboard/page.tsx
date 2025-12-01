import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AudioRecorder from '@/components/AudioRecorder'
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
                        <h2 className="text-xl font-semibold mb-4">New Recording</h2>
                        <AudioRecorder />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Recent Recordings</h2>
                            <a href="/recordings" className="text-sm text-blue-600 hover:underline">View all</a>
                        </div>
                        <DashboardRecordingsList token={user.id} />
                    </div>
                </div>
            </main>
        </div>
    )
}


