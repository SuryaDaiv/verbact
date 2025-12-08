import AuthForm from '@/components/AuthForm'
import Image from 'next/image'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 bg-[#0E0E12] relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#A86CFF]/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#FF6F61]/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md px-4">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="inline-block relative w-16 h-16 mb-4">
                        <Image src="/logo.png" alt="Verbact" fill className="object-contain" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Welcome Back
                    </h2>
                    <p className="text-[#BFC2CF]">
                        Sign in to continue to your dashboard
                    </p>
                </div>

                {/* Glass Card */}
                <div className="glass-card rounded-[24px] p-8 shadow-2xl backdrop-blur-xl">
                    <AuthForm />
                </div>
            </div>
        </div>
    )
}
