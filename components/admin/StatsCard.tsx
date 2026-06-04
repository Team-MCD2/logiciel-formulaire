import React from "react";
import { type LucideIcon } from "lucide-react";
import NumberTicker from "@/components/magicui/number-ticker";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
}

export function StatsCard({ title, value, description, icon: Icon }: StatsCardProps) {
  const isNumber = typeof value === 'number';

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs flex items-center justify-between">
      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
          {isNumber ? <NumberTicker value={value as number} /> : value}
        </h3>
        {description && <p className="text-xs text-slate-400 font-medium">{description}</p>}
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}
