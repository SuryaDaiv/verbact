import Link from 'next/link'
import { Disc } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] text-white p-4 relative overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-brand opacity-10 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">

                <div className="relative inline-block group">
                    <Disc className="w-32 h-32 text-white/5 mx-auto animate-[spin_10s_linear_infinite]" />
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-bold bg-clip-text text-transparent bg-gradient-brand">404</span>
                </div>

                <div className="space-y-4 max-w-md mx-auto">
                    <h2 className="text-3xl font-bold tracking-tight">Lost in transcription.</h2>
                    <p className="text-[#BFC2CF]">
                        The page you are looking for seems to have drifted off into silence.
                    </p>
                </div>

                <div>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-white transition-all bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-[#A86CFF]/50 hover:shadow-[0_0_20px_rgba(168,108,255,0.2)]"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    )
}
