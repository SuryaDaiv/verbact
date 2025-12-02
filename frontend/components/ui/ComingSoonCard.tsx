interface ComingSoonCardProps {
  title: string;
  description: string;
}

export function ComingSoonCard({ title, description }: ComingSoonCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-5">
      <div className="flex items-center gap-2 text-[#3454F5]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#3454F5] text-xs font-semibold">
          AI
        </div>
        <span className="text-sm font-semibold text-[#111111]">{title}</span>
      </div>
      <p className="text-sm leading-6 text-[#666666]">{description}</p>
    </div>
  );
}

export default ComingSoonCard;
