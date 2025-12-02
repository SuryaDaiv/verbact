import TranscriptEntry from "./TranscriptEntry";

export interface TranscriptItem {
  id?: string | number;
  timecode: string;
  text: string;
  active?: boolean;
}

interface TranscriptListProps {
  items: TranscriptItem[];
  title?: string;
  onSelect?: (id?: string | number) => void;
}

export function TranscriptList({ items, title, onSelect }: TranscriptListProps) {
  return (
    <div className="w-full">
      {title && <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-[#666666]">{title}</div>}
      <div className="divide-y divide-[#E5E7EB]">
        {items.map((item) => (
          <TranscriptEntry
            key={item.id || item.timecode}
            timecode={item.timecode}
            text={item.text}
            active={item.active}
            onSelect={onSelect ? () => onSelect(item.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default TranscriptList;
