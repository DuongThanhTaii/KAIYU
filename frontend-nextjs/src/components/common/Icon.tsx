import React from 'react';

interface IconProps {
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    filled?: boolean;
    className?: string;
}

const Icon: React.FC<IconProps> = ({
    name,
    size = 'md',
    filled = false,
    className = '',
}) => {
    const sizes = {
        sm: 'text-[16px]',
        md: 'text-[20px]',
        lg: 'text-[24px]',
        xl: 'text-[32px]',
    };

    const fillClass = filled ? 'fill' : '';

    return (
        <span
            className={`material-symbols-outlined ${sizes[size]} ${fillClass} ${className}`}
        >
            {name}
        </span>
    );
};

export default Icon;
