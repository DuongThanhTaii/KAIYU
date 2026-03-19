'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/common/Icon';
import { type FlashcardReview as FlashcardType } from '@/services/flashcardApi';
import { renderFormattedMeaning } from '@/utils/chinese';

interface MatchingGameProps {
    wrongWords: FlashcardType[];
    correctWords: FlashcardType[];
    onComplete: () => void;
    onStatUpdate?: (type: 'correct' | 'wrong') => void;
}

interface MatchingItem {
    id: string;
    text: string;
    type: 'hanzi' | 'meaning';
    flashcardId: string;
}

export default function MatchingGame({ wrongWords, correctWords, onComplete, onStatUpdate }: MatchingGameProps) {
    const [items, setItems] = useState<MatchingItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
    const [errorId, setErrorId] = useState<string | null>(null);

    // Prepare the game pool using 70/30 weight
    useEffect(() => {
        const poolSize = 6;
        const selected: FlashcardType[] = [];
        
        // 1. Prioritize wrong words (up to 4)
        const shuffledWrong = [...wrongWords].sort(() => Math.random() - 0.5);
        selected.push(...shuffledWrong.slice(0, 4));
        
        // 2. Fill the rest with correct words or other available words
        const remainingNeeded = poolSize - selected.length;
        const shuffledCorrect = [...correctWords].filter(w => !selected.find(s => s.id === w.id)).sort(() => Math.random() - 0.5);
        selected.push(...shuffledCorrect.slice(0, remainingNeeded));

        // 3. Create items (Hanzi and Meaning)
        const gameItems: MatchingItem[] = [];
        selected.forEach(card => {
            const vocab = card.vocabulary || card.word;
            if (!vocab) return;
            
            gameItems.push({
                id: `${card.id}-hanzi`,
                text: vocab.hanzi,
                type: 'hanzi',
                flashcardId: card.id
            });
            gameItems.push({
                id: `${card.id}-meaning`,
                text: vocab.meaningVi || vocab.meaningEn || 'Nghĩa',
                type: 'meaning',
                flashcardId: card.id
            });
        });

        setItems(gameItems.sort(() => Math.random() - 0.5));
    }, [wrongWords, correctWords]);

    const handleSelect = (item: MatchingItem) => {
        if (matchedIds.has(item.id) || errorId) return;

        if (!selectedId) {
            setSelectedId(item.id);
            return;
        }

        const firstItem = items.find(i => i.id === selectedId);
        if (!firstItem) return;

        // Check if it's a match
        if (firstItem.flashcardId === item.flashcardId && firstItem.type !== item.type) {
            // Match success
            setMatchedIds(prev => {
                const next = new Set(prev);
                next.add(firstItem.id);
                next.add(item.id);
                return next;
            });
            if (onStatUpdate) onStatUpdate('correct');
            setSelectedId(null);
        } else {
            // Fail
            setErrorId(item.id);
            if (onStatUpdate) onStatUpdate('wrong');
            setTimeout(() => {
                setErrorId(null);
                setSelectedId(null);
            }, 800);
        }
    };

    // Check completion
    useEffect(() => {
        if (items.length > 0 && matchedIds.size === items.length) {
            setTimeout(onComplete, 1000);
        }
    }, [matchedIds, items, onComplete]);

    return (
        <div className="w-full max-w-2xl mx-auto p-6 animate-in fade-in zoom-in duration-500">
            <div className="text-center mb-8 flex flex-col items-center">
                <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 mb-4 shadow-lg shadow-primary/10">
                    <Icon name="extension" size="lg" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                    Giai đoạn Củng cố
                </h2>
                <p className="text-text-secondary text-sm italic">
                    Ghép đôi từ vựng với nghĩa đúng để tiếp tục...
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {items.map((item) => {
                    const isMatched = matchedIds.has(item.id);
                    const isSelected = selectedId === item.id;
                    const isError = errorId === item.id || (errorId && isSelected);

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            disabled={isMatched}
                            className={`
                                relative p-4 rounded-2xl border-2 transition-all duration-300 min-h-[100px] flex items-center justify-center text-center
                                ${isMatched ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100'}
                                ${isSelected ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-105 z-10' : 'border-border-color/30 bg-surface-highlight/20 hover:border-primary/50'}
                                ${isError ? 'border-rose-500 bg-rose-500/10 animate-shake shadow-lg shadow-rose-500/20 z-20' : ''}
                            `}
                        >
                             <div className={`
                                ${item.type === 'hanzi' ? 'text-3xl font-chinese text-white' : 'text-sm font-medium text-text-secondary w-full'}
                                ${isSelected ? 'text-primary' : ''}
                                ${isError ? 'text-rose-400' : ''}
                            `}>
                                {item.type === 'meaning' && typeof item.text === 'string' && item.text.includes('1.') ? (
                                    <div className="flex flex-col gap-1 items-center justify-center">
                                        {item.text.split(/(?=\d+\.)/).map((part, i) => (
                                            <div key={i} className="leading-tight">
                                                {renderFormattedMeaning(part)}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    item.type === 'meaning' ? renderFormattedMeaning(item.text) : item.text
                                )}
                            </div>
                            
                            {isMatched && (
                                <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 rounded-2xl">
                                    <Icon name="check" className="text-emerald-400 text-3xl" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Progress indicator */}
            <div className="mt-10 flex flex-col items-center gap-4">
                <div className="w-full h-1.5 bg-surface-highlight rounded-full overflow-hidden max-w-md">
                    <div 
                        className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                        style={{ width: `${(matchedIds.size / items.length) * 100}%` }}
                    />
                </div>
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-60">
                    Đã ghép {matchedIds.size / 2} / {items.length / 2} cặp
                </span>
            </div>
        </div>
    );
}
