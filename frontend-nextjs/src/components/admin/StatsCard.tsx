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
    iconColor = 'text-primary',
    trend,
    subtitle,
}) => {
    return (
        <div className="bg-surface-dark rounded-xl border border-border-color p-4 sm:p-6 hover:border-primary/50 transition-colors shadow-sm">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-text-secondary mb-1">{title}</p>
                    <p className="text-3xl font-bold text-text-base mb-1">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {trend && (
                        <div className="flex items-center gap-1">
                            <Icon
                                name={trend.isPositive ? 'trending_up' : 'trending_down'}
                                className={`text-sm ${trend.isPositive ? 'text-green-400' : 'text-red-400'
                                    }`}
                            />
                            <span
                                className={`text-xs font-medium ${trend.isPositive ? 'text-green-400' : 'text-red-400'
                                    }`}
                            >
                                {trend.isPositive ? '+' : ''}
                                {trend.value}%
                            </span>
                            <span className="text-xs text-text-secondary">so với tháng trước</span>
                        </div>
                    )}
                    {subtitle && (
                        <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
                    )}
                </div>
                <div
                    className={`p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ${iconColor}`}
                >
                    <Icon name={icon} className="text-2xl" />
                </div>
            </div>
        </div>
    );
};

export default StatsCard;
