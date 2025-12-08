import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="glass-card flex flex-col gap-3 rounded-2xl p-6 transition-all duration-300 hover:bg-white/5 border border-white/5">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand text-white shadow-lg">
        {icon}
      </div>
      <div className="text-lg font-bold text-white mt-2">{title}</div>
      <p className="text-sm leading-relaxed text-[#BFC2CF]">{description}</p>
    </div>
  );
}

export default FeatureCard;
