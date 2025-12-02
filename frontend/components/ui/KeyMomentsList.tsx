interface KeyMoment {
  label: string;
  time: string;
}

interface KeyMomentsListProps {
  moments: KeyMoment[];
}

export function KeyMomentsList({ moments }: KeyMomentsListProps) {
  if (!moments.length) {
    return <div className="text-sm text-[#666666]">No key moments yet.</div>;
  }
  return (
    <div className="space-y-3">
      {moments.map((moment, idx) => (
        <div key={`${moment.time}-${idx}`} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111111]">
          <span>{moment.label}</span>
          <span className="text-[12px] font-medium text-[#666666]">{moment.time}</span>
        </div>
      ))}
    </div>
  );
}

export default KeyMomentsList;
