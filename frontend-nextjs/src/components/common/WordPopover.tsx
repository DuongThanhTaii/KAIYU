"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "./index";
import SpeakerButton from "./SpeakerButton";
import { dictionaryApi, type LookupResult, type ExampleSentence, type EnrichedWordData } from "@/services/dictionaryApi";
import { vocabularyFoldersApi, type VocabularyFolder } from "@/services/vocabularyFoldersApi";
import { userVocabularyApi } from "@/services/userVocabularyApi";

// Dynamic import for HanziWriter (client-side only)
let HanziWriter: any = null;
if (typeof window !== 'undefined') {
    import('hanzi-writer').then(module => {
        HanziWriter = module.default;
    });
}

// Helper: Extract YouTube video ID and generate thumbnail URL
const getYouTubeThumbnail = (videoUrl?: string): string | undefined => {
    if (!videoUrl) return undefined;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
        const match = videoUrl.match(pattern);
        if (match && match[1]) {
            return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
        }
    }
    return undefined;
};

// HSK Level colors (flat, no gradients)
const HSK_COLORS: Record<number, string> = {
    1: 'bg-emerald-500',
    2: 'bg-cyan-500',
    3: 'bg-blue-500',
    4: 'bg-violet-500',
    5: 'bg-orange-500',
    6: 'bg-rose-500',
};

interface WordPopoverProps {
    word: string;
    position: { x: number; y: number };
    onClose: () => void;
    sourceVideoId?: string;
    sourceTimestamp?: number;
    sourceSentence?: string;
    sourcePinyin?: string;
    videoUrl?: string;
}

type PanelType = 'dictionary' | 'stroke' | 'tutor' | 'related' | 'flashcard' | 'history';

