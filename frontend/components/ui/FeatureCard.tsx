import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-[#3454F5]">{icon}</div>
      <div className="text-sm font-semibold text-[#111111]">{title}</div>
      <p className="text-sm leading-6 text-[#666666]">{description}</p>
    </div>
  );
}

export default FeatureCard;
