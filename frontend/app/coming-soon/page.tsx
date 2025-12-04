import ComingSoonCard from "@/components/ui/ComingSoonCard";
import FooterLinks from "@/components/ui/FooterLinks";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            AI Meeting Assistant Coming Soon
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#666666]">
            Verbact will soon join meetings automatically and generate smart notes. Get notified when we ship.
          </p>
        </div>

        <ComingSoonCard
          title="AI Meeting Assistant"
          description="Join calls automatically, capture every word, and deliver concise notes without lifting a finger."
        />

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#3454F5]"
            />
            <button className="w-full rounded-lg bg-[#3454F5] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto">
              Notify Me
            </button>
          </div>
        </div>
      </main>
      <FooterLinks
        links={[
          { label: "Home", href: "/" },
          { label: "Recordings", href: "/recordings" },
          { label: "Privacy", href: "#" },
        ]}
      />
    </div>
  );
}
