import React from 'react';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'glass';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    className?: string;
    onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    padding = 'md',
    hover = false,
    className = '',
    onClick,
}) => {
    const baseStyles = 'rounded-xl transition-all';

    const variants = {
        default: 'bg-surface-dark border border-border-color',
        elevated: 'bg-surface-dark border border-border-color shadow-lg shadow-black/20',
        glass: 'bg-surface-dark/70 backdrop-blur-md border border-white/5',
    };

    const paddings = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    const hoverClass = hover
        ? 'hover:border-primary/30 hover:shadow-lg cursor-pointer'
        : '';

    return (
        <div
            className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${hoverClass} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export default Card;
