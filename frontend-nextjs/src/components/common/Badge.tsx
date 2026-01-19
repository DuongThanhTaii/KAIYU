import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'hsk' | 'status';
    hskLevel?: number;
    status?: 'new' | 'learning' | 'review' | 'mastered';
    size?: 'sm' | 'md';
    className?: string;
}

const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'primary',
    hskLevel,
    status,
    size = 'sm',
    className = '',
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-bold rounded-full';

    const hskColors: Record<number, string> = {
        1: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        2: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        3: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        4: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        5: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        6: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    const statusColors: Record<string, string> = {
        new: 'bg-blue-500/10 text-blue-400',
        learning: 'bg-yellow-500/10 text-yellow-400',
        review: 'bg-orange-500/10 text-orange-400',
        mastered: 'bg-primary/10 text-primary',
    };

    const variants: Record<string, string> = {
        primary: 'bg-primary/10 text-primary border border-primary/20',
        secondary: 'bg-surface-highlight text-text-secondary border border-white/5',
        hsk: hskLevel ? `${hskColors[hskLevel]} border` : '',
        status: status ? statusColors[status] : '',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-3 py-1 text-xs',
    };

    return (
        <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
            {children}
        </span>
    );
};

export default Badge;
