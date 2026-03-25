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
    const baseStyles = 'inline-flex items-center justify-center font-bold rounded-full whitespace-nowrap';

    const hskColors: Record<number, string> = {
        0: 'bg-surface-secondary text-text-secondary border-white/5',
        1: 'bg-[var(--color-hsk1)]/10 text-[var(--color-hsk1)] border-[var(--color-hsk1)]/20',
        2: 'bg-[var(--color-hsk2)]/10 text-[var(--color-hsk2)] border-[var(--color-hsk2)]/20',
        3: 'bg-[var(--color-hsk3)]/10 text-[var(--color-hsk3)] border-[var(--color-hsk3)]/20',
        4: 'bg-[var(--color-hsk4)]/10 text-[var(--color-hsk4)] border-[var(--color-hsk4)]/20',
        5: 'bg-[var(--color-hsk5)]/10 text-[var(--color-hsk5)] border-[var(--color-hsk5)]/20',
        6: 'bg-[var(--color-hsk6)]/10 text-[var(--color-hsk6)] border-[var(--color-hsk6)]/20',
        7: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };

    const statusColors: Record<string, string> = {
        new: 'bg-[var(--color-status-new)]/10 text-[var(--color-status-new)]',
        learning: 'bg-[var(--color-status-learning)]/10 text-[var(--color-status-learning)]',
        review: 'bg-[var(--color-status-review)]/10 text-[var(--color-status-review)]',
        mastered: 'bg-[var(--color-status-mastered)]/10 text-[var(--color-status-mastered)]',
    };

    const variants: Record<string, string> = {
        primary: 'bg-primary/10 text-primary border border-primary/20',
        secondary: 'bg-surface-highlight text-text-secondary border border-white/5',
        hsk: hskLevel !== undefined ? `${hskColors[hskLevel] || hskColors[7]} border` : '',
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
