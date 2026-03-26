import React from 'react';
import Icon from './Icon';
import { getStreakColor, getStreakBg } from '@/utils/streak';

interface StreakBadgeProps {
    count: number;
    showText?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const StreakBadge: React.FC<StreakBadgeProps> = ({ 
    count, 
    showText = false, 
    size = 'md',
    className = ''
}) => {
    const colorClass = getStreakColor(count);
    const bgClass = getStreakBg(count);
    
    // Animation classes for high streaks
    const animationClass = count >= 30 ? 'animate-streak-glow' : count >= 15 ? 'animate-streak-pulse' : '';

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-[10px] gap-1',
        md: 'px-3 py-1.5 text-xs gap-2',
        lg: 'px-4 py-2 text-sm gap-2',
    };

    const iconSizes = {
        sm: '14px',
        md: '18px',
        lg: '22px',
    };

    return (
        <div className={`inline-flex items-center rounded-full border shadow-sm transition-all hover:scale-105 ${bgClass} ${sizeClasses[size]} ${className}`}>
            <Icon 
                name="local_fire_department" 
                className={`${colorClass} ${animationClass}`} 
                style={{ fontSize: iconSizes[size] }} 
            />
            <span className="font-black tracking-tight text-text-base">
                {showText ? `Day ${count} Streak` : count}
            </span>
        </div>
    );
};

export default StreakBadge;
