"use client";

import React, { useState, useRef } from "react";

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
  onClick,
}: SwipeCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const activePointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const currentOffsetX = useRef(0);
  const hasMoved = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const resetInteraction = () => {
    activePointerId.current = null;
    startX.current = 0;
    currentOffsetX.current = 0;
    hasMoved.current = false;
    setIsDragging(false);
    setOffsetX(0);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    activePointerId.current = e.pointerId;
    startX.current = e.clientX;
    currentOffsetX.current = 0;
    hasMoved.current = false;

    if (!disabled && cardRef.current) {
      cardRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    if (disabled) return;

    const currentX = e.clientX;
    const diff = currentX - startX.current;
    currentOffsetX.current = diff;

    if (Math.abs(diff) > 4) {
      hasMoved.current = true;
      if (!isDragging) {
        setIsDragging(true);
      }
    }

    if (!hasMoved.current) return;
    setOffsetX(diff);
  };

  const handlePointerUp = (e: React.PointerEvent, isCancelled = false) => {
    if (activePointerId.current !== e.pointerId) return;

    const finalOffset = currentOffsetX.current;

    if (disabled) {
      // Keep tap-to-flip behavior even when swipe is disabled.
      if (!hasMoved.current) {
        onClick?.();
      }
      resetInteraction();
      return;
    }

    if (cardRef.current?.hasPointerCapture(e.pointerId)) {
      cardRef.current.releasePointerCapture(e.pointerId);
    }

    if (!isCancelled) {
      if (finalOffset > threshold) {
        onSwipeRight();
      } else if (finalOffset < -threshold) {
        onSwipeLeft();
      } else if (!hasMoved.current || Math.abs(finalOffset) < 10) {
        // Small movement is considered a click
        onClick?.();
      }
    }

    resetInteraction();
  };

  const handleLostPointerCapture = () => {
    // Browser can revoke capture (alt-tab, native drag, interrupt); always reset.
    resetInteraction();
  };

  // Calculate rotation and opacity based on offset
  const rotation = offsetX * 0.1;
  const opacityLeft = Math.min(Math.abs(Math.min(offsetX, 0)) / threshold, 1);
  const opacityRight = Math.min(Math.max(offsetX, 0) / threshold, 1);

  return (
    <div
      ref={cardRef}
      className="relative w-full cursor-grab active:cursor-grabbing select-none touch-none"
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => handlePointerUp(e, false)}
      onPointerCancel={(e) => handlePointerUp(e, true)}
      onLostPointerCapture={handleLostPointerCapture}
      style={{
        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
        transition: isDragging
          ? "none"
          : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
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
