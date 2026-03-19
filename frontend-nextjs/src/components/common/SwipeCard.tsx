'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SwipeCardProps {
    children: React.ReactNode;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    threshold?: number;
    disabled?: boolean;
    onClick?: () => void;
}

export default function SwipeCard({ 
    children, 
    onSwipeLeft, 
    onSwipeRight, 
    threshold = 100,
    disabled = false,
    onClick
}: SwipeCardProps) {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const cardRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        startX.current = e.clientX;
        if (!disabled && cardRef.current) {
            cardRef.current.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const currentX = e.clientX;
        const diff = currentX - startX.current;
        setOffsetX(diff);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        if (cardRef.current) {
            cardRef.current.releasePointerCapture(e.pointerId);
        }

        if (offsetX > threshold) {
            onSwipeRight();
        } else if (offsetX < -threshold) {
            onSwipeLeft();
        } else if (Math.abs(offsetX) < 10) {
            // Small movement is considered a click
            onClick?.();
        }
        
        setOffsetX(0);
    };

    // Calculate rotation and opacity based on offset
    const rotation = offsetX * 0.1;
    const opacityLeft = Math.min(Math.abs(Math.min(offsetX, 0)) / threshold, 1);
    const opacityRight = Math.min(Math.max(offsetX, 0) / threshold, 1);

    return (
        <div 
            ref={cardRef}
            className="relative w-full cursor-grab active:cursor-grabbing select-none touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
                transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
        >
            {/* Color Overlay Feedback (No Text) */}
            <div 
                className="absolute inset-0 rounded-3xl bg-emerald-500/20 border-4 border-emerald-500 z-10 pointer-events-none transition-opacity duration-100"
                style={{ opacity: opacityRight }}
            />
            <div 
                className="absolute inset-0 rounded-3xl bg-rose-500/20 border-4 border-rose-500 z-10 pointer-events-none transition-opacity duration-100"
                style={{ opacity: opacityLeft }}
            />
            {children}
        </div>
    );
}
