'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/common/Icon';
import Button from '@/components/common/Button';
import NotificationDropdown from '@/components/common/NotificationDropdown';
import SpeakerButton from '@/components/common/SpeakerButton';
import VideoClipPlayer from '@/components/common/VideoClipPlayer';
import SwipeCard from '@/components/common/SwipeCard';
import MatchingGame from './components/MatchingGame';
import { useAuth } from '@/contexts/AuthContext';
import { flashcardApi, type FlashcardReview as FlashcardType, type FlashcardStats, type SRSRating } from '@/services/flashcardApi';
import { renderGroupedPinyin, renderFormattedMeaning } from '@/utils/chinese';
import { videoApi, type Subtitle } from '@/services/videoApi';
import { dictionaryApi, type ExampleSentence as DictExample } from '@/services/dictionaryApi';

export default function FlashcardReviewPage() {
    const router = useRouter();
    const { user } = useAuth();

    // === SRS Queue State ===
    const [queue, setQueue] = useState<FlashcardType[]>([]);
    const [stats, setStats] = useState<FlashcardStats | null>(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reviewedCount, setReviewedCount] = useState(0);
    const [videoSubtitles, setVideoSubtitles] = useState<Record<string, Subtitle[]>>({});
    const [fallbackExamples, setFallbackExamples] = useState<Record<string, DictExample[]>>({});

    // === View Mode ===
    const [viewMode, setViewMode] = useState<'srs' | 'mastered' | 'review' | 'matching'>('srs');

    // === SRS Session ===
    const [isRevealed, setIsRevealed] = useState(false);
    const [sessionHistory, setSessionHistory] = useState<FlashcardType[]>([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [wrongWords, setWrongWords] = useState<FlashcardType[]>([]);
    const [correctWords, setCorrectWords] = useState<FlashcardType[]>([]);
    const [showMatchingGame, setShowMatchingGame] = useState(false);
    const [cardsSinceLastMatch, setCardsSinceLastMatch] = useState(0);

    // === Mastered Vocabulary ===
    const [masteredCards, setMasteredCards] = useState<FlashcardType[]>([]);
    const [isLoadingMastered, setIsLoadingMastered] = useState(false);
    const [masteredSlideshow, setMasteredSlideshow] = useState<FlashcardType[] | null>(null);
    const [masteredSlideshowIndex, setMasteredSlideshowIndex] = useState(0);
    const [masteredRevealed, setMasteredRevealed] = useState(false);

    // === Review Pool (Ôn Tập) ===
    const [reviewPool, setReviewPool] = useState<FlashcardType[]>([]);
    const [reviewPoolIndex, setReviewPoolIndex] = useState(0);
    const [reviewHistory, setReviewHistory] = useState<FlashcardType[]>([]);
    const [reviewHistoryIndex, setReviewHistoryIndex] = useState(0);
    const [reviewRevealed, setReviewRevealed] = useState(false);
    const [reviewCompleted, setReviewCompleted] = useState(false);

    // === Session-persistent Stats ===
    const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
    const [sessionWrongCount, setSessionWrongCount] = useState(0);

    // === Data Fetching ===
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [queueData, statsData] = await Promise.all([
                flashcardApi.getQueue(),
                flashcardApi.getStats(),
            ]);
            setQueue(queueData.cards);
            setStats(statsData);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Không thể tải dữ liệu';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchMastered = useCallback(async () => {
        setIsLoadingMastered(true);
        try {
            // Fetch ALL levels (not just 3-5)
            const allCards = await flashcardApi.getByLevel();
            setMasteredCards(allCards);
        } catch (err) {
            console.error('Failed to fetch vocabulary:', err);
        } finally {
            setIsLoadingMastered(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchMastered();
    }, [fetchData, fetchMastered]);

    const currentCard = queue[currentCardIndex];
    const totalCards = queue.length;
    const getVocab = (card: FlashcardType | undefined) => card?.vocabulary || card?.word;

    // === Build Review Pool ===
    const buildReviewPool = useCallback(() => {
        const pool: FlashcardType[] = [];
        const seen = new Set<string>();
        const addUnique = (cards: FlashcardType[]) => {
            for (const c of [...cards].sort(() => Math.random() - 0.5)) {
                if (!seen.has(c.id)) { seen.add(c.id); pool.push(c); }
            }
        };
        addUnique(correctWords);
        addUnique([...masteredCards].sort(() => Math.random() - 0.5).slice(0, 5));
        addUnique(wrongWords);
        return pool.sort(() => Math.random() - 0.5);
    }, [correctWords, wrongWords, masteredCards]);

    const enterReviewMode = useCallback(() => {
        const pool = buildReviewPool();
        setReviewPool(pool);
        setReviewPoolIndex(0);
        setReviewHistory([]);
        setReviewHistoryIndex(0);
        setReviewRevealed(false);
        setReviewCompleted(false);
        setShowMatchingGame(false);
        setViewMode('review');
    }, [buildReviewPool]);

    const enterMasteredSlideshow = (cards: FlashcardType[]) => {
        setMasteredSlideshow(cards);
        setMasteredSlideshowIndex(0);
        setMasteredRevealed(false);
    };

    // === Active card for subtitle/example fetching ===
    const getActiveCard = (): FlashcardType | undefined => {
        if (viewMode === 'srs') return historyIndex < sessionHistory.length ? sessionHistory[historyIndex] : currentCard;
        if (viewMode === 'mastered' && masteredSlideshow) return masteredSlideshow[masteredSlideshowIndex];
        if (viewMode === 'review') return reviewHistoryIndex < reviewHistory.length ? reviewHistory[reviewHistoryIndex] : reviewPool[reviewPoolIndex];
        return undefined;
    };
    const activeCard = getActiveCard();

    // === Displayed cards per mode ===
    const srsDisplayedCard = historyIndex < sessionHistory.length ? sessionHistory[historyIndex] : currentCard;
    const reviewDisplayedCard = reviewHistoryIndex < reviewHistory.length ? reviewHistory[reviewHistoryIndex] : reviewPool[reviewPoolIndex];
    const masteredDisplayedCard = masteredSlideshow ? masteredSlideshow[masteredSlideshowIndex] : undefined;

    // === Side effects: fetch subtitles/examples ===
    useEffect(() => {
        const fetchSubtitlesIfNeeded = async () => {
            if (!activeCard || activeCard.sourceMeaning || !activeCard.sourceVideoUrl || activeCard.sourceTimestamp === undefined) return;
            let videoId = activeCard.sourceVideoId;
            const youtubeId = videoApi.getYouTubeId(activeCard.sourceVideoUrl);
            if (!videoId && activeCard.sourceVideoUrl) {
                try {
                    const searchResult = await videoApi.getAll({ search: activeCard.sourceVideoUrl, limit: 1 });
                    if (searchResult.data.length > 0) videoId = searchResult.data[0].id;
                } catch (e) { console.error('Failed to resolve video ID by URL:', e); }
            }
            if (!videoId || videoSubtitles[videoId] || !/^[0-9a-fA-F]{24}$/.test(videoId)) return;
            try {
                const subs = await videoApi.getSubtitles(videoId);
                setVideoSubtitles(prev => ({ ...prev, [videoId!]: subs }));
            } catch (error) { console.error('Failed to fetch fallback subtitles:', error); }
        };
        const fetchExamplesIfNeeded = async () => {
            const vocab = getVocab(activeCard);
            if (!vocab || (vocab.examples && vocab.examples.length > 0)) return;
            if (fallbackExamples[vocab.hanzi]) return;
            try {
                const examples = await dictionaryApi.getExamples(vocab.hanzi);
                setFallbackExamples(prev => ({ ...prev, [vocab.hanzi]: examples }));
            } catch (error) { console.error('Failed to fetch fallback examples:', error); }
        };
        fetchSubtitlesIfNeeded();
        fetchExamplesIfNeeded();
    }, [activeCard, videoSubtitles, fallbackExamples]);

    // === SRS Rating Handler ===
    const handleSRSRating = async (rating: SRSRating) => {
        if (!currentCard || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await flashcardApi.submitReview(currentCard.id, rating);
            
            // Refined Logic: If failed, ensure it's removed from Mastered
            if (rating === 'again') {
                setMasteredCards(prev => prev.filter(c => c.id !== currentCard.id));
                setWrongWords(prev => [...prev.filter(w => w.id !== currentCard.id), currentCard]);
                setSessionWrongCount(prev => prev + 1);
            } else {
                setCorrectWords(prev => [...prev.filter(w => w.id !== currentCard.id), currentCard]);
                setSessionCorrectCount(prev => prev + 1);
            }
            setSessionHistory(prev => {
                const newHistory = [...prev.filter(w => w.id !== currentCard.id), currentCard];
                setHistoryIndex(newHistory.length);
                return newHistory;
            });
            setReviewedCount(prev => prev + 1);
            setCardsSinceLastMatch(prev => {
                const total = prev + 1;
                if (total >= 10 && (wrongWords.length > 0 || correctWords.length > 0)) {
                    setShowMatchingGame(true);
                    return 0;
                }
                return total;
            });
            setIsRevealed(false);
            setTimeout(() => {
                if (currentCardIndex < queue.length - 1) {
                    setCurrentCardIndex(prev => prev + 1);
                    setIsRevealed(false);
                } else {
                    if (wrongWords.length > 0 || correctWords.length > 0) {
                        setShowMatchingGame(true);
                    } else {
                        setCurrentCardIndex(-1);
                    }
                }
            }, 300);
        } catch (err) { console.error('Failed to submit review:', err); }
        finally { setIsSubmitting(false); }
    };

    // === Review Swipe Handler (Ôn Tập - no SRS submit for right) ===
    const handleReviewSwipe = async (direction: 'left' | 'right') => {
        const card = reviewPool[reviewPoolIndex];
        if (!card || isSubmitting) return;
        setIsSubmitting(true);
        try {
            if (direction === 'left') {
                // Submit 'again' to SRS for left swipe
                try { 
                    await flashcardApi.submitReview(card.id, 'again'); 
                    setSessionWrongCount(prev => prev + 1);
                    
                    // Refined Logic: Remove from Mastered and return to SRS Queue (Cần Học)
                    setMasteredCards(prev => prev.filter(c => c.id !== card.id));
                    setQueue(prev => {
                        if (prev.find(q => q.id === card.id)) return prev;
                        return [...prev, card];
                    });
                } catch (err) { console.error('Failed to submit review:', err); }
            } else {
                setSessionCorrectCount(prev => prev + 1);
            }
            // Track in review history
            setReviewHistory(prev => {
                const newHist = [...prev.filter(w => w.id !== card.id), card];
                setReviewHistoryIndex(newHist.length);
                return newHist;
            });
            setReviewRevealed(false);
            setTimeout(() => {
                if (reviewPoolIndex < reviewPool.length - 1) {
                    setReviewPoolIndex(prev => prev + 1);
                } else {
                    if (wrongWords.length > 0 || correctWords.length > 0) {
                        setShowMatchingGame(true);
                    } else {
                        setReviewCompleted(true);
                    }
                }
            }, 300);
        } finally { setIsSubmitting(false); }
    };

    // === Navigation Functions ===
    const navigateHistory = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            if (historyIndex > 0) { setHistoryIndex(prev => prev - 1); setIsRevealed(false); }
        } else {
            if (historyIndex < sessionHistory.length - 1) { setHistoryIndex(prev => prev + 1); setIsRevealed(false); }
            else { setHistoryIndex(sessionHistory.length); setIsRevealed(false); }
        }
    };

    const navigateReviewHistory = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            if (reviewHistoryIndex > 0) { setReviewHistoryIndex(prev => prev - 1); setReviewRevealed(false); }
        } else {
            if (reviewHistoryIndex < reviewHistory.length - 1) { setReviewHistoryIndex(prev => prev + 1); setReviewRevealed(false); }
            else { setReviewHistoryIndex(reviewHistory.length); setReviewRevealed(false); }
        }
    };

    const navigateMasteredSlideshow = (direction: 'prev' | 'next') => {
        if (!masteredSlideshow) return;
        if (direction === 'prev') {
            if (masteredSlideshowIndex > 0) { setMasteredSlideshowIndex(prev => prev - 1); setMasteredRevealed(false); }
        } else {
            if (masteredSlideshowIndex < masteredSlideshow.length - 1) { setMasteredSlideshowIndex(prev => prev + 1); setMasteredRevealed(false); }
        }
    };

    // === Shared Flashcard Render Function ===
    const renderCardFaces = (card: FlashcardType | undefined, flipped: boolean, guideNode: React.ReactNode) => {
        const vocab = getVocab(card);
        if (!vocab) return null;
        return (
            <div className={`relative w-full h-full transition-transform duration-700 transform-style-preserve-3d ${flipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                {/* FRONT SIDE */}
                <div className="absolute inset-0 w-full h-full flashcard-glass flashcard-border-glow card-lift rounded-2xl shadow-2xl flex flex-col items-center justify-center overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                    <h1 className="text-8xl md:text-9xl font-bold text-white tracking-tight font-chinese mb-6 text-glow" lang="zh-CN">{vocab.hanzi}</h1>
                    <div className="level-badge px-5 py-2 rounded-xl flex items-center gap-3 mb-6">
                        <span className="text-lg font-bold text-primary">HSK {vocab.hskLevel || card?.level || 1}</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary animate-pulse-glow">
                        <Icon name="touch_app" size="md" />
                        <span className="text-sm font-medium">Nhấn để xem đáp án</span>
                    </div>
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/8 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-green-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                </div>
                {/* BACK SIDE */}
                <div className="absolute inset-0 w-full h-full flashcard-glass rounded-2xl shadow-2xl border border-primary/20 flex flex-col overflow-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <div className="flex-1 flex flex-col items-center p-6 md:p-8 pt-6 overflow-y-auto">
                        {/* Hanzi + Pinyin */}
                        <div className="text-center mb-4">
                            <h2 className="text-5xl md:text-6xl font-bold text-white font-chinese mb-2" lang="zh-CN">{vocab.hanzi}</h2>
                            <div className="flex flex-col items-center justify-center gap-1">
                                <span className="text-2xl md:text-3xl text-primary font-semibold font-pinyin tracking-tight">{vocab.pinyin || card?.sourcePinyin}</span>
                                <SpeakerButton text={vocab.hanzi || ''} size="md" />
                            </div>
                        </div>
                        <div className="w-16 h-0.5 bg-primary/30 rounded-full mb-4" />
                        {/* Meaning */}
                        <div className="text-center mb-4 space-y-2">
                            {(vocab.meaningVi && vocab.meaningVi.trim()) ? (
                                vocab.meaningVi.includes('1.') ? (
                                    vocab.meaningVi.split(/(?=\d+\.)/).map((part: string, i: number) => (
                                        <div key={i} className="text-xl font-medium leading-relaxed">{renderFormattedMeaning(part)}</div>
                                    ))
                                ) : (
                                    <p className="text-xl md:text-2xl text-white font-medium">{vocab.meaningVi}</p>
                                )
                            ) : (
                                <p className="text-xl md:text-2xl text-white font-medium">{vocab.meaningEn}</p>
                            )}
                        </div>
                        {/* Example */}
                        {(() => {
                            const hanziForLookup = vocab.hanzi || (vocab as any).word;
                            const examples = (vocab.examples && vocab.examples.length > 0) ? vocab.examples : (fallbackExamples[hanziForLookup] || []);
                            if (examples.length === 0) return null;
                            const ex = examples[0] as any;
                            const exHanzi = ex.chinese || ex.hanzi;
                            const exPinyin = ex.pinyin;
                            const exMeaning = (ex.vietnamese && ex.vietnamese.trim()) || (ex.translation && ex.translation.trim()) || (ex.meaningVi && ex.meaningVi.trim()) || ex.meaning;
                            if (!exHanzi && !exPinyin) return null;
                            return (
                                <div 
                                    className="w-full max-w-md p-4 bg-surface-highlight/20 border border-border-color/30 rounded-2xl group hover:bg-surface-highlight/40 transition-all text-left mb-4"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onPointerUp={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest opacity-80">Ví dụ</span>
                                        <SpeakerButton text={exHanzi || ''} size="sm" className="opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-white font-chinese text-lg leading-snug" lang="zh-CN">{exHanzi}</p>
                                        {exPinyin && <p className="text-primary/70 text-xs font-pinyin tracking-tight">{exPinyin}</p>}
                                        <p className="text-text-secondary text-sm italic leading-relaxed mt-1">{exMeaning}</p>
                                    </div>
                                </div>
                            );
                        })()}
                        {/* Context */}
                        {(() => {
                            const hasContext = card?.sourceVideoUrl || card?.sourceSentence || card?.sourceImageUrl;
                            if (!hasContext) return null;
                            const word = vocab.hanzi || '';
                            return (
                                <div 
                                    className="w-full max-w-md bg-primary/5 rounded-2xl p-5 border border-primary/20 space-y-4 shadow-lg shadow-primary/5"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onPointerUp={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[10px] text-primary font-black uppercase tracking-widest">
                                            <Icon name="play_circle" size="sm" />Học trong ngữ cảnh
                                        </div>
                                        <SpeakerButton text={card?.sourceSentence || ''} size="sm" className="opacity-40 hover:opacity-100 transition-opacity" />
                                    </div>
                                    {card?.sourceVideoUrl && card?.sourceTimestamp !== undefined && (
                                        <div onClick={(e) => e.stopPropagation()} className="rounded-xl overflow-hidden shadow-md">
                                            <VideoClipPlayer videoUrl={card.sourceVideoUrl} startTime={card.sourceTimestamp} duration={5} />
                                        </div>
                                    )}
                                    {!card?.sourceVideoUrl && card?.sourceImageUrl && (
                                        <div className="relative rounded-xl overflow-hidden aspect-video bg-black/20 shadow-md">
                                            <img src={card.sourceImageUrl} alt="Video context" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {card?.sourceSentence && (
                                            <p className="text-white font-chinese text-lg leading-relaxed" lang="zh-CN">
                                                {card.sourceSentence.split(word).map((part: string, i: number, arr: string[]) => (
                                                    <span key={i}>{part}{i < arr.length - 1 && <span className="text-primary font-bold underline underline-offset-4 decoration-2">{word}</span>}</span>
                                                ))}
                                            </p>
                                        )}
                                        {(() => {
                                            const vId = card?.sourceVideoUrl ? videoApi.getYouTubeId(card.sourceVideoUrl) : null;
                                            const subs = vId ? videoSubtitles[vId] : null;
                                            const match = subs?.find((s: Subtitle) => Math.abs(s.startTime - (card?.sourceTimestamp || 0)) < 3.0);
                                            const tokens = card?.sourceTokens || (match as any)?.tokens;
                                            const meaningText = card?.sourceMeaning || match?.meaningVi;
                                            return (
                                                <>
                                                    {card?.sourcePinyin && (
                                                        <p className="text-text-secondary text-xs font-pinyin tracking-tight opacity-70 italic">
                                                            {renderGroupedPinyin(card.sourceSentence || '', card.sourcePinyin, tokens)}
                                                        </p>
                                                    )}
                                                    {meaningText && (
                                                        <div className="border-l-2 border-primary/20 pl-3 mt-2">
                                                            <p className="text-sm text-text-secondary italic leading-relaxed">{meaningText}</p>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    {/* Guide at bottom */}
                    <div className="flex items-center justify-center gap-6 py-4 text-text-secondary border-t border-border-color bg-background-dark/50">
                        {guideNode}
                    </div>
                </div>
            </div>
        );
    };

    // === Shared Swipeable Flashcard View ===
    const renderSwipeableView = (
        displayedCard: FlashcardType | undefined,
        revealed: boolean,
        setRevealed: (v: boolean) => void,
        onSwipeLeft: () => void,
        onSwipeRight: () => void,
        swipeDisabled: boolean,
        isHistory: boolean,
        historyCount: number,
        historyIdx: number,
        onNavigate: (dir: 'prev' | 'next') => void,
        canPrev: boolean,
        canNext: boolean,
    ) => (
        <>
            {/* Navigation Arrows */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between w-full px-4 pointer-events-none z-10">
                <button onClick={(e) => { e.stopPropagation(); onNavigate('prev'); }} disabled={!canPrev}
                    className={`size-12 rounded-full flex items-center justify-center bg-background-dark/80 border border-border-color pointer-events-auto transition-all ${!canPrev ? 'opacity-0 scale-90' : 'opacity-100 hover:bg-surface-highlight hover:border-primary'}`}>
                    <Icon name="arrow_back" className="text-white" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onNavigate('next'); }} disabled={!canNext}
                    className={`size-12 rounded-full flex items-center justify-center bg-background-dark/80 border border-border-color pointer-events-auto transition-all ${!canNext ? 'opacity-0 scale-90' : 'opacity-100 hover:bg-surface-highlight hover:border-primary'}`}>
                    <Icon name="arrow_forward" className="text-white" />
                </button>
            </div>

            {/* Swipeable Card */}
            <div className="w-full max-w-3xl mt-12 mb-8 relative">
                {/* Swipe Hints - Improved Visibility & Positioning */}
                <div className="absolute -top-15 left-0 right-0 flex justify-between w-full px-4 pointer-events-none z-20">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 backdrop-blur-sm shadow-sm ring-1 ring-rose-500/10">
                        <Icon name="west" size="sm" className="text-rose-400" />
                        <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Chưa thuộc</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm shadow-sm ring-1 ring-emerald-500/10">
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Đã thuộc</span>
                        <Icon name="east" size="sm" className="text-emerald-400" />
                    </div>
                </div>

                {isHistory && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-[10px] font-black text-yellow-500 uppercase tracking-tighter z-20">
                        Đang xem lại lịch sử ({historyIdx + 1}/{historyCount})
                    </div>
                )}
                <SwipeCard onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} disabled={swipeDisabled} onClick={() => setRevealed(!revealed)}>
                    <div className="w-full h-[520px] perspective-1000 cursor-pointer">
                        {renderCardFaces(displayedCard, revealed,
                            revealed ? (
                                <div className="flex items-center gap-2 animate-pulse text-primary font-bold">
                                    <Icon name={isHistory ? 'visibility' : 'swipe'} size="sm" />
                                    <span className="text-sm">{isHistory ? 'Đã xem đáp án' : 'Vuốt để trả lời • Nhấn để lật lại'}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 opacity-60">
                                    <Icon name="touch_app" size="sm" />
                                    <span className="text-sm">Nhấn để lật thẻ</span>
                                </div>
                            )
                        )}
                    </div>
                </SwipeCard>
            </div>

            {/* Flip Toggle Button */}
            <Button
                variant={revealed ? "secondary" : "primary"}
                size="lg"
                className={`rounded-full px-12 py-6 text-xl shadow-xl transition-all ${!revealed ? 'animate-bounce-slow shadow-primary/20' : 'opacity-80 hover:opacity-100'}`}
                onClick={() => setRevealed(!revealed)}
            >
                <div className="flex items-center gap-3">
                    <Icon name={revealed ? "rotate_left" : "visibility"} size="lg" />
                    {revealed ? "Lật lại" : "Lật thẻ"}
                </div>
            </Button>
        </>
    );

    // === Loading/Error/Empty States ===
    if (isLoading) {
        return (
            <div className="bg-background-dark text-white font-display min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-text-secondary">Đang tải flashcards...</p>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="bg-background-dark text-white font-display min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Icon name="error" className="text-6xl text-red-400 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Có lỗi xảy ra</h2>
                    <p className="text-text-secondary mb-4">{error}</p>
                    <Button variant="secondary" onClick={fetchData}>Thử lại</Button>
                </div>
            </div>
        );
    }
    const srsQueueEmpty = queue.length === 0 || currentCardIndex === -1;

    // === HSK Groups for Đã Học ===
    const hskGroups = [1, 2, 3, 4, 5, 6];
    const getHskCards = (hsk: number) => masteredCards.filter(c => getVocab(c)?.hskLevel === hsk);
    const otherCards = masteredCards.filter(c => { const lvl = getVocab(c)?.hskLevel; return !lvl || lvl < 1 || lvl > 6; });

    // === Review pool size for sidebar ===
    const reviewPoolSize = correctWords.length + wrongWords.length + Math.min(5, masteredCards.length);

    return (
        <div className="bg-background-dark text-white font-display min-h-screen flex flex-col overflow-x-hidden selection:bg-primary selection:text-on-primary">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-border-color px-4 md:px-8 py-3">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="size-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white"><Icon name="arrow_back" /></Link>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wider"><span>Ôn tập hàng ngày</span></div>
                            <h1 className="text-white text-lg font-bold leading-tight">Flashcards</h1>
                        </div>
                    </div>
                    <div className="hidden md:flex flex-col w-1/3 max-w-sm gap-2">
                        <div className="flex justify-between text-xs font-bold text-text-secondary">
                            <span>Tiến độ</span>
                            <span className="text-white">{reviewedCount} / {totalCards}</span>
                        </div>
                        <div className="h-2 w-full bg-surface-highlight rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(76,223,32,0.5)] transition-all" style={{ width: `${totalCards > 0 ? (reviewedCount / totalCards) * 100 : 0}%` }} />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-1 bg-surface-dark px-3 py-1.5 rounded-full border border-border-color">
                            <Icon name="local_fire_department" className="text-orange-500" size="md" />
                            <span className="text-sm font-bold text-white">{user?.streak || 0}</span>
                        </div>
                        <div className="hidden md:flex items-center gap-1 bg-surface-dark px-3 py-1.5 rounded-full border border-border-color">
                            <Icon name="sailing" className="text-cyan-400" size="md" />
                            <span className="text-sm font-bold text-white">{user?.xp || 0}</span>
                        </div>
                        <NotificationDropdown />
                        <button onClick={() => router.push('/profile')} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user?.name || 'User'} className="rounded-full size-10 ring-2 ring-border-color object-cover" />
                            ) : (
                                <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-full size-10 ring-2 ring-border-color flex items-center justify-center text-on-primary font-bold">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1">
                    {/* === SIDEBAR === */}
                    <aside className="lg:col-span-3 xl:col-span-3 flex flex-col gap-4">
                        <div className="bg-surface-dark rounded-[2rem] p-6 border border-border-color flex flex-col gap-5 shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -mr-10 -mt-10 pointer-events-none" />
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="size-10 rounded-xl bg-surface-highlight flex items-center justify-center text-primary"><Icon name="navigation" /></div>
                                <h2 className="text-white text-lg font-bold">Chế độ học</h2>
                            </div>
                            <div className="flex flex-col gap-3 relative z-10">
                                {/* Cần Học */}
                                <button onClick={() => { setViewMode('srs'); setShowMatchingGame(false); }}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${viewMode === 'srs' && !showMatchingGame ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(32,167,223,0.2)]' : 'bg-background-dark/50 border-border-color hover:border-surface-highlight'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded-full flex items-center justify-center ${viewMode === 'srs' && !showMatchingGame ? 'bg-primary text-on-primary' : 'bg-surface-highlight text-text-secondary'}`}>
                                            <Icon name="psychology" size="sm" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold">Cần học</span>
                                        </div>
                                    </div>
                                    <span className="text-white text-xl font-bold">{totalCards - reviewedCount}</span>
                                </button>
                                {/* Đã Học */}
                                <button onClick={() => { setViewMode('mastered'); setShowMatchingGame(false); setMasteredSlideshow(null); }}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${viewMode === 'mastered' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-background-dark/50 border-border-color hover:border-surface-highlight'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded-full flex items-center justify-center ${viewMode === 'mastered' ? 'bg-emerald-500 text-white' : 'bg-surface-highlight text-text-secondary'}`}>
                                            <Icon name="verified" size="sm" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold">Đã học</span>
                                        </div>
                                    </div>
                                    <span className="text-white text-xl font-bold">{masteredCards.length}</span>
                                </button>
                                {/* Ôn Tập */}
                                <button onClick={enterReviewMode}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${viewMode === 'review' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-background-dark/50 border-border-color hover:border-surface-highlight'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded-full flex items-center justify-center ${viewMode === 'review' ? 'bg-orange-500 text-white' : 'bg-surface-highlight text-text-secondary'}`}>
                                            <Icon name="replay" size="sm" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold">Ôn tập</span>
                                        </div>
                                    </div>
                                    <span className="text-white text-xl font-bold">{reviewPoolSize}</span>
                                </button>
                                {/* Ghép Đôi (Matching) */}
                                <button onClick={() => { setViewMode('matching'); setShowMatchingGame(true); }}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${viewMode === 'matching' ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-background-dark/50 border-border-color hover:border-surface-highlight'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded-full flex items-center justify-center ${viewMode === 'matching' ? 'bg-purple-500 text-white' : 'bg-surface-highlight text-text-secondary'}`}>
                                            <Icon name="grid_view" size="sm" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold">Ghép đôi</span>
                                        </div>
                                    </div>
                                    <Icon name="play_arrow" className="text-purple-400" />
                                </button>
                            </div>
                        </div>
                        {/* Today Stats */}
                        <div className="bg-surface-dark/50 rounded-2xl p-4 border border-border-color flex justify-between items-center">
                            <span className="text-text-secondary text-xs uppercase font-bold tracking-widest">Hôm nay</span>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1"><Icon name="check_circle" size="sm" className="text-emerald-400" /><span className="text-white text-sm font-bold">{sessionCorrectCount}</span></div>
                                <div className="flex items-center gap-1"><Icon name="cancel" size="sm" className="text-rose-400" /><span className="text-white text-sm font-bold">{sessionWrongCount}</span></div>
                            </div>
                        </div>
                    </aside>

                    {/* === CENTER CONTENT === */}
                    <section className="lg:col-span-9 xl:col-span-9 flex flex-col items-center justify-start min-h-[600px] relative pb-4">
                        {/* Matching Game Overlay */}
                        {showMatchingGame ? (
                            <MatchingGame
                                wrongWords={wrongWords.length > 0 ? wrongWords : masteredCards.slice(0, 5)}
                                correctWords={correctWords.length > 0 ? correctWords : masteredCards.slice(5, 10)}
                                onComplete={() => {
                                    setShowMatchingGame(false);
                                    if (viewMode === 'review') { setReviewCompleted(true); }
                                    else { setViewMode('srs'); }
                                    setWrongWords([]);
                                    setCorrectWords([]);
                                }}
                                onStatUpdate={(type) => {
                                    if (type === 'correct') setSessionCorrectCount(prev => prev + 1);
                                    else setSessionWrongCount(prev => prev + 1);
                                }}
                            />

                        /* === MASTERED VIEW === */
                        ) : viewMode === 'mastered' ? (
                            masteredSlideshow ? (
                                /* Mastered Slideshow */
                                <div className="w-full max-w-3xl animate-fade-in flex flex-col items-center relative">
                                    <div className="w-full flex items-center justify-between mb-4">
                                        <button onClick={() => setMasteredSlideshow(null)} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
                                            <Icon name="arrow_back" size="sm" /><span className="text-sm font-bold">Quay lại</span>
                                        </button>
                                        <span className="text-text-secondary text-sm font-bold">{masteredSlideshowIndex + 1} / {masteredSlideshow.length}</span>
                                    </div>
                                    {/* Navigation Arrows */}
                                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between w-full px-4 pointer-events-none z-10">
                                        <button onClick={() => navigateMasteredSlideshow('prev')} disabled={masteredSlideshowIndex <= 0}
                                            className={`size-12 rounded-full flex items-center justify-center bg-background-dark/80 border border-border-color pointer-events-auto transition-all ${masteredSlideshowIndex <= 0 ? 'opacity-0 scale-90' : 'opacity-100 hover:bg-surface-highlight hover:border-primary'}`}>
                                            <Icon name="arrow_back" className="text-white" />
                                        </button>
                                        <button onClick={() => navigateMasteredSlideshow('next')} disabled={masteredSlideshowIndex >= masteredSlideshow.length - 1}
                                            className={`size-12 rounded-full flex items-center justify-center bg-background-dark/80 border border-border-color pointer-events-auto transition-all ${masteredSlideshowIndex >= masteredSlideshow.length - 1 ? 'opacity-0 scale-90' : 'opacity-100 hover:bg-surface-highlight hover:border-primary'}`}>
                                            <Icon name="arrow_forward" className="text-white" />
                                        </button>
                                    </div>
                                    <div className="w-full mt-4 mb-8">
                                        <div className="w-full h-[520px] perspective-1000 cursor-pointer" onClick={() => setMasteredRevealed(!masteredRevealed)}>
                                            {renderCardFaces(masteredDisplayedCard, masteredRevealed,
                                                <div className="flex items-center gap-2 opacity-60">
                                                    <Icon name="touch_app" size="sm" />
                                                    <span className="text-sm">{masteredRevealed ? 'Nhấn để lật lại' : 'Nhấn để lật thẻ'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant={masteredRevealed ? "secondary" : "primary"}
                                        size="lg"
                                        className="rounded-full px-12 py-6 text-xl shadow-xl"
                                        onClick={() => setMasteredRevealed(!masteredRevealed)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon name={masteredRevealed ? "rotate_left" : "visibility"} size="lg" />
                                            {masteredRevealed ? "Lật lại" : "Lật thẻ"}
                                        </div>
                                    </Button>
                                </div>
                            ) : (
                                /* Mastered Grid View */
                                <div className="w-full max-w-4xl animate-fade-in">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30"><Icon name="verified" size="lg" /></div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-white">Thư viện Từ vựng</h2>
                                                <p className="text-text-secondary text-sm">Tổng cộng {masteredCards.length} từ đã học</p>
                                            </div>
                                        </div>
                                        <Button variant="secondary" size="sm" onClick={fetchMastered} disabled={isLoadingMastered}>
                                            <Icon name="refresh" size="sm" className={isLoadingMastered ? 'animate-spin' : ''} />
                                        </Button>
                                    </div>
                                    {isLoadingMastered ? (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                            <span className="text-text-secondary text-sm">Đang tải dữ liệu...</span>
                                        </div>
                                    ) : masteredCards.length === 0 ? (
                                        <div className="bg-surface-dark/50 border border-dashed border-border-color rounded-3xl p-12 text-center">
                                            <Icon name="school" size="xl" className="text-text-secondary/30 mb-4" />
                                            <p className="text-text-secondary font-medium">Bạn chưa có từ vựng nào.</p>
                                            <p className="text-xs text-text-secondary/60 mt-2">Hãy bắt đầu học trong &quot;Cần học&quot;!</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            {hskGroups.map(hsk => {
                                                const cards = getHskCards(hsk);
                                                if (cards.length === 0) return null;
                                                return (
                                                    <div key={hsk} className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">HSK {hsk}</span>
                                                            <div className="h-px flex-1 bg-gradient-to-r from-border-color to-transparent" />
                                                            <button onClick={() => enterMasteredSlideshow(cards)} className="flex items-center gap-1 text-primary text-xs font-bold group">
                                                                <Icon name="style" size="sm" />
                                                                <span className="group-hover:underline">Xem flashcard</span>
                                                            </button>
                                                            <span className="text-text-secondary text-xs font-bold uppercase tracking-wider">{cards.length} từ</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                            {cards.map(card => (
                                                                <div key={card.id} className="bg-surface-dark border border-border-color p-4 rounded-2xl hover:border-primary/50 transition-all group flex flex-col gap-2 cursor-pointer"
                                                                    onClick={() => enterMasteredSlideshow([card])}>
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="text-2xl font-chinese text-white group-hover:text-primary transition-colors">{getVocab(card)?.hanzi}</span>
                                                                        <SpeakerButton text={getVocab(card)?.hanzi || ''} size="sm" />
                                                                    </div>
                                                                    <span className="text-primary/70 text-xs font-pinyin">{getVocab(card)?.pinyin || card.sourcePinyin}</span>
                                                                    <span className="text-text-secondary text-xs truncate italic">{getVocab(card)?.meaningVi}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {/* Other cards (non HSK 1-6) */}
                                            {otherCards.length > 0 && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-xs font-black rounded-lg border border-gray-500/30">Khác</span>
                                                        <div className="h-px flex-1 bg-gradient-to-r from-border-color to-transparent" />
                                                        <button onClick={() => enterMasteredSlideshow(otherCards)} className="flex items-center gap-1 text-primary text-xs font-bold group">
                                                            <Icon name="style" size="sm" />
                                                            <span className="group-hover:underline">Xem flashcard</span>
                                                        </button>
                                                        <span className="text-text-secondary text-xs font-bold uppercase tracking-wider">{otherCards.length} từ</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                        {otherCards.map(card => (
                                                                <div key={card.id} className="bg-surface-dark border border-border-color p-4 rounded-2xl hover:border-primary/50 transition-all group flex flex-col gap-2 cursor-pointer"
                                                                onClick={() => enterMasteredSlideshow([card])}>
                                                                <div className="flex justify-between items-start">
                                                                    <span className="text-2xl font-chinese text-white group-hover:text-primary transition-colors">{getVocab(card)?.hanzi}</span>
                                                                    <SpeakerButton text={getVocab(card)?.hanzi || ''} size="sm" />
                                                                </div>
                                                                <span className="text-primary/70 text-xs font-pinyin">{getVocab(card)?.pinyin || card.sourcePinyin}</span>
                                                                <span className="text-text-secondary text-xs truncate italic">{getVocab(card)?.meaningVi}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )

                        /* === REVIEW MODE (Ôn Tập) === */
                        ) : viewMode === 'review' ? (
                            reviewCompleted ? (
                                <div className="text-center max-w-md animate-fade-in">
                                    <div className="size-24 mx-auto mb-6 rounded-full bg-orange-500/20 flex items-center justify-center"><Icon name="emoji_events" className="text-5xl text-orange-400" /></div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Ôn tập hoàn tất!</h2>
                                    <p className="text-text-secondary mb-6">Bạn đã ôn xong {reviewHistory.length} từ vựng.</p>
                                    <div className="flex flex-col gap-3">
                                        <Button variant="primary" onClick={() => { setViewMode('srs'); setReviewCompleted(false); }}>Quay lại Cần học</Button>
                                        <Button variant="secondary" onClick={enterReviewMode}>Ôn tập lại</Button>
                                    </div>
                                </div>
                            ) : reviewPool.length === 0 ? (
                                <div className="text-center max-w-md animate-fade-in">
                                    <div className="size-24 mx-auto mb-6 rounded-full bg-orange-500/20 flex items-center justify-center"><Icon name="inbox" className="text-5xl text-orange-400" /></div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Chưa có từ để ôn tập</h2>
                                    <p className="text-text-secondary mb-6">Hãy học trong &quot;Cần học&quot; trước để có từ vựng ôn tập.</p>
                                    <Button variant="primary" onClick={() => setViewMode('srs')}>Về Cần học</Button>
                                </div>
                            ) : (
                                renderSwipeableView(
                                    reviewDisplayedCard,
                                    reviewRevealed,
                                    setReviewRevealed,
                                    () => handleReviewSwipe('left'),
                                    () => handleReviewSwipe('right'),
                                    !reviewRevealed || reviewHistoryIndex < reviewHistory.length,
                                    reviewHistoryIndex < reviewHistory.length,
                                    reviewHistory.length,
                                    reviewHistoryIndex,
                                    navigateReviewHistory,
                                    reviewHistoryIndex > 0,
                                    reviewHistoryIndex < reviewHistory.length,
                                )
                            )

                        /* === MATCHING MODE (Ghép Đôi) === */
                        ) : viewMode === 'matching' ? (
                            <MatchingGame
                                wrongWords={wrongWords.length > 0 ? wrongWords : masteredCards.slice(0, 5)}
                                correctWords={correctWords.length > 0 ? correctWords : masteredCards.slice(5, 10)}
                                onComplete={() => {
                                    setShowMatchingGame(false);
                                    setViewMode('srs');
                                }}
                            />

                        /* === SRS MODE (Cần Học) === */
                        ) : srsQueueEmpty ? (
                            <div className="text-center max-w-md animate-fade-in flex flex-col items-center justify-center flex-1">
                                <div className="size-24 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Icon name={reviewedCount > 0 ? 'celebration' : 'inbox'} className="text-5xl text-primary" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    {reviewedCount > 0 ? 'Hoàn thành!' : 'Không có từ cần ôn'}
                                </h2>
                                <p className="text-text-secondary mb-6">
                                    {reviewedCount > 0
                                        ? `Bạn đã ôn tập ${reviewedCount} từ. Tuyệt vời!`
                                        : 'Bạn đã ôn tập hết tất cả từ vựng hôm nay.'}
                                </p>
                                <div className="flex flex-col gap-3 w-full max-w-xs">
                                    <Button variant="secondary" onClick={() => setViewMode('mastered')}>
                                        <Icon name="verified" size="sm" className="mr-2" />Xem từ đã học
                                    </Button>
                                    <Button variant="secondary" onClick={enterReviewMode}>
                                        <Icon name="replay" size="sm" className="mr-2" />Ôn tập
                                    </Button>
                                    <Button variant="secondary" onClick={() => { setViewMode('matching'); setShowMatchingGame(true); }}>
                                        <Icon name="grid_view" size="sm" className="mr-2" />Ghép đôi
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            renderSwipeableView(
                                srsDisplayedCard,
                                isRevealed,
                                setIsRevealed,
                                () => handleSRSRating('again'),
                                () => handleSRSRating('good'),
                                !isRevealed || historyIndex < sessionHistory.length,
                                historyIndex < sessionHistory.length,
                                sessionHistory.length,
                                historyIndex,
                                navigateHistory,
                                historyIndex > 0,
                                historyIndex < sessionHistory.length,
                            )
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
