import Link from "next/link";
import { Bot, ArrowLeft } from "lucide-react";
import AppHeader from "@/components/ui/AppHeader";
import FooterLinks from "@/components/ui/FooterLinks";

export default function ComingSoonPage() {
    return (
        <div className="min-h-screen bg-white text-[#111111]">
            <AppHeader
                rightSlot={
                    <Link href="/" className="text-sm font-medium text-[#666666] hover:text-[#111111]">
                        Back to Home
                    </Link>
                }
            />

            <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#3454F5]">
                    <Bot className="h-8 w-8" />
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-[#111111]">
                    AI Meeting Assistant <br /> Coming Soon
                </h1>

                <p className="mt-4 text-lg text-[#666666]">
                    Verbact will soon join your meetings automatically and generate smart notes, action items, and summaries.
                </p>

                <form className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
                    <input
                        type="email"
                        placeholder="Enter your email"
                        className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#9CA3AF] focus:border-[#3454F5] focus:outline-none focus:ring-1 focus:ring-[#3454F5]"
                        required
                    />
                    <button
                        type="submit"
                        className="shrink-0 rounded-lg bg-[#111111] px-6 py-2.5 text-sm font-semibold text-white hover:bg-black"
                    >
                        Notify Me
                    </button>
                </form>

                <div className="mt-12">
                    <Link href="/" className="flex items-center text-sm text-[#666666] hover:text-[#111111]">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Return to Home
                    </Link>
                </div>
            </main>

            <div className="fixed bottom-0 w-full">
                <FooterLinks
                    links={[
                        { label: "Privacy", href: "/privacy" },
                        { label: "Terms", href: "/terms" },
                        { label: "Contact", href: "/contact" },
                    ]}
                />
            </div>
        </div>
    );
}
