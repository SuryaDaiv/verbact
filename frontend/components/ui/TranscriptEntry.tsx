interface TranscriptEntryProps {
  id?: string | number;
  timecode: string;
  text: string;
  active?: boolean;
  onSelect?: () => void;
}

export function TranscriptEntry({ timecode, text, active, onSelect }: TranscriptEntryProps) {
  return (
    <div
      className={`flex w-full items-start gap-3 px-3 py-2 ${onSelect ? "cursor-pointer" : ""} ${
        active ? "bg-[#F5F8FF]" : ""
      }`}
      onClick={onSelect}
    >
      <div className="flex w-14 shrink-0 justify-end pt-[2px] text-[12px] font-medium text-[#777777]">
        {timecode}
      </div>
      <div className="relative flex-1 text-[15px] leading-6 text-[#111111]">
        {active && <span className="absolute left-[-12px] top-0 h-full w-[3px] rounded-full bg-[#3454F5]" aria-hidden />}
        <span className="block">{text}</span>
      </div>
    </div>
  );
}

export default TranscriptEntry;
