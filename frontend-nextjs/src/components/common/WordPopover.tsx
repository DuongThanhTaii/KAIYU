"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "./index";
import SpeakerButton from "./SpeakerButton";
import { dictionaryApi, type LookupResult, type ExampleSentence, type EnrichedWordData } from "@/services/dictionaryApi";
import { vocabularyFoldersApi, type VocabularyFolder } from "@/services/vocabularyFoldersApi";
import { userVocabularyApi } from "@/services/userVocabularyApi";
import { useAuth } from "@/contexts/AuthContext";
import { videoApi, type Subtitle, type SubtitleToken } from "@/services/videoApi";
import * as adminApi from "@/services/adminApi";
import { Button } from "./index";
import { renderGroupedPinyin, renderFormattedMeaning, highlightWord } from "@/utils/chinese";


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
import { HSK_COLORS, POS_COLORS } from "@/constants/vocabulary";


interface WordPopoverProps {
    word: string;
    position: { x: number; y: number };
    onClose: () => void;
    sourceVideoId?: string;
    sourceTimestamp?: number;
    sourceSentence?: string;
    sourcePinyin?: string;
    videoUrl?: string;
    onSubtitlesUpdated?: () => void;
    currentSubtitleTokens?: { hanzi: string; pinyin?: string; meaning?: string }[];
    sourceSubtitle?: any;
}

type PanelType = 'dictionary' | 'related' | 'flashcard' | 'history' | 'admin_edit';

