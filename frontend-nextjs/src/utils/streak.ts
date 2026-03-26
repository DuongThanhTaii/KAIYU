
export const getStreakColor = (count: number) => {
    if (count <= 0) return 'text-text-secondary opacity-40';
    if (count < 4) return 'text-orange-400';
    if (count < 8) return 'text-red-500';
    if (count < 15) return 'text-rose-500';
    if (count < 30) return 'text-purple-500';
    if (count < 60) return 'text-blue-500'; // Blue hot flame
    return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]'; // Mythic Gold
};

export const getStreakBg = (count: number) => {
    if (count <= 0) return 'bg-surface-dark border-border-color/30';
    if (count < 4) return 'bg-orange-500/10 border-orange-500/20';
    if (count < 8) return 'bg-red-500/10 border-red-500/20';
    if (count < 15) return 'bg-rose-500/10 border-rose-500/20';
    if (count < 30) return 'bg-purple-500/10 border-purple-500/20';
    if (count < 60) return 'bg-blue-500/10 border-blue-500/20';
    return 'bg-amber-500/10 border-amber-500/20';
};
