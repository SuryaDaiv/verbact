import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

interface AppHeaderProps {
  rightSlot?: React.ReactNode;
}

export function AppHeader({ rightSlot }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 w-full bg-white border-b border-[#E5E7EB]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3454F5] text-white text-sm font-semibold">
            V
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#111111]">
            Verbact
          </span>
        </Link>
        <div className="flex items-center space-x-3 text-[#666666]">
          <Link href="/pricing" className="text-sm font-medium hover:text-gray-900">Pricing</Link>
          {rightSlot}
          {!rightSlot && <MoreHorizontal className="h-5 w-5" aria-label="Menu" />}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
