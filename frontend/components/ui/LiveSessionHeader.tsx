interface LiveSessionHeaderProps {
  title: string;
  dateLabel: string;
  showLive?: boolean;
  meta?: React.ReactNode;
}

export function LiveSessionHeader({ title, dateLabel, showLive, meta }: LiveSessionHeaderProps) {
  return (
    <div className="w-full border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex flex-col">
            <div className="text-xs uppercase tracking-wide text-[#666666]">Live Recording</div>
            <div className="text-lg font-semibold text-[#111111]">{title}</div>
            <div className="text-xs text-[#666666]">{dateLabel}</div>
          </div>
          {showLive && (
            <span className="inline-flex items-center space-x-1 rounded-full bg-[#FEE2E2] px-2 py-1 text-[11px] font-semibold uppercase text-[#B91C1C]">
              <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
              <span>Live</span>
            </span>
          )}
        </div>
        {meta && <div className="flex items-center text-xs text-[#666666]">{meta}</div>}
      </div>
    </div>
  );
}

export default LiveSessionHeader;
