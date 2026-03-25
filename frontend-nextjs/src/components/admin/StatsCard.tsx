import React from 'react';
import { Icon } from '../common';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: string;
    iconColor?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    icon,
    trend,
    subtitle,
}) => {
    return (
        <div className="bg-surface-dark rounded-2xl border border-border-color p-5 hover:border-primary/30 transition-all duration-300 shadow-sm relative overflow-hidden group">
            {/* Subtle Background Icon Decoration */}
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 pointer-events-none rotate-12">
                <Icon name={icon} className="text-[100px]" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">{title}</p>
                    <div className="flex items-center gap-3">
                        <h3 className="text-3xl font-black text-text-base tracking-tight">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </h3>
                        {trend && (
                            <div className={`flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-md ${trend.isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                <span className="text-[8px]">{trend.isPositive ? '▲' : '▼'}</span>
                                <span>{trend.value}%</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-3">
                    {subtitle ? (
                        <p className="text-[10px] font-bold text-text-secondary opacity-60">
                            {subtitle}
                        </p>
                    ) : trend ? (
                        <p className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-tighter">
                            so với tháng trước
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default StatsCard;