export function WordPopover({
    word,
    position,
    onClose,
    sourceVideoId,
    sourceTimestamp,
    sourceSentence,
    sourcePinyin,
    videoUrl
}: WordPopoverProps) {
    // Data states
    const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
    const [examples, setExamples] = useState<ExampleSentence[]>([]);
    const [enrichedData, setEnrichedData] = useState<EnrichedWordData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEnrichLoading, setIsEnrichLoading] = useState(false);

    // UI states
    const [folders, setFolders] = useState<VocabularyFolder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [savedInFolder, setSavedInFolder] = useState<string | null>(null); // folder name if already saved
    const [activePanel, setActivePanel] = useState<PanelType>('dictionary');
    const [xpGained, setXpGained] = useState(0);
    const [showXpAnimation, setShowXpAnimation] = useState(false);

    // History state
    const [lookupHistory, setLookupHistory] = useState<{ word: string; pinyin: string; meaning: string; timestamp: number }[]>([]);

    // Stroke practice states
    const [strokeMode, setStrokeMode] = useState<'animate' | 'quiz'>('animate');
    const [quizResult, setQuizResult] = useState<'idle' | 'correct' | 'wrong'>('idle');

    // Refs
    const popoverRef = useRef<HTMLDivElement>(null);
    const strokeContainerRef = useRef<HTMLDivElement>(null);
    const hanziWriterRef = useRef<any>(null);
    const [popupHeight, setPopupHeight] = useState(0);
    const [isPositioned, setIsPositioned] = useState(false);

    // Popup configuration
    const POPUP_WIDTH = 460;
    const ARROW_HEIGHT = 10;
    const GAP = 8;

    // Panel definitions
    const panels: { id: PanelType; icon: string; label: string }[] = [
        { id: 'dictionary', icon: 'menu_book', label: 'Từ điển' },
        { id: 'stroke', icon: 'draw', label: 'Luyện viết' },
        { id: 'tutor', icon: 'psychology', label: 'AI Tutor' },
        { id: 'related', icon: 'hub', label: 'Từ liên quan' },
        { id: 'flashcard', icon: 'style', label: 'Flashcard' },
        { id: 'history', icon: 'history', label: 'Lịch sử' },
    ];

    // Measure popup height after render
    useEffect(() => {
        if (popoverRef.current) {
            const height = popoverRef.current.offsetHeight;
            setPopupHeight(height);
            requestAnimationFrame(() => {
                setIsPositioned(true);
            });
        }
    }, [lookupResult, examples, isLoading, activePanel, enrichedData]);

    // Calculate position - popup appears ABOVE the character
    const getAdjustedPosition = () => {
        const padding = 16;
        const actualHeight = popupHeight || 400;
        let y = position.y - actualHeight - ARROW_HEIGHT - GAP;
        if (y < padding) y = padding;
        let x = position.x - POPUP_WIDTH / 2;
        if (x < padding) x = padding;
        if (x + POPUP_WIDTH > window.innerWidth - padding) {
            x = window.innerWidth - POPUP_WIDTH - padding;
        }
        return { x, y };
    };

    const adjustedPos = getAdjustedPosition();
    const arrowLeft = position.x - adjustedPos.x;

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    // Track if fetch has been done
    const hasFetchedRef = useRef<string | null>(null);
    const hasEnrichedRef = useRef<string | null>(null);

    // Lookup word and examples
    useEffect(() => {
        if (hasFetchedRef.current === word) return;
        const fetchData = async () => {
            hasFetchedRef.current = word;
            setIsLoading(true);
            try {
                const [result, foldersList] = await Promise.all([
                    // Pass sourcePinyin for context-aware entry prioritization
                    dictionaryApi.lookup(word, sourcePinyin),
                    vocabularyFoldersApi.getAll().catch(() => []),
                ]);
                setLookupResult(result);
                setFolders(foldersList);
                if (result.found) {
                    dictionaryApi.getExamples(word)
                        .then(exs => setExamples(exs))
                        .catch(() => setExamples([]));
                }
            } catch (error) {
                console.error("Failed to lookup word:", error);
                hasFetchedRef.current = null;
            } finally {
                setIsLoading(false);
            }
        };
        if (word) fetchData();
    }, [word, sourcePinyin]);

    // Fetch enriched data when switching to panels that need it
    useEffect(() => {
        const needsEnrich = ['stroke', 'tutor', 'related'].includes(activePanel);
        if (needsEnrich && hasEnrichedRef.current !== word && lookupResult?.found) {
            hasEnrichedRef.current = word;
            setIsEnrichLoading(true);
            dictionaryApi.getEnrichedData(word, lookupResult.pinyin, lookupResult.meaningVi || lookupResult.meaningEn)
                .then(data => setEnrichedData(data))
                .catch(() => setEnrichedData(null))
                .finally(() => setIsEnrichLoading(false));
        }
    }, [activePanel, word, lookupResult]);

    // Load history when switching to history panel
    useEffect(() => {
        if (activePanel === 'history') {
            dictionaryApi.getHistory().then(history => {
                setLookupHistory(history);
            });
        }
    }, [activePanel]);

    // Initialize HanziWriter when stroke panel is active
    useEffect(() => {
        if (activePanel === 'stroke' && strokeContainerRef.current && word.length === 1 && HanziWriter) {
            if (hanziWriterRef.current) {
                hanziWriterRef.current = null;
            }
            strokeContainerRef.current.innerHTML = '';

            try {
                const options: any = {
                    width: 200,
                    height: 200,
                    padding: 5,
                    showOutline: true,
                    strokeAnimationSpeed: 1,
                    delayBetweenStrokes: 200,
                    strokeColor: '#22c55e',
                    outlineColor: '#374151',
                    drawingColor: '#3b82f6',
                    showHintAfterMisses: 3,
                };

                hanziWriterRef.current = HanziWriter.create(strokeContainerRef.current, word, options);
            } catch (e) {
                console.log('HanziWriter init error:', e);
            }
        }
        return () => {
            if (hanziWriterRef.current) {
                hanziWriterRef.current = null;
            }
        };
    }, [activePanel, word]);

    // Stroke animation
    const animateStrokes = useCallback(() => {
        if (hanziWriterRef.current) {
            hanziWriterRef.current.animateCharacter();
        }
    }, []);

    // Quiz mode
    const startQuiz = useCallback(() => {
        setStrokeMode('quiz');
        setQuizResult('idle');
        if (hanziWriterRef.current) {
            hanziWriterRef.current.quiz({
                onComplete: (summaryData: any) => {
                    if (summaryData.totalMistakes === 0) {
                        setQuizResult('correct');
                        triggerXp(20);
                    } else {
                        setQuizResult('wrong');
                    }
                }
            });
        }
    }, []);

    // XP animation
    const triggerXp = useCallback((amount: number) => {
        setXpGained(amount);
        setShowXpAnimation(true);
        setTimeout(() => setShowXpAnimation(false), 2000);
    }, []);

    // Save word
    const handleSave = async () => {
        if (!lookupResult?.found) return;
        setIsSaving(true);
        try {
            const sourceImageUrl = getYouTubeThumbnail(videoUrl);
            await userVocabularyApi.saveWord({
                hanzi: word,
                pinyin: lookupResult.pinyin || lookupResult.pinyinDisplay,
                meaningVi: lookupResult.meaningVi || lookupResult.meaningEn,
                sourceVideoId,
                folderId: selectedFolderId || undefined,
                sourceTimestamp,
                sourceSentence,
                sourcePinyin,
                sourceImageUrl,
            });
            setSaveSuccess(true);
            triggerXp(10);
            // Find folder name
            const folder = folders.find(f => f.id === selectedFolderId);
            setSavedInFolder(folder?.name || 'Mặc định');
            // Don't auto-close popup
        } catch (error: any) {
            if (error?.response?.status === 409) {
                // Word already exists
                setSaveSuccess(true);
                setSavedInFolder('đã lưu trước đó');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const displayDefinitions = lookupResult?.definitionsVi?.length
        ? lookupResult.definitionsVi
        : lookupResult?.definitions || [];

    // Get HSK level (mock - would come from DB)
    const hskLevel = 1; // TODO: Get from lookup result

    return (
        <div
            ref={popoverRef}
            className="fixed z-50 transition-opacity duration-200"
            style={{
                left: adjustedPos.x,
                top: adjustedPos.y,
                width: POPUP_WIDTH,
                opacity: isPositioned ? 1 : 0,
            }}
        >
            {/* XP Animation */}
            {showXpAnimation && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <span className="px-3 py-1 bg-amber-500 text-black font-bold rounded-full text-sm shadow-lg">
                        +{xpGained} XP
                    </span>
                </div>
            )}

            <div className="relative bg-surface-dark/95 backdrop-blur-xl border border-border-color rounded-2xl shadow-2xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : lookupResult?.found ? (
                    <>
                        {/* Header - Large Character Display */}
                        <div className="p-5 border-b border-border-color bg-surface-highlight/20">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Large Hanzi */}
                                    <div className="text-5xl font-bold text-white font-chinese leading-none">
                                        {word}
                                    </div>

                                    {/* Info Column */}
                                    <div className="flex flex-col gap-1">
                                        <span className="text-primary text-lg font-medium">{lookupResult.pinyinDisplay}</span>

                                        {/* Badges */}
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 ${HSK_COLORS[hskLevel] || 'bg-gray-500'} text-white text-xs font-bold rounded`}>
                                                HSK {hskLevel}
                                            </span>
                                            {lookupResult.partOfSpeech && (
                                                <span className="px-2 py-0.5 bg-surface-highlight text-text-secondary text-xs rounded">
                                                    {lookupResult.partOfSpeech}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Icons */}
                                <div className="flex items-center gap-1">
                                    <SpeakerButton
                                        text={word}
                                        size="sm"
                                        className="p-2 hover:bg-surface-highlight text-text-secondary hover:text-primary rounded-full transition-colors"
                                    />
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || saveSuccess}
                                        className={`inline-flex items-center justify-center p-2 rounded-full transition-all ${saveSuccess
                                            ? 'bg-emerald-500 text-white'
                                            : 'hover:bg-surface-highlight text-text-secondary hover:text-primary'
                                            }`}
                                        title="Lưu từ"
                                    >
                                        {isSaving ? (
                                            <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Icon name={saveSuccess ? "check" : "bookmark_add"} size="sm" />
                                        )}
                                    </button>
                                    {/* Close button */}
                                    <button
                                        onClick={onClose}
                                        className="inline-flex items-center justify-center p-1.5 ml-1 hover:bg-rose-500/20 text-text-secondary hover:text-rose-400 rounded-full transition-colors"
                                        title="Đóng"
                                    >
                                        <Icon name="close" size="sm" />
                                    </button>
                                </div>
                            </div>

                            {/* Vietnamese Meaning - Prominent */}
                            {lookupResult.meaningVi && (
                                <p className="mt-3 text-xl text-white font-medium">
                                    {lookupResult.meaningVi}
                                </p>
                            )}
                        </div>

                        {/* Panel Navigation - Icon Grid */}
                        <div className="grid grid-cols-6 border-b border-border-color">
                            {panels.map(panel => (
                                <button
                                    key={panel.id}
                                    onClick={() => setActivePanel(panel.id)}
                                    className={`flex flex-col items-center justify-center py-3 transition-all ${activePanel === panel.id
                                        ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                        : 'text-text-secondary hover:text-white hover:bg-surface-highlight/50'
                                        }`}
                                    title={panel.label}
                                >
                                    <Icon name={panel.icon} size="sm" />
                                    <span className="text-[10px] mt-1 font-medium">{panel.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Panel Content */}
                        <div className="max-h-[280px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

                            {/* 📚 Dictionary Panel - Premium Multi-Pronunciation UI */}
                            {activePanel === 'dictionary' && (
                                <div className="p-4 space-y-4">
                                    {/* All Pronunciations - Accordion Style */}
                                    {lookupResult?.allEntries && lookupResult.allEntries.length > 1 ? (
                                        <div className="space-y-3">
                                            <h4 className="text-xs text-text-secondary uppercase tracking-wider font-medium flex items-center gap-2">
                                                <Icon name="translate" size="sm" className="text-primary" />
                                                {lookupResult.allEntries.length} cách đọc
                                            </h4>
                                            {lookupResult.allEntries.map((entry, idx) => {
                                                const colors = ['emerald', 'blue', 'violet', 'amber', 'rose'];
                                                const color = colors[idx % colors.length];
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`rounded-xl border transition-all overflow-hidden bg-${color}-500/5 border-${color}-500/20 hover:border-${color}-500/40`}
                                                    >
                                                        {/* Reading Header */}
                                                        <div className={`px-4 py-3 flex items-center gap-3 bg-${color}-500/10`}>
                                                            <span className={`text-2xl font-chinese text-white`}>
                                                                {word}
                                                            </span>
                                                            <div className="flex-1">
                                                                <span className={`text-${color}-400 font-medium`}>
                                                                    {entry.pinyinDisplay}
                                                                </span>
                                                                {entry.partOfSpeech && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-surface-highlight text-text-secondary text-xs rounded">
                                                                        {entry.partOfSpeech}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <SpeakerButton
                                                                text={word}
                                                                size="sm"
                                                                className="p-1.5 hover:bg-surface-highlight rounded-full"
                                                            />
                                                        </div>
                                                        {/* Definitions */}
                                                        <div className="px-4 py-3 space-y-2">
                                                            {(entry.definitionsVi?.length ? entry.definitionsVi : entry.definitions)
                                                                .slice(0, 4)
                                                                .map((def, i) => (
                                                                    <div key={i} className="flex items-start gap-2">
                                                                        <span className={`size-5 rounded-full bg-${color}-500/20 text-${color}-400 text-xs flex items-center justify-center shrink-0 font-bold`}>
                                                                            {i + 1}
                                                                        </span>
                                                                        <span className="text-white/90 text-sm leading-relaxed">{def}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* Single Pronunciation - Original Style */
                                        displayDefinitions.length > 0 && (
                                            <div>
                                                <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2 font-medium">
                                                    Định nghĩa
                                                </h4>
                                                <ul className="space-y-2">
                                                    {displayDefinitions.slice(0, 5).map((def, i) => (
                                                        <li key={i} className="flex items-start gap-3">
                                                            <span className="size-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-bold">
                                                                {i + 1}
                                                            </span>
                                                            <span className="text-white/90 text-sm leading-relaxed">{def}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )
                                    )}

                                    {/* Example Sentences */}
                                    {examples.length > 0 && (
                                        <div className="pt-3 border-t border-border-color">
                                            <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
                                                <Icon name="format_quote" size="sm" className="text-cyan-400" />
                                                Ví dụ câu
                                            </h4>
                                            <div className="space-y-3">
                                                {examples.slice(0, 3).map((ex, i) => (
                                                    <div key={i} className="bg-surface-highlight/30 rounded-xl p-3 group hover:bg-surface-highlight/50 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-white font-chinese">{ex.chinese}</p>
                                                            <SpeakerButton
                                                                text={ex.chinese}
                                                                size="sm"
                                                                className="opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                                                            />
                                                        </div>
                                                        {ex.pinyin && (
                                                            <p className="text-primary/70 text-xs mb-1">{ex.pinyin}</p>
                                                        )}
                                                        <p className="text-text-secondary text-sm italic">"{ex.translation}"</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ✏️ Stroke Practice Panel */}
                            {activePanel === 'stroke' && (
                                <div className="p-4 flex flex-col items-center">
                                    {word.length === 1 ? (
                                        <>
                                            {/* Stroke Canvas */}
                                            <div
                                                ref={strokeContainerRef}
                                                className="bg-surface-highlight/30 rounded-2xl border-2 border-border-color mb-4 relative"
                                                style={{ width: 200, height: 200 }}
                                            />

                                            {/* Quiz Result */}
                                            {quizResult !== 'idle' && (
                                                <div className={`mb-3 px-4 py-2 rounded-full text-sm font-bold ${quizResult === 'correct'
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-amber-500/20 text-amber-400'
                                                    }`}>
                                                    {quizResult === 'correct' ? '✓ Tuyệt vời! Bạn viết rất chuẩn!' : '⭐ Cố gắng tốt lắm! Luyện thêm nhé!'}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={animateStrokes}
                                                    className="flex items-center gap-2 px-4 py-2 bg-surface-highlight text-white rounded-xl hover:bg-surface-highlight/80 transition-colors text-sm font-medium"
                                                >
                                                    <Icon name="play_arrow" size="sm" />
                                                    Xem nét
                                                </button>
                                                <button
                                                    onClick={startQuiz}
                                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl hover:bg-primary-hover transition-colors text-sm font-bold"
                                                >
                                                    <Icon name="edit" size="sm" />
                                                    Tự viết
                                                </button>
                                            </div>

                                            {enrichedData?.strokeData && (
                                                <p className="text-text-secondary text-xs mt-3">
                                                    {enrichedData.strokeData.strokes.length} nét · Viết từ trên xuống, trái sang phải
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-8 text-text-secondary">
                                            <Icon name="gesture" className="text-4xl mb-2 opacity-50" />
                                            <p className="text-sm">Chọn từng ký tự để luyện viết</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 🤖 AI Tutor Panel */}
                            {activePanel === 'tutor' && (
                                <div className="p-4">
                                    {isEnrichLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : enrichedData?.mnemonic ? (
                                        <div className="space-y-4">
                                            {/* Visual Story */}
                                            <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                                                <div className="flex items-start gap-3">
                                                    <div className="size-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                                        <Icon name="lightbulb" className="text-amber-400" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-amber-400 font-bold text-sm mb-1">Cách nhớ</h4>
                                                        <p className="text-white/90 text-sm leading-relaxed">
                                                            {enrichedData.mnemonic.visualStory}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Character Breakdown */}
                                            {enrichedData.mnemonic.characterBreakdown && (
                                                <div className="bg-surface-highlight/50 rounded-xl p-4">
                                                    <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2 font-medium">
                                                        Cấu tạo chữ
                                                    </h4>
                                                    <p className="text-white text-lg font-chinese">
                                                        {enrichedData.mnemonic.characterBreakdown}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-text-secondary">
                                            <Icon name="psychology" className="text-4xl mb-2 opacity-50" />
                                            <p className="text-sm">Đang tạo gợi ý nhớ...</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 🔗 Related Words Panel */}
                            {activePanel === 'related' && (
                                <div className="p-4 space-y-4">
                                    {isEnrichLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <>
                                            {/* Decomposition */}
                                            {enrichedData?.decomposition?.radical?.meaning && (
                                                <div className="bg-surface-highlight/50 rounded-xl p-4">
                                                    <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2 font-medium">
                                                        Bộ thủ
                                                    </h4>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-3xl font-chinese text-white">
                                                            {enrichedData.decomposition.radical.char}
                                                        </span>
                                                        <div>
                                                            <p className="text-white font-medium">
                                                                {enrichedData.decomposition.radical.meaning}
                                                            </p>
                                                            {enrichedData.decomposition.radical.pinyin && (
                                                                <p className="text-primary text-sm">
                                                                    {enrichedData.decomposition.radical.pinyin}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Synonyms & Antonyms */}
                                            {enrichedData?.relatedWords && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {enrichedData.relatedWords.synonyms?.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                                                <span className="text-emerald-400">≈</span> Đồng nghĩa
                                                            </h4>
                                                            <div className="space-y-1">
                                                                {enrichedData.relatedWords.synonyms.slice(0, 3).map((w, i) => (
                                                                    <div key={i} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                                        <span className="text-white font-chinese text-sm">{w.hanzi}</span>
                                                                        <span className="text-emerald-400/70 text-xs ml-2">{w.meaning}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {enrichedData.relatedWords.antonyms?.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                                                <span className="text-rose-400">≠</span> Trái nghĩa
                                                            </h4>
                                                            <div className="space-y-1">
                                                                {enrichedData.relatedWords.antonyms.slice(0, 3).map((w, i) => (
                                                                    <div key={i} className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                                                        <span className="text-white font-chinese text-sm">{w.hanzi}</span>
                                                                        <span className="text-rose-400/70 text-xs ml-2">{w.meaning}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Collocations */}
                                            {(enrichedData?.relatedWords?.collocations?.length ?? 0) > 0 && (
                                                <div>
                                                    <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2">
                                                        🔥 Cụm từ phổ biến
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {enrichedData?.relatedWords?.collocations?.map((w, i) => (
                                                            <span key={i} className="px-3 py-1.5 bg-surface-highlight rounded-full text-sm">
                                                                <span className="text-white font-chinese">{w.hanzi}</span>
                                                                <span className="text-text-secondary text-xs ml-1">({w.meaning})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* 📝 Flashcard Panel */}
                            {activePanel === 'flashcard' && (
                                <div className="p-4 space-y-4">
                                    {/* Preview Card */}
                                    <div className="bg-surface-highlight/50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-chinese text-white mb-2">{word}</p>
                                        <p className="text-primary text-sm">{lookupResult.pinyinDisplay}</p>
                                        <hr className="my-3 border-border-color" />
                                        <p className="text-white">{lookupResult.meaningVi || lookupResult.meaningEn}</p>
                                    </div>

                                    {/* Folder Selection */}
                                    {folders.length > 0 && (
                                        <div>
                                            <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2">
                                                Chọn thư mục
                                            </h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => setSelectedFolderId(null)}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${!selectedFolderId
                                                        ? 'bg-primary/20 text-primary border border-primary'
                                                        : 'bg-surface-highlight text-text-secondary hover:text-white'
                                                        }`}
                                                >
                                                    <Icon name="folder" size="sm" />
                                                    Mặc định
                                                </button>
                                                {folders.slice(0, 3).map(folder => (
                                                    <button
                                                        key={folder.id}
                                                        onClick={() => setSelectedFolderId(folder.id)}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selectedFolderId === folder.id
                                                            ? 'bg-primary/20 text-primary border border-primary'
                                                            : 'bg-surface-highlight text-text-secondary hover:text-white'
                                                            }`}
                                                    >
                                                        <Icon name={folder.icon || 'folder'} size="sm" />
                                                        <span className="truncate">{folder.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Save Button */}
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || saveSuccess}
                                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${saveSuccess
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-primary text-black hover:bg-primary-hover'
                                            }`}
                                    >
                                        {isSaving ? (
                                            <div className="size-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                        ) : saveSuccess ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <Icon name="check_circle" size="sm" />
                                                    Đã lưu!
                                                </div>
                                                {savedInFolder && (
                                                    <span className="text-xs opacity-80 flex items-center gap-1">
                                                        <Icon name="folder" size="sm" />
                                                        {savedInFolder}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <Icon name="add" size="sm" />
                                                Lưu flashcard (+10 XP)
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* 📖 History Panel */}
                            {activePanel === 'history' && (
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs text-text-secondary uppercase tracking-wider font-medium flex items-center gap-2">
                                            <Icon name="history" size="sm" className="text-primary" />
                                            Từ đã tra gần đây
                                        </h4>
                                        <span className="text-xs text-text-secondary">{lookupHistory.length} từ</span>
                                    </div>
                                    {lookupHistory.length > 0 ? (
                                        <div className="space-y-2 max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                            {lookupHistory.slice(0, 20).map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        // Could trigger lookup of this word
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 bg-surface-highlight/40 hover:bg-surface-highlight rounded-xl transition-colors text-left group"
                                                >
                                                    <span className="text-2xl font-chinese text-white">{item.word}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-primary text-sm">{item.pinyin}</p>
                                                        <p className="text-text-secondary text-xs truncate">{item.meaning}</p>
                                                    </div>
                                                    <span className="text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {new Date(item.timestamp).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-text-secondary">
                                            <Icon name="search" className="text-3xl mb-2 opacity-50" />
                                            <p className="text-sm">Chưa có lịch sử tra từ</p>
                                            <p className="text-xs opacity-70">Từ bạn tra sẽ hiển thị ở đây</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-12 px-4">
                        <Icon name="search_off" className="text-4xl text-text-secondary mb-3" />
                        <p className="text-text-secondary">Không tìm thấy từ trong từ điển</p>
                    </div>
                )}
            </div>

            {/* Arrow pointing down */}
            <div
                className="absolute"
                style={{
                    left: Math.max(24, Math.min(POPUP_WIDTH - 24, arrowLeft)),
                    transform: 'translateX(-50%)',
                    bottom: -ARROW_HEIGHT,
                }}
            >
                <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-l-transparent border-r-transparent border-t-[10px] border-t-surface-dark" />
            </div>
        </div>
    );
}

export default WordPopover;