export function WordPopover({
    word,
    position,
    onClose,
    sourceVideoId,
    sourceTimestamp,
    sourceSentence,
    sourcePinyin,
    videoUrl,
    onSubtitlesUpdated,
    currentSubtitleTokens,
    sourceSubtitle
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
    
    // New Flashcard states
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [note, setNote] = useState("");
    
    // Admin state
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [subtitle, setSubtitle] = useState<Subtitle | null>(null);
    const [isUpdatingSubtitle, setIsUpdatingSubtitle] = useState(false);
    const [adminSubTab, setAdminSubTab] = useState<'word' | 'segment'>('word');
    const [editingTokens, setEditingTokens] = useState<any[]>([]);
    const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
    
    // Form states for global word edit
    const [editHanzi, setEditHanzi] = useState(word);
    const [editPinyin, setEditPinyin] = useState('');
    const [editMeaning, setEditMeaning] = useState('');
    const [editPos, setEditPos] = useState('');
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);

    // "Not found" admin search/create states
    const [notFoundMode, setNotFoundMode] = useState<'info' | 'search' | 'create'>('info');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<LookupResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [newWordPinyin, setNewWordPinyin] = useState('');
    const [newWordMeaning, setNewWordMeaning] = useState('');
    const [newWordPos, setNewWordPos] = useState('');
    const [newWordHsk, setNewWordHsk] = useState(1);
    const [isCreatingWord, setIsCreatingWord] = useState(false);
    const [createSuccess, setCreateSuccess] = useState(false);

    // History state
    const [lookupHistory, setLookupHistory] = useState<{ word: string; pinyin: string; meaning: string; timestamp: number }[]>([]);


    // Refs
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popupHeight, setPopupHeight] = useState(0);
    const [isPositioned, setIsPositioned] = useState(false);

    // Popup configuration
    const POPUP_WIDTH = 460;
    const ARROW_HEIGHT = 10;
    const GAP = 8;

    // Panel definitions
    const panels: { id: PanelType; icon: string; label: string }[] = [
        { id: 'dictionary', icon: 'menu_book', label: 'Từ điển' },
        { id: 'related', icon: 'hub', label: 'Cận nghĩa/Trái nghĩa' },
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

    // Calculate position - popup appears ABOVE the character by default
    const getAdjustedPosition = () => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        if (isMobile) return { x: 0, y: 0, width: 0, isBelow: false }; // Handled by CSS on mobile

        const padding = 20; 
        const currentPopupWidth = POPUP_WIDTH;
        const actualHeight = popupHeight || 400;
        
        let y = position.y - actualHeight - ARROW_HEIGHT - GAP;
        let isBelow = false;

        if (y < padding) {
            const textHeight = 40; 
            y = position.y + textHeight + GAP;
            isBelow = true;
        }
        
        if (y + actualHeight > window.innerHeight - padding) {
            if (isBelow) {
                 y = Math.max(padding, window.innerHeight - actualHeight - padding);
            }
        }

        let x = position.x - currentPopupWidth / 2;
        if (x < padding) x = padding;
        if (x + currentPopupWidth > window.innerWidth - padding) {
            x = window.innerWidth - currentPopupWidth - padding;
        }
        return { x, y, width: currentPopupWidth, isBelow };
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

    // Sync subtitle from props
    useEffect(() => {
        if (sourceSubtitle) {
            setSubtitle(sourceSubtitle);
        } else if (sourceVideoId) {
            videoApi.getSubtitles(sourceVideoId).then(subs => {
                const sub = subs.find(s => 
                    Number(s.startTime) <= (sourceTimestamp || 0) && 
                    Number(s.endTime) >= (sourceTimestamp || 0)
                );
                if (sub) setSubtitle(sub);
            });
        }
    }, [sourceSubtitle, sourceVideoId, sourceTimestamp]);

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
                    setEditPinyin(result.pinyin || '');
                    setEditMeaning(result.meaningVi || result.meaningEn || '');
                    setEditPos(result.partOfSpeech || '');
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
    }, [word, sourcePinyin, sourceVideoId, sourceTimestamp]);

    // Fetch enriched data when switching to panels that need it
    useEffect(() => {
        const needsEnrich = ['related'].includes(activePanel);
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

    useEffect(() => {
        // Reset editing tokens if subtitle changes to allow regeneration
        setEditingTokens([]);
    }, [subtitle?.id]);

    useEffect(() => {
        // Prepare tokens for segmentation tab
        if (activePanel === 'admin_edit' && adminSubTab === 'segment' && subtitle && editingTokens.length === 0) {
            if (subtitle.tokens && subtitle.tokens.length > 0) {
                setEditingTokens(subtitle.tokens.map(t => ({ ...t })));
            } else {
                // Fallback to Intl.Segmenter initial guess
                const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter 
                    ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
                    : null;
                const segments = segmenter
                    ? Array.from(segmenter.segment(subtitle.hanzi || ''))
                    : (subtitle.hanzi || '').split('').map(c => ({ segment: c }));
                
                setEditingTokens(segments.filter(s => s.segment.trim()).map((s, i) => ({
                    hanzi: s.segment,
                    pinyin: '',
                    meaning: '',
                    position: i
                })));
            }
        }
    }, [activePanel, adminSubTab, subtitle, editingTokens.length]);


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
                sourceMeaning: subtitle?.meaningVi || undefined,
                sourceTokens: subtitle?.tokens || undefined,
                note: note.trim() || undefined,
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

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        setIsCreatingFolder(true);
        try {
            const newFolder = await vocabularyFoldersApi.create({
                name: newFolderName.trim(),
            });
            setFolders(prev => [newFolder, ...prev]);
            setSelectedFolderId(newFolder.id);
            setNewFolderName("");
            setShowNewFolderInput(false);
            triggerXp(5); // Small bonus for organizing
        } catch (error) {
            console.error("Failed to create folder:", error);
        } finally {
            setIsCreatingFolder(false);
        }
    };

    const displayDefinitions = lookupResult?.definitionsVi?.length
        ? lookupResult.definitionsVi
        : lookupResult?.definitions || [];

    // Save Global Dictionary Changes
    const handleSaveGlobal = async () => {
        setIsSavingGlobal(true);
        try {
            if (lookupResult?.found && lookupResult.id) {
                // Update existing word
                await adminApi.updateVocabulary(lookupResult.id, {
                    hanzi: editHanzi,
                    pinyin: editPinyin,
                    meaningVi: editMeaning,
                    partOfSpeech: editPos,
                });
            } else {
                // Create new word
                await adminApi.createVocabulary({
                    hanzi: editHanzi,
                    pinyin: editPinyin,
                    meaningVi: editMeaning,
                    partOfSpeech: editPos,
                    hskLevel: 1, // Default or add a field
                });
                // Clear cache so we can re-lookup
                await dictionaryApi.clearCache();
            }
            
            // Re-lookup to get fresh data (especially if newly created)
            const freshResult = await dictionaryApi.lookup(word, sourcePinyin);
            setLookupResult(freshResult);
            if (freshResult.found) {
                setEditPinyin(freshResult.pinyin || '');
                setEditMeaning(freshResult.meaningVi || freshResult.meaningEn || '');
                setEditPos(freshResult.partOfSpeech || '');
                // Also update history if needed
            }
            
            triggerXp(50); // Admin bonus
        } catch (error) {
            console.error("Failed to save global changes:", error);
        } finally {
            setIsSavingGlobal(false);
        }
    };

    // Subtitle Re-segmentation Logic
    const handleSplitToken = (index: number) => {
        const token = editingTokens[index];
        if (token.hanzi.length <= 1) return;
        
        const newTokens = [...editingTokens];
        const chars = Array.from(token.hanzi);
        const splitTokens = chars.map((char, i) => ({
            hanzi: char,
            pinyin: '', // Will fetch/guess later
            meaning: '',
            position: 0 // Will re-index
        }));
        
        newTokens.splice(index, 1, ...splitTokens);
        newTokens.forEach((t, i) => t.position = i);
        setEditingTokens(newTokens);
    };

    const handleMergeTokens = (index: number) => {
        if (index >= editingTokens.length - 1) return;
        
        const newTokens = [...editingTokens];
        const t1 = newTokens[index];
        const t2 = newTokens[index + 1];
        
        const mergedToken = {
            hanzi: t1.hanzi + t2.hanzi,
            pinyin: (t1.pinyin + ' ' + t2.pinyin).trim(),
            meaning: '',
            position: 0 // Will re-index
        };
        
        newTokens.splice(index, 2, mergedToken);
        newTokens.forEach((t, i) => t.position = i);
        setEditingTokens(newTokens);
    };

    const handleSaveSubtitle = async () => {
        if (!subtitle) return;
        setIsUpdatingSubtitle(true);
        try {
            await videoApi.updateSubtitle(subtitle.id, {
                tokens: editingTokens
            });
            setSaveSuccess(true);
            triggerXp(100);
            // Auto-reload subtitles in parent
            onSubtitlesUpdated?.();
        } catch (error) {
            console.error("Failed to update subtitle:", error);
        } finally {
            setIsUpdatingSubtitle(false);
        }
    };

    // Admin: search existing words in DB
    const handleSearchWord = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length === 0) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const results = await dictionaryApi.search(query, 8);
            setSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Admin: link an existing word → re-trigger lookup
    const handleLinkWord = async (result: LookupResult) => {
        setLookupResult(result);
        setEditPinyin(result.pinyin || '');
        setEditMeaning(result.meaningVi || result.meaningEn || '');
        setEditPos(result.partOfSpeech || '');
        setNotFoundMode('info');
        setSearchResults([]);
        setSearchQuery('');
    };

    // Admin: create a brand new word in DB
    const handleCreateNewWord = async () => {
        if (!newWordPinyin.trim() || !newWordMeaning.trim()) return;
        setIsCreatingWord(true);
        try {
            await adminApi.createVocabulary({
                hanzi: word,
                pinyin: newWordPinyin.trim(),
                meaningVi: newWordMeaning.trim(),
                partOfSpeech: newWordPos.trim() || undefined,
                hskLevel: newWordHsk,
            });
            setCreateSuccess(true);
            triggerXp(50);
            // Clear dictionary cache for this word and re-lookup
            await dictionaryApi.clearCache();
            const freshResult = await dictionaryApi.lookup(word, sourcePinyin);
            setLookupResult(freshResult);
            if (freshResult.found) {
                setEditPinyin(freshResult.pinyin || '');
                setEditMeaning(freshResult.meaningVi || freshResult.meaningEn || '');
                setEditPos(freshResult.partOfSpeech || '');
            }
        } catch (error) {
            console.error('Failed to create word:', error);
        } finally {
            setIsCreatingWord(false);
        }
    };

    // Find matching token from current subtitle for "not found" fallback
    const matchingToken = currentSubtitleTokens?.find(t => t.hanzi === word);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    return (
        <>
            {/* Mobile Overlay */}
            {isMobile && isPositioned && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-in fade-in duration-300" 
                    onClick={onClose}
                />
            )}
            
            <div
                ref={popoverRef}
                className={`flex flex-col z-[70] transition-all duration-300 ease-out ${
                    isMobile 
                        ? `fixed bottom-0 left-0 right-0 bg-background-dark rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transform translate-y-0 max-h-[85vh] ${isPositioned ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`
                        : 'fixed opacity-100'
                }`}
                style={!isMobile ? {
                    left: adjustedPos.x,
                    top: adjustedPos.y,
                    width: adjustedPos.width,
                    opacity: isPositioned ? 1 : 0,
                } : {}}
            >
                {/* Mobile Handle */}
                {isMobile && (
                    <div className="w-full flex justify-center py-3">
                        <div className="w-12 h-1.5 bg-text-secondary/20 rounded-full" />
                    </div>
                )}
            {/* XP Animation */}
            {showXpAnimation && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <span className="px-3 py-1 bg-amber-500 text-black font-bold rounded-full text-sm shadow-lg">
                        +{xpGained} XP
                    </span>
                </div>
            )}

            <div className="relative bg-[var(--color-surface-dark)]/95 backdrop-blur-xl border border-border-color rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : lookupResult?.found ? (
                    <>
                        {/* Bento-style Header Section */}
                        <div className="p-5 border-b border-border-color bg-surface-highlight/10">
                            {/* AI Warning Banner - Integrated into Bento flow */}
                            {lookupResult.source === 'ai' && !lookupResult.isSystemWord && (
                                <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <Icon name="smart_toy" className="text-amber-400" size="sm" />
                                    <span className="text-amber-300 text-xs font-semibold tracking-wide uppercase">
                                        Dictionary Match Not Found (AI Assisted)
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                {/* Top Bento Row: Hanzi + Actions */}
                                <div className="flex items-start justify-between gap-6">
                                    <div className="min-w-0 flex-1">
                                        {/* Large Hanzi */}
                                        <h2 className={`font-bold text-text-base font-chinese leading-[1.1] whitespace-nowrap overflow-hidden text-ellipsis ${word.length > 4 ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl'}`} lang="zh-CN">
                                            {word}
                                        </h2>
                                        
                                        {/* Pinyin directly below for better vertical flow */}
                                        <div className="text-primary text-xl font-semibold font-pinyin tracking-tight mt-1 opacity-90">
                                            {lookupResult.pinyinDisplay}
                                        </div>
                                    </div>

                                    {/* Action Bento Box - Right Aligned */}
                                    <div className="flex items-center bg-[var(--color-surface-dark)]/50 border border-border-color/30 rounded-2xl p-1 shrink-0 backdrop-blur-md">
                                        <SpeakerButton text={word} size="sm" />
                                        
                                        {isAdmin && (
                                            <button
                                                onClick={() => setActivePanel('admin_edit')}
                                                className={`inline-flex items-center justify-center p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activePanel === 'admin_edit'
                                                    ? 'bg-amber-500/20 text-amber-500'
                                                    : 'text-text-secondary hover:text-amber-400 hover:bg-amber-500/10'
                                                    }`}
                                                title="Chỉnh sửa (Admin)"
                                            >
                                                <Icon name="edit" size="sm" />
                                            </button>
                                        )}

                                        {lookupResult.isSystemWord && (
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving || saveSuccess}
                                                className={`inline-flex items-center justify-center p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${saveSuccess
                                                    ? 'bg-emerald-500 text-text-base shadow-lg shadow-emerald-500/20'
                                                    : 'hover:bg-primary/10 text-text-secondary hover:text-primary'
                                                    }`}
                                                title="Lưu từ"
                                            >
                                                {isSaving ? (
                                                    <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Icon name={saveSuccess ? "check" : "bookmark_add"} size="sm" />
                                                )}
                                            </button>
                                        )}
                                        
                                        <div className="w-px h-6 bg-border-color/30 mx-1" />
                                        
                                        <button
                                            onClick={onClose}
                                            className="inline-flex items-center justify-center p-2 hover:bg-rose-500/20 text-text-secondary hover:text-rose-400 rounded-full transition-all hover:scale-110 active:scale-95"
                                            title="Đóng"
                                        >
                                            <Icon name="close" size="sm" />
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom Bento Row: Badges and Quick Info */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {lookupResult.isSystemWord && lookupResult.hskLevel ? (
                                        <div className={`px-3 py-1 ${HSK_COLORS[lookupResult.hskLevel] || 'bg-gray-500'} bg-opacity-20 text-text-base text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm`}>
                                            <span className="opacity-70 text-[8px] font-bold">LEVEL</span>
                                            HSK {lookupResult.hskLevel}
                                        </div>
                                    ) : null}
                                    
                                    {lookupResult.partOfSpeech && (
                                        <div className="px-3 py-1 bg-surface-highlight border border-border-color/50 text-text-secondary text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1.5">
                                            <Icon name="category" size="sm" className="opacity-50" />
                                            {lookupResult.partOfSpeech}
                                        </div>
                                    )}
                                    
                                    {lookupResult.source === 'ai' && (
                                        <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                            <Icon name="auto_awesome" size="sm" /> AI
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Scrollable Body: Everything else */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Vietnamese Meaning - Integrated as a clean bottom Bento block */}
                            {lookupResult.meaningVi && (
                                <div className="px-5 py-3 bg-surface-highlight/5 border-b border-border-color/30 animate-in fade-in slide-in-from-bottom-2 duration-300" lang="vi">
                                    <div className="space-y-2">
                                        {lookupResult.meaningVi.includes('1.') ? (
                                            lookupResult.meaningVi.split(/(?=\d+\.)/).map((part, i) => (
                                                <div key={i} className="text-lg font-medium leading-relaxed group transition-colors hover:text-primary">
                                                    {renderFormattedMeaning(part)}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xl text-text-base font-semibold leading-snug tracking-tight">
                                                {lookupResult.meaningVi}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Panel Navigation - Sticky Header */}
                            <div className="sticky top-0 z-10 bg-[var(--color-surface-dark)]/95 backdrop-blur-md border-b border-border-color grid grid-cols-4 shadow-md">
                                {panels.map(panel => (
                                    <button
                                        key={panel.id}
                                        onClick={() => setActivePanel(panel.id)}
                                        className={`flex flex-col items-center justify-center py-3 transition-all ${activePanel === panel.id
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-secondary hover:text-text-base hover:bg-surface-highlight/50'
                                            }`}
                                        title={panel.label}
                                    >
                                        <Icon name={panel.icon} size="sm" />
                                        <span className="text-[10px] mt-1 font-medium">{panel.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Panel Content - No separate scrollbar anymore */}
                            <div className="p-0">

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
                                                            <span className={`text-2xl font-chinese text-text-base`} lang="zh-CN">
                                                                {word}
                                                            </span>
                                                            <div className="flex-1">
                                                                <span className={`text-${color}-400 font-medium font-pinyin tracking-tight`}>
                                                                    {entry.pinyinDisplay}
                                                                </span>
                                                                {entry.partOfSpeech && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-surface-highlight text-text-secondary text-xs rounded-full">
                                                                        {entry.partOfSpeech}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <SpeakerButton
                                                                text={word}
                                                                size="sm"
                                                            />
                                                        </div>
                                                        {/* Definitions */}
                                                        <div className="px-4 py-3 space-y-2">
                                                            {(entry.definitionsVi?.length ? entry.definitionsVi : entry.definitions || [])
                                                                .slice(0, 4)
                                                                .map((def, i) => (
                                                                    <div key={i} className="flex items-start gap-2">
                                                                        <span className={`size-5 rounded-full bg-${color}-500/20 text-${color}-400 text-xs flex items-center justify-center shrink-0 font-bold`}>
                                                                            {i + 1}
                                                                        </span>
                                                                        <span className="text-text-base/90 text-sm leading-relaxed">
                                                                            {renderFormattedMeaning(def)}
                                                                        </span>
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
                                                            <span className="text-text-base/90 text-sm leading-relaxed">{def}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )
                                    )}

                                    {/* Example Sentences - Multi-section logic */}
                                    {examples.length > 0 && (
                                        <div className="pt-3 border-t border-border-color space-y-4">
                                            {examples.slice(0, 3).map((ex, i) => (
                                                <div key={i} className="flex flex-col gap-2 p-4 bg-surface-highlight/20 border border-border-color/30 rounded-2xl group hover:bg-surface-highlight/40 transition-all">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest opacity-80">Ví dụ {i + 1}</span>
                                                        <SpeakerButton
                                                            text={ex.chinese}
                                                            size="sm"
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-text-base font-chinese text-lg leading-snug" lang="zh-CN">
                                                            {highlightWord(ex.chinese, word)}
                                                        </p>
                                                        {ex.pinyin && (
                                                            <p className="text-primary/70 text-xs font-pinyin tracking-tight">
                                                                {highlightWord(ex.pinyin, lookupResult?.pinyinDisplay || '')}
                                                            </p>
                                                        )}
                                                        <p className="text-text-secondary text-sm italic leading-relaxed mt-1">
                                                            {ex.translation}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
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
                                                        <span className="text-3xl font-chinese text-text-base" lang="zh-CN">
                                                            {enrichedData.decomposition.radical.char}
                                                        </span>
                                                        <div>
                                                            <p className="text-text-base font-medium">
                                                                {enrichedData.decomposition.radical.meaning}
                                                            </p>
                                                            {enrichedData.decomposition.radical.pinyin && (
                                                                <p className="text-primary text-sm font-pinyin tracking-tight">
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
                                                            <h4 className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1 text-emerald-400/80">
                                                                <span>≈</span> Đồng nghĩa
                                                            </h4>
                                                            <div className="flex flex-col gap-1.5">
                                                                {enrichedData.relatedWords.synonyms.slice(0, 4).map((w, i) => (
                                                                    <div key={i} className="px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl group hover:bg-emerald-500/10 transition-colors">
                                                                        <div className="flex items-baseline justify-between gap-2">
                                                                            <span className="text-emerald-400 font-chinese text-sm font-bold whitespace-nowrap" lang="zh-CN">{w.hanzi}</span>
                                                                            <span className="text-emerald-400/60 text-[10px] truncate uppercase font-bold tracking-tighter">{w.meaning}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {enrichedData.relatedWords.antonyms?.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1 text-rose-400/80">
                                                                <span>≠</span> Trái nghĩa
                                                            </h4>
                                                            <div className="flex flex-col gap-1.5">
                                                                {enrichedData.relatedWords.antonyms.slice(0, 4).map((w, i) => (
                                                                    <div key={i} className="px-3 py-2 bg-rose-500/5 border border-rose-500/20 rounded-xl group hover:bg-rose-500/10 transition-colors">
                                                                        <div className="flex items-baseline justify-between gap-2">
                                                                            <span className="text-rose-400 font-chinese text-sm font-bold whitespace-nowrap" lang="zh-CN">{w.hanzi}</span>
                                                                            <span className="text-rose-400/60 text-[10px] truncate uppercase font-bold tracking-tighter">{w.meaning}</span>
                                                                        </div>
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
                                                            <div key={i} className="px-3 py-1.5 bg-surface-highlight border border-border-color/30 rounded-xl flex items-center gap-2">
                                                                <span className="text-text-base font-chinese whitespace-nowrap" lang="zh-CN">{w.hanzi}</span>
                                                                <span className="text-text-secondary text-[10px] font-medium leading-none">({w.meaning})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* 🎴 Flashcard Panel - Optimized for "Sentence Mining" */}
                            {activePanel === 'flashcard' && (
                                <div className="p-4 space-y-5">
                                    {/* Sentence Mining Context Card */}
                                    {sourceSentence ? (
                                        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center gap-2 text-[10px] text-primary font-black uppercase tracking-widest">
                                                
                                                Học trong ngữ cảnh 
                                            </div>
                                            <p className="text-text-base font-chinese text-base leading-relaxed" lang="zh-CN">
                                                {highlightWord(sourceSentence, word)}
                                            </p>
                                            {sourcePinyin && (
                                                <p className="text-text-secondary text-xs font-pinyin tracking-tight opacity-70 italic line-clamp-1">{sourcePinyin}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-surface-highlight/30 rounded-2xl p-4 border border-border-color/30 text-center">
                                            <p className="text-text-secondary text-xs italic">Không có câu mẫu từ video</p>
                                        </div>
                                    )}

                                    {/* Personal Note Field */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-text-secondary uppercase tracking-widest font-black flex items-center gap-2">
                                            <Icon name="sticky_note_2" size="sm" /> Ghi chú cá nhân
                                        </label>
                                        <textarea
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                            placeholder="Ghi lại mẹo ghi nhớ hoặc ví dụ của bạn..."
                                            rows={2}
                                            className="w-full bg-[var(--color-surface-dark)]/50 border border-border-color/50 rounded-xl px-3 py-2 text-sm text-text-base focus:outline-none focus:border-primary transition-colors resize-none"
                                        />
                                    </div>

                                    {/* Folder Selection & Creation Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] text-text-secondary uppercase tracking-widest font-black">Chọn thư mục</h4>
                                            <button 
                                                onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                                                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${showNewFolderInput ? 'text-rose-400 bg-rose-400/10' : 'text-primary bg-primary/10 hover:bg-primary/20'}`}
                                            >
                                                {showNewFolderInput ? 'Hủy' : '+ Tạo mới'}
                                            </button>
                                        </div>
                                        
                                        {showNewFolderInput && (
                                            <div className="flex gap-2 animate-in slide-in-from-right-2 duration-300">
                                                <input
                                                    value={newFolderName}
                                                    onChange={e => setNewFolderName(e.target.value)}
                                                    placeholder="Tên thư mục mới..."
                                                    className="flex-1 bg-[var(--color-surface-dark)] border border-primary/50 rounded-xl px-3 py-2 text-sm text-text-base focus:outline-none focus:border-primary"
                                                    autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                                />
                                                <button
                                                    onClick={handleCreateFolder}
                                                    disabled={!newFolderName.trim() || isCreatingFolder}
                                                    className="bg-primary text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary-light disabled:opacity-50 transition-all flex items-center"
                                                >
                                                    {isCreatingFolder ? <div className="size-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Tạo'}
                                                </button>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar-thin pr-1">
                                            {folders.map(folder => (
                                                <button
                                                    key={folder.id}
                                                    onClick={() => setSelectedFolderId(folder.id)}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-95 text-left ${
                                                        selectedFolderId === folder.id
                                                            ? 'bg-primary/20 border-primary text-primary'
                                                            : 'bg-surface-highlight/40 border-border-color/30 text-text-secondary hover:border-primary/50'
                                                    }`}
                                                >
                                                    <Icon name="folder" size="sm" className={selectedFolderId === folder.id ? 'text-primary' : 'text-text-secondary/50'} />
                                                    <span className="text-xs font-semibold truncate flex-1">{folder.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="pt-2">
                                        <Button
                                            variant="primary"
                                            className={`w-full py-4 text-base rounded-2xl shadow-xl transition-all ${
                                                saveSuccess 
                                                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' 
                                                    : 'shadow-primary/20'
                                            }`}
                                            onClick={handleSave}
                                            isLoading={isSaving}
                                            disabled={isSaving || saveSuccess}
                                        >
                                            {saveSuccess ? (
                                                <div className="flex items-center justify-center gap-3">
                                                    <Icon name="check_circle" className="animate-in zoom-in-50" />
                                                    <span className="font-bold">Đã lưu flashcard</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-3">
                                                    
                                                    <span className="font-bold">Lưu vào bộ nhớ <span className="text-black/60 opacity-80">(+10 XP)</span></span>
                                                </div>
                                            )}
                                        </Button>
                                    </div>

                                    {saveSuccess && savedInFolder && (
                                        <p className="text-center text-[10px] text-emerald-400 font-bold uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
                                            Đã học thêm được 1 từ tại: {savedInFolder}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* 🛠️ Admin Edit Panel */}
                            {activePanel === 'admin_edit' && isAdmin && (
                                <div className="p-4 space-y-4">
                                    {/* Sub-tabs */}
                                    <div className="flex bg-surface-highlight/30 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setAdminSubTab('word')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${adminSubTab === 'word' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-base'}`}
                                        >
                                            Từ vựng (Global)
                                        </button>
                                        <button 
                                            onClick={() => setAdminSubTab('segment')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${adminSubTab === 'segment' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-base'}`}
                                        >
                                            Phân đoạn (Video)
                                        </button>
                                    </div>

                                    {adminSubTab === 'word' ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Hanzi</label>
                                                    <input 
                                                        value={editHanzi} 
                                                        onChange={e => setEditHanzi(e.target.value)}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-text-base focus:outline-none focus:border-primary font-chinese"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Pinyin</label>
                                                    <input 
                                                        value={editPinyin} 
                                                        onChange={e => setEditPinyin(e.target.value)}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-primary focus:outline-none focus:border-primary font-pinyin"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Loại từ (POS)</label>
                                                    <input 
                                                        value={editPos} 
                                                        onChange={e => setEditPos(e.target.value)}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-blue-400 focus:outline-none focus:border-primary"
                                                        placeholder="e.g. Danh từ, Động từ..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Nghĩa tiếng Việt</label>
                                                    <textarea 
                                                        value={editMeaning} 
                                                        onChange={e => setEditMeaning(e.target.value)}
                                                        rows={3}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-text-base text-sm focus:outline-none focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                            <Button 
                                                variant="primary" 
                                                className="w-full py-3" 
                                                onClick={handleSaveGlobal}
                                                isLoading={isSavingGlobal}
                                            >
                                                Lưu vào Từ điển Global
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1">
                                            <div className="bg-surface-highlight/20 p-3 rounded-xl border border-border-color/30">
                                                <h4 className="text-[10px] text-text-secondary uppercase tracking-wider mb-3">Kịch bản phân đoạn hiện tại</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {editingTokens.map((token, idx) => (
                                                        <div key={idx} className="group relative flex flex-col items-center">
                                                            <div 
                                                                onClick={() => setSelectedTokenIndex(idx)}
                                                                className={`flex items-center bg-primary/10 border ${selectedTokenIndex === idx ? 'border-primary ring-1 ring-primary' : 'border-primary/30'} rounded-lg px-3 py-2 hover:border-primary transition-all cursor-pointer`}
                                                            >
                                                                <span className="text-lg font-chinese text-primary">{token.hanzi}</span>
                                                                <div className="ml-2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {token.hanzi.length > 1 && (
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleSplitToken(idx); }}
                                                                            className="p-0.5 hover:text-text-base text-text-secondary" title="Split"
                                                                        >
                                                                            <Icon name="content_cut" size="sm" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {idx < editingTokens.length - 1 && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleMergeTokens(idx); }}
                                                                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 size-6 bg-[var(--color-surface-dark)] border border-border-color rounded-full flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary shadow-lg group-hover:scale-110 transition-transform"
                                                                    title="Merge with next"
                                                                >
                                                                    <Icon name="link" size="sm" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Token detail editor */}
                                            {selectedTokenIndex !== null && editingTokens[selectedTokenIndex] && (
                                                <div className="p-3 bg-surface-highlight/20 border border-border-color rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="flex items-center justify-between">
                                                        <h5 className="text-xs text-primary font-bold">Chỉnh sửa: {editingTokens[selectedTokenIndex].hanzi}</h5>
                                                        <button onClick={() => setSelectedTokenIndex(null)} className="text-text-secondary hover:text-text-base">
                                                            <Icon name="close" size="sm" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] text-text-secondary uppercase mb-1 block">Pinyin Override</label>
                                                            <input 
                                                                value={editingTokens[selectedTokenIndex].pinyin || ''} 
                                                                onChange={e => {
                                                                    const newTokens = [...editingTokens];
                                                                    newTokens[selectedTokenIndex].pinyin = e.target.value;
                                                                    setEditingTokens(newTokens);
                                                                }}
                                                                className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-1.5 text-xs text-primary focus:outline-none font-pinyin"
                                                                placeholder="e.g. nǐ hǎo"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-text-secondary uppercase mb-1 block">Quick Meaning</label>
                                                            <input 
                                                                value={editingTokens[selectedTokenIndex].meaning || ''} 
                                                                onChange={e => {
                                                                    const newTokens = [...editingTokens];
                                                                    newTokens[selectedTokenIndex].meaning = e.target.value;
                                                                    setEditingTokens(newTokens);
                                                                }}
                                                                className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-1.5 text-xs text-text-base focus:outline-none"
                                                                placeholder="Nghĩa nhanh..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                                <p className="text-[10px] text-amber-300 leading-relaxed italic">
                                                    Thay đổi ở tab này chỉ áp dụng cho video này. Hệ thống sẽ bỏ qua bộ phân đoạn tự động.
                                                </p>
                                            </div>

                                            <Button 
                                                variant="primary" 
                                                className="w-full py-3" 
                                                onClick={handleSaveSubtitle}
                                                isLoading={isUpdatingSubtitle}
                                            >
                                                Lưu kịch bản cho Video
                                            </Button>
                                        </div>
                                    )}
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
                                                    <span className="text-2xl font-chinese text-text-base" lang="zh-CN">{item.word}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-primary text-sm font-pinyin tracking-tight">{item.pinyin}</p>
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
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Header for unknown word */}
                    <div className="p-5 border-b border-border-color bg-surface-highlight/10">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <h2 className={`font-bold text-text-base font-chinese leading-[1.1] ${word.length > 4 ? 'text-4xl' : 'text-5xl'}`} lang="zh-CN">
                                    {word}
                                </h2>
                                {matchingToken?.pinyin && (
                                    <div className="text-primary text-xl font-semibold font-pinyin tracking-tight mt-1 opacity-90">
                                        {matchingToken.pinyin}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center bg-[var(--color-surface-dark)]/50 border border-border-color/30 rounded-2xl p-1 shrink-0">
                                <SpeakerButton text={word} size="sm" />
                                
                                {isAdmin && (
                                    <button
                                        onClick={() => setActivePanel('admin_edit')}
                                        className={`inline-flex items-center justify-center p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activePanel === 'admin_edit'
                                            ? 'bg-amber-500/20 text-amber-500'
                                            : 'text-text-secondary hover:text-amber-400 hover:bg-amber-500/10'
                                            }`}
                                        title="Chỉnh sửa phân đoạn (Admin)"
                                    >
                                        <Icon name="edit" size="sm" />
                                    </button>
                                )}

                                <div className="w-px h-6 bg-border-color/30 mx-1" />
                                <button
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center p-2 hover:bg-rose-500/20 text-text-secondary hover:text-rose-400 rounded-full transition-all"
                                >
                                    <Icon name="close" size="sm" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Token meaning from admin segmentation (all users see this) */}
                    {matchingToken?.meaning ? (
                        <div className="px-5 py-4 border-b border-border-color/30">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="auto_fix_high" size="sm" className="text-amber-400" />
                                <span className="text-[10px] text-amber-300 font-black uppercase tracking-widest">Nghĩa theo ngữ cảnh video</span>
                            </div>
                            <p className="text-xl text-text-base font-semibold leading-snug">{matchingToken.meaning}</p>
                        </div>
                    ) : (
                        <div className="px-5 py-4 border-b border-border-color/30">
                            <div className="flex items-center gap-2">
                                <Icon name="search_off" className="text-2xl text-text-secondary" />
                                <p className="text-text-secondary text-sm">Chưa có nghĩa cho từ này</p>
                            </div>
                        </div>
                    )}

                    {/* Admin: Segmentation panel OR Search/Link/Create word */}
                    {isAdmin && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {activePanel === 'admin_edit' ? (
                                /* Admin Edit Panel - same as in found state */
                                <div className="p-4 space-y-4">
                                    {/* Sub-tabs */}
                                    <div className="flex bg-surface-highlight/30 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setAdminSubTab('word')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${adminSubTab === 'word' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-base'}`}
                                        >
                                            Từ vựng (Global)
                                        </button>
                                        <button 
                                            onClick={() => setAdminSubTab('segment')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${adminSubTab === 'segment' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-base'}`}
                                        >
                                            Phân đoạn (Video)
                                        </button>
                                    </div>

                                    {adminSubTab === 'word' ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Hanzi</label>
                                                    <input 
                                                        value={editHanzi} 
                                                        onChange={e => setEditHanzi(e.target.value)}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-text-base focus:outline-none focus:border-primary font-chinese"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Pinyin</label>
                                                    <input 
                                                        value={editPinyin} 
                                                        onChange={e => setEditPinyin(e.target.value)}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-primary focus:outline-none focus:border-primary font-pinyin"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Loại từ (POS)</label>
                                                    <input 
                                                        value={editPos} 
                                                        onChange={e => setEditPos(e.target.value)}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-blue-400 focus:outline-none focus:border-primary"
                                                        placeholder="e.g. Danh từ, Động từ..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Nghĩa tiếng Việt</label>
                                                    <textarea 
                                                        value={editMeaning} 
                                                        onChange={e => setEditMeaning(e.target.value)}
                                                        rows={3}
                                                        className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-text-base text-sm focus:outline-none focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                            <Button 
                                                variant="primary" 
                                                className="w-full py-3" 
                                                onClick={handleSaveGlobal}
                                                isLoading={isSavingGlobal}
                                            >
                                                Lưu vào Từ điển Global
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1">
                                            <div className="bg-surface-highlight/20 p-3 rounded-xl border border-border-color/30">
                                                <h4 className="text-[10px] text-text-secondary uppercase tracking-wider mb-3">Kịch bản phân đoạn hiện tại</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {editingTokens.map((token: any, idx: number) => (
                                                        <div key={idx} className="group relative flex flex-col items-center">
                                                            <div 
                                                                onClick={() => setSelectedTokenIndex(idx)}
                                                                className={`flex items-center bg-primary/10 border ${selectedTokenIndex === idx ? 'border-primary ring-1 ring-primary' : 'border-primary/30'} rounded-lg px-3 py-2 hover:border-primary transition-all cursor-pointer`}
                                                            >
                                                                <span className="text-lg font-chinese text-primary">{token.hanzi}</span>
                                                                <div className="ml-2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {token.hanzi.length > 1 && (
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleSplitToken(idx); }}
                                                                            className="p-0.5 hover:text-text-base text-text-secondary" title="Split"
                                                                        >
                                                                            <Icon name="content_cut" size="sm" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {idx < editingTokens.length - 1 && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleMergeTokens(idx); }}
                                                                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 size-6 bg-[var(--color-surface-dark)] border border-border-color rounded-full flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary shadow-lg group-hover:scale-110 transition-transform"
                                                                    title="Merge with next"
                                                                >
                                                                    <Icon name="link" size="sm" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Token detail editor */}
                                            {selectedTokenIndex !== null && editingTokens[selectedTokenIndex] && (
                                                <div className="p-3 bg-surface-highlight/20 border border-border-color rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="flex items-center justify-between">
                                                        <h5 className="text-xs text-primary font-bold">Chỉnh sửa: {editingTokens[selectedTokenIndex].hanzi}</h5>
                                                        <button onClick={() => setSelectedTokenIndex(null)} className="text-text-secondary hover:text-text-base">
                                                            <Icon name="close" size="sm" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] text-text-secondary uppercase mb-1 block">Pinyin Override</label>
                                                            <input 
                                                                value={editingTokens[selectedTokenIndex].pinyin || ''} 
                                                                onChange={e => {
                                                                    const newTokens = [...editingTokens];
                                                                    newTokens[selectedTokenIndex].pinyin = e.target.value;
                                                                    setEditingTokens(newTokens);
                                                                }}
                                                                className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-1.5 text-xs text-primary focus:outline-none font-pinyin"
                                                                placeholder="e.g. nǐ hǎo"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-text-secondary uppercase mb-1 block">Quick Meaning</label>
                                                            <input 
                                                                value={editingTokens[selectedTokenIndex].meaning || ''} 
                                                                onChange={e => {
                                                                    const newTokens = [...editingTokens];
                                                                    newTokens[selectedTokenIndex].meaning = e.target.value;
                                                                    setEditingTokens(newTokens);
                                                                }}
                                                                className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-1.5 text-xs text-text-base focus:outline-none"
                                                                placeholder="Nghĩa nhanh..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                                <p className="text-[10px] text-amber-300 leading-relaxed italic">
                                                    Thay đổi ở tab này chỉ áp dụng cho video này. Hệ thống sẽ bỏ qua bộ phân đoạn tự động.
                                                </p>
                                            </div>

                                            <Button 
                                                variant="primary" 
                                                className="w-full py-3" 
                                                onClick={handleSaveSubtitle}
                                                isLoading={isUpdatingSubtitle}
                                            >
                                                Lưu kịch bản cho Video
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Search/Link/Create word UI */
                                <div className="p-4 space-y-4">
                                    {/* Mode switcher */}
                                    <div className="flex bg-surface-highlight/30 p-1 rounded-xl">
                                        <button
                                            onClick={() => setNotFoundMode('search')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${notFoundMode === 'search' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-base'}`}
                                        >
                                            <Icon name="search" size="sm" />
                                            Tìm từ có sẵn
                                        </button>
                                        <button
                                            onClick={() => setNotFoundMode('create')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${notFoundMode === 'create' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-base'}`}
                                        >
                                            <Icon name="add_circle" size="sm" />
                                            Tạo từ mới
                                        </button>
                                    </div>

                                    {/* Search existing words mode */}
                                    {notFoundMode === 'search' && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                                            <div className="relative">
                                                <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                                                <input
                                                    value={searchQuery}
                                                    onChange={e => handleSearchWord(e.target.value)}
                                                    placeholder={`Tìm "${word}" hoặc từ tương tự...`}
                                                    className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-base focus:outline-none focus:border-primary transition-colors"
                                                    autoFocus
                                                />
                                                {isSearching && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                        <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Search results */}
                                            {searchResults.length > 0 ? (
                                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar-thin pr-1">
                                                    {searchResults.map((result, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleLinkWord(result)}
                                                            className="w-full flex items-center gap-3 p-3 bg-surface-highlight/30 hover:bg-primary/10 hover:border-primary/30 border border-border-color/20 rounded-xl transition-all text-left group active:scale-[0.98]"
                                                        >
                                                            <span className="text-xl font-chinese text-text-base group-hover:text-primary transition-colors" lang="zh-CN">
                                                                {result.hanzi}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-primary text-sm font-pinyin tracking-tight">{result.pinyinDisplay}</p>
                                                                <p className="text-text-secondary text-xs truncate">{result.meaningVi || result.meaningEn}</p>
                                                            </div>
                                                            <Icon name="link" size="sm" className="text-text-secondary group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : searchQuery.trim() && !isSearching ? (
                                                <div className="text-center py-6">
                                                    <Icon name="search_off" className="text-3xl text-text-secondary/50 mb-2" />
                                                    <p className="text-text-secondary text-xs">Không tìm thấy từ "{searchQuery}"</p>
                                                    <button
                                                        onClick={() => setNotFoundMode('create')}
                                                        className="mt-2 text-primary text-xs font-bold hover:underline"
                                                    >
                                                        → Tạo từ mới
                                                    </button>
                                                </div>
                                            ) : !searchQuery.trim() ? (
                                                <div className="text-center py-4">
                                                    <p className="text-text-secondary/60 text-xs">Nhập từ hoặc pinyin để tìm kiếm</p>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* Create new word mode */}
                                    {notFoundMode === 'create' && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-1">
                                            {createSuccess ? (
                                                <div className="text-center py-6">
                                                    <div className="size-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <Icon name="check_circle" className="text-emerald-500 text-2xl" />
                                                    </div>
                                                    <p className="text-emerald-400 font-bold">Đã tạo từ thành công!</p>
                                                    <p className="text-text-secondary text-xs mt-1">Từ đã được thêm vào từ điển</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Hanzi</label>
                                                        <input
                                                            value={word}
                                                            disabled
                                                            className="w-full bg-[var(--color-surface-dark)]/50 border border-border-color/30 rounded-lg px-3 py-2 text-text-base/60 font-chinese cursor-not-allowed"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Pinyin *</label>
                                                        <input
                                                            value={newWordPinyin}
                                                            onChange={e => setNewWordPinyin(e.target.value)}
                                                            placeholder="e.g. nǐ hǎo"
                                                            className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-primary focus:outline-none focus:border-primary font-pinyin"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Nghĩa tiếng Việt *</label>
                                                        <textarea
                                                            value={newWordMeaning}
                                                            onChange={e => setNewWordMeaning(e.target.value)}
                                                            rows={2}
                                                            placeholder="Nhập nghĩa..."
                                                            className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-2 text-text-base text-sm focus:outline-none focus:border-primary resize-none"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Loại từ</label>
                                                            <input
                                                                value={newWordPos}
                                                                onChange={e => setNewWordPos(e.target.value)}
                                                                placeholder="Danh từ, Động từ..."
                                                                className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-1.5 text-xs text-blue-400 focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">HSK Level</label>
                                                            <select
                                                                value={newWordHsk}
                                                                onChange={e => setNewWordHsk(Number(e.target.value))}
                                                                className="w-full bg-[var(--color-surface-dark)] border border-border-color rounded-lg px-3 py-1.5 text-xs text-text-base focus:outline-none focus:border-primary"
                                                            >
                                                                {[1,2,3,4,5,6,7,8,9].map(level => (
                                                                    <option key={level} value={level}>HSK {level}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="primary"
                                                        className="w-full py-3"
                                                        onClick={handleCreateNewWord}
                                                        isLoading={isCreatingWord}
                                                        disabled={!newWordPinyin.trim() || !newWordMeaning.trim() || isCreatingWord}
                                                    >
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Icon name="add_circle" size="sm" />
                                                            <span className="font-bold">Tạo từ mới vào từ điển</span>
                                                        </div>
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {notFoundMode === 'info' && (
                                        <div className="text-center py-4">
                                            <p className="text-text-secondary/60 text-xs">Chọn một hành động ở trên để thêm nghĩa cho từ này</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

            {!isMobile && (
                <div
                    className="absolute"
                    style={{
                        left: Math.max(24, Math.min(adjustedPos.width - 24, arrowLeft)),
                        transform: 'translateX(-50%)',
                        ...(adjustedPos.isBelow 
                            ? { top: -ARROW_HEIGHT } 
                            : { bottom: -ARROW_HEIGHT })
                    }}
                >
                    <div className={`w-0 h-0 border-l-[10px] border-r-[10px] border-l-transparent border-r-transparent ${
                        adjustedPos.isBelow 
                            ? 'border-b-[10px] border-b-surface-dark' 
                            : 'border-t-[10px] border-t-surface-dark'
                    }`} />
                </div>
            )}
        </div>
        </>
    );
}

export default WordPopover;
