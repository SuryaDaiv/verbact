'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ErrorContent() {
    const searchParams = useSearchParams()
    const error = searchParams.get('error')

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-50">
            <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
                <p className="text-gray-600 mb-6">
                    {error || 'There was an error verifying your account.'}
                </p>
                <div className="space-y-4">
                    <Link
                        href="/login"
                        className="block w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                    >
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function AuthCodeError() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ErrorContent />
        </Suspense>
    )
}
