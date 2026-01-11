'use client'

import { useEffect } from 'react'
import { RefreshCw } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error
        console.error(error)

        // Check for the specific server action error
        if (
            error.message.includes('Failed to find Server Action') ||
            (error.digest && error.digest.includes('Failed to find Server Action'))
        ) {
            // Force a reload to get new chunks
            window.location.reload()
        }
    }, [error])

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-[#0E0E12] text-white p-4">
            <div className="rounded-full bg-white/5 p-4 backdrop-blur-md border border-white/10">
                <RefreshCw className="h-8 w-8 text-[#A86CFF]" />
            </div>

            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#BFC2CF]">
                    Something went wrong!
                </h2>
                <p className="text-[#BFC2CF] max-w-sm">
                    {error.message || "An unexpected error occurred."}
                </p>
            </div>

            <button
                className="group relative inline-flex items-center justify-center px-8 py-3 text-sm font-bold text-white transition-all duration-300 bg-gradient-brand rounded-full hover:scale-105 shadow-[0_0_20px_rgba(168,108,255,0.4)]"
                onClick={() => reset()}
            >
                Try again
            </button>
        </div>
    )
}
