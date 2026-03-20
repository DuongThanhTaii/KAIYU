'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/common/Card';
import Icon from '@/components/common/Icon';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import SpeakerButton from '@/components/common/SpeakerButton';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { userVocabularyApi, type UserVocabulary, type UserVocabularyStats } from '@/services/userVocabularyApi';
import { vocabularyFoldersApi, type VocabularyFolder } from '@/services/vocabularyFoldersApi';
import { vocabularyApi, type ExampleSentence as ExampleSentenceType } from '@/services/vocabularyApi';
import { POS_COLORS } from '@/constants/vocabulary';
import { renderGroupedPinyin, renderFormattedMeaning, highlightWord } from '@/utils/chinese';

// Removed local renderFormattedMeaning as it's now imported from @/utils/chinese

export default function VocabNotebookPage() {
    const router = useRouter();
    const [vocabulary, setVocabulary] = useState<UserVocabulary[]>([]);
    const [stats, setStats] = useState<UserVocabularyStats | null>(null);
    const [selectedWord, setSelectedWord] = useState<UserVocabulary | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [proficiencyFilter, setProficiencyFilter] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // Folder state
    const [folders, setFolders] = useState<VocabularyFolder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showFolderDropdown, setShowFolderDropdown] = useState(false);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showMoveDropdown, setShowMoveDropdown] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Rename folder state
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const [renameFolderValue, setRenameFolderValue] = useState('');

    // Drag and drop state
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    // Fetch vocabulary
    const fetchVocabulary = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await userVocabularyApi.getAll({
                page: currentPage,
                limit: 20,
                proficiency: proficiencyFilter || undefined,
                search: searchQuery || undefined,
            });
            setVocabulary(response.data);
            setTotalPages(response.meta.totalPages);
            // Don't auto-select first word - user must click to see details
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load vocabulary';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, proficiencyFilter, searchQuery]); // Removed selectedWord to prevent refetch on selection change

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const statsData = await userVocabularyApi.getStats();
            setStats(statsData);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, []);

    // Fetch folders
    const fetchFolders = useCallback(async () => {
        try {
            const foldersData = await vocabularyFoldersApi.getAll();
            setFolders(foldersData);
        } catch (err) {
            console.error('Failed to fetch folders:', err);
        }
    }, []);

    // Create folder
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await vocabularyFoldersApi.create({ name: newFolderName.trim() });
            setNewFolderName('');
            setIsCreatingFolder(false);
            fetchFolders();
        } catch (err) {
            console.error('Failed to create folder:', err);
        }
    };

    // Delete folder - smart: empty folder = no confirm, folder with vocab = confirm
    const handleDeleteFolder = (folderId: string) => {
        const folder = folders.find(f => f.id === folderId);
        const vocabCount = folder?._count?.vocabulary || 0;

        if (vocabCount === 0) {
            // Empty folder - delete directly
            executeDeleteFolder(folderId);
        } else {
            // Folder has vocab - show confirm dialog
            setConfirmDialog({
                isOpen: true,
                title: 'Xóa thư mục?',
                message: `Thư mục "${folder?.name}" có ${vocabCount} từ. Các từ sẽ không bị xóa, chỉ bỏ khỏi thư mục.`,
                variant: 'warning',
                onConfirm: () => {
                    executeDeleteFolder(folderId);
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                },
            });
        }
    };

    const executeDeleteFolder = async (folderId: string) => {
        try {
            await vocabularyFoldersApi.delete(folderId);
            if (selectedFolderId === folderId) setSelectedFolderId(null);
            fetchFolders();
        } catch (err) {
            console.error('Failed to delete folder:', err);
        }
    };

    // Rename folder
    const handleRenameFolder = async (folderId: string) => {
        if (!renameFolderValue.trim()) {
            setRenamingFolderId(null);
            return;
        }
        try {
            await vocabularyFoldersApi.update(folderId, { name: renameFolderValue.trim() });
            setRenamingFolderId(null);
            setRenameFolderValue('');
            fetchFolders();
        } catch (err) {
            console.error('Failed to rename folder:', err);
        }
    };

    // Batch move vocabulary to folder
    const handleBatchMove = async (targetFolderId: string | null) => {
        if (selectedIds.length === 0) return;
        setIsMoving(true);
        try {
            await Promise.all(
                selectedIds.map(vocabId =>
                    vocabularyFoldersApi.moveVocabulary(vocabId, targetFolderId || undefined)
                )
            );
            setSelectedIds([]);
            setShowMoveDropdown(false);
            fetchVocabulary();
            fetchFolders();
        } catch (err) {
            console.error('Failed to move vocabulary:', err);
        } finally {
            setIsMoving(false);
        }
    };

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, vocabId: string) => {
        setDraggedItemId(vocabId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', vocabId); // Required for drag to work
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setDragOverFolderId(null);
    };

    const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        setDragOverFolderId(folderId);
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        if (draggedItemId) {
            try {
                await vocabularyFoldersApi.moveVocabulary(draggedItemId, targetFolderId || undefined);
                fetchVocabulary();
                fetchFolders();
            } catch (err) {
                console.error('Failed to move vocabulary:', err);
            }
        }
        setDraggedItemId(null);
        setDragOverFolderId(null);
    };

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === vocabulary.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(vocabulary.map(v => v.id));
        }
    };

    useEffect(() => {
        fetchVocabulary();
        fetchStats();
        fetchFolders();
    }, [fetchVocabulary, fetchStats, fetchFolders]);

    // Handle delete with ConfirmDialog
    const handleDelete = (id: string) => {
        const vocab = vocabulary.find(v => v.id === id);
        setConfirmDialog({
            isOpen: true,
            title: 'Xóa từ vựng?',
            message: `Bạn có chắc muốn xóa "${vocab?.vocabulary.hanzi}" khỏi sổ từ vựng?`,
            variant: 'danger',
            onConfirm: () => executeDelete(id),
        });
    };

    const executeDelete = async (id: string) => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsDeleting(id);
        try {
            await userVocabularyApi.remove(id);
            setVocabulary(prev => prev.filter(v => v.id !== id));
            setSelectedIds(prev => prev.filter(i => i !== id));
            if (selectedWord?.id === id) {
                setSelectedWord(vocabulary.find(v => v.id !== id) || null);
            }
            fetchStats();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete';
            alert(errorMessage);
        } finally {
            setIsDeleting(null);
        }
    };

    // Handle search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchVocabulary();
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, proficiencyFilter]);
    
    // Fetch full examples when a word is selected
    useEffect(() => {
        if (selectedWord && (!selectedWord.vocabulary.examples || selectedWord.vocabulary.examples.length === 0 || selectedWord.vocabulary.examples.some(ex => !ex.hanzi))) {
            const fetchWordExamples = async () => {
                try {
                    const examples = await vocabularyApi.getExamples(selectedWord.vocabularyId);
                    if (examples && examples.length > 0) {
                        setSelectedWord(prev => {
                            if (prev && prev.id === selectedWord.id) {
                                return {
                                    ...prev,
                                    vocabulary: {
                                        ...prev.vocabulary,
                                        examples: examples
                                    }
                                };
                            }
                            return prev;
                        });
                        
                        // Also update in the main list so we don't refetch
                        setVocabulary(prev => prev.map(item => 
                            item.id === selectedWord.id 
                                ? { ...item, vocabulary: { ...item.vocabulary, examples } }
                                : item
                        ));
                    }
                } catch (err) {
                    console.error('Failed to fetch examples:', err);
                }
            };
            fetchWordExamples();
        }
    }, [selectedWord?.id]);

    const getProficiencyColor = (proficiency: string) => {
        switch (proficiency) {
            case 'mastered': return 'bg-primary text-primary';
            case 'learning': return 'bg-yellow-400 text-yellow-400';
            case 'review': return 'bg-orange-400 text-orange-400';
            default: return 'bg-blue-400 text-blue-400';
        }
    };

    const getProficiencyLabel = (proficiency: string) => {
        switch (proficiency) {
            case 'mastered': return 'Đã học';
            case 'learning': return 'Đang học';
            case 'review': return 'Cần ôn';
            default: return 'Mới';
        }
    };

    // Get selected folder name for display
    const selectedFolderName = selectedFolderId
        ? folders.find(f => f.id === selectedFolderId)?.name || 'Thư mục'
        : 'Tất cả từ vựng';

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-8 pb-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-text-base tracking-tight mb-2">
                            Sổ Từ Vựng
                        </h1>
                        <p className="text-text-secondary text-lg font-bold tracking-tight">Bộ sưu tập từ vựng của bạn.</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                    <Card variant="default" hover className="group relative overflow-hidden bg-primary/5 border-primary/20 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Icon name="dataset" size="sm" />
                            </div>
                        </div>
                        <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Tổng số từ</p>
                        <p className="text-text-base text-3xl font-black mt-1 tracking-tight">{stats?.total || 0}</p>
                    </Card>

                    <Card variant="default" hover className="group relative overflow-hidden bg-blue-500/5 border-blue-500/20 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="size-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Icon name="fiber_new" size="sm" />
                            </div>
                        </div>
                        <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Từ mới</p>
                        <p className="text-text-base text-3xl font-black mt-1 tracking-tight">{stats?.new || 0}</p>
                    </Card>

                    <Card variant="default" hover className="group relative overflow-hidden bg-orange-500/5 border-orange-500/20 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="size-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Icon name="history_edu" size="sm" />
                            </div>
                        </div>
                        <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Cần ôn tập</p>
                        <p className="text-text-base text-3xl font-black mt-1 tracking-tight">{(stats?.learning || 0) + (stats?.review || 0)}</p>
                    </Card>

                    <Card variant="default" hover className="group relative overflow-hidden bg-primary/5 border-primary/20 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Icon name="verified" size="sm" />
                            </div>
                        </div>
                        <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Đã học</p>
                        <p className="text-text-base text-3xl font-black mt-1 tracking-tight">{stats?.mastered || 0}</p>
                    </Card>
                </div>

                {/* Action Bar */}
                <Card variant="default" padding="sm" className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                    {/* Folder Dropdown & Search & Filters */}
                    <div className="flex flex-wrap items-center gap-2 px-2">
                        {/* Folder Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black transition-all border shadow-sm ${selectedFolderId
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-surface-highlight text-text-base border-border-color/50 hover:border-primary/50'
                                    }`}
                            >
                                <Icon name="folder" size="sm" />
                                <span className="max-w-24 truncate">{selectedFolderName}</span>
                                <Icon name={showFolderDropdown ? 'expand_less' : 'expand_more'} size="sm" />
                            </button>

                            {/* Folder Dropdown Panel */}
                            {showFolderDropdown && (
                                <>
                                    {/* Backdrop */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowFolderDropdown(false)}
                                    />

                                    {/* Dropdown Menu */}
                                    <div className="absolute top-full left-0 mt-2 w-72 bg-surface-dark rounded-xl border border-border-color shadow-xl z-50 overflow-hidden">
                                        {/* Header */}
                                        <div className="p-3 border-b border-border-color flex items-center justify-between bg-surface-highlight/20">
                                            <span className="text-sm font-black text-text-base">Thư mục</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsCreatingFolder(!isCreatingFolder);
                                                }}
                                                className="p-1 text-text-secondary hover:text-primary rounded-full transition-colors border border-transparent hover:border-border-color"
                                            >
                                                <Icon name="add" size="sm" />
                                            </button>
                                        </div>

                                        {/* Create folder form */}
                                        {isCreatingFolder && (
                                            <div className="p-3 border-b border-border-color flex gap-2 bg-blue-50/30 dark:bg-surface-highlight/20">
                                                <input
                                                    type="text"
                                                    placeholder="Tên thư mục..."
                                                    value={newFolderName}
                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                                                    className="flex-1 bg-surface-highlight border border-border-color/60 rounded-lg px-3 py-1.5 text-sm text-text-base font-bold placeholder-text-secondary focus:outline-none focus:border-primary shadow-inner"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={handleCreateFolder}
                                                    className="p-1.5 bg-primary text-on-primary rounded-lg hover:bg-primary-hover inline-flex items-center justify-center shadow-sm"
                                                >
                                                    <Icon name="check" size="sm" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Folder List */}
                                        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedFolderId(null);
                                                    setShowFolderDropdown(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${selectedFolderId === null
                                                    ? 'bg-primary/10 text-primary font-black shadow-sm ring-1 ring-primary/20'
                                                    : 'text-text-secondary hover:bg-surface-highlight hover:text-text-base'
                                                    }`}
                                            >
                                                <Icon name="list" size="sm" />
                                                <span className="font-medium flex-1">Tất cả từ vựng</span>
                                                <span className="text-xs bg-surface-highlight px-2 py-0.5 rounded-full">
                                                    {stats?.total || 0}
                                                </span>
                                            </button>

                                            {folders.map((folder) => (
                                                <div
                                                    key={folder.id}
                                                    onDragOver={(e) => handleDragOver(e, folder.id)}
                                                    onDragLeave={() => setDragOverFolderId(null)}
                                                    onDrop={(e) => handleDrop(e, folder.id)}
                                                    className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${selectedFolderId === folder.id
                                                        ? 'bg-primary/20 text-primary'
                                                        : dragOverFolderId === folder.id
                                                            ? 'bg-primary/30 text-primary ring-2 ring-primary/50'
                                                            : 'text-text-secondary hover:bg-surface-highlight hover:text-white'
                                                        }`}
                                                >
                                                    {renamingFolderId === folder.id ? (
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={renameFolderValue}
                                                                onChange={(e) => setRenameFolderValue(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleRenameFolder(folder.id);
                                                                    if (e.key === 'Escape') setRenamingFolderId(null);
                                                                }}
                                                                onBlur={() => handleRenameFolder(folder.id)}
                                                                className="flex-1 bg-surface-highlight border border-primary rounded-lg px-2 py-1.5 text-sm text-text-base font-bold focus:outline-none shadow-inner"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedFolderId(folder.id);
                                                                    setShowFolderDropdown(false);
                                                                }}
                                                                className="flex-1 flex items-center gap-3 text-left"
                                                            >
                                                                <Icon name={folder.icon || 'folder'} size="sm" />
                                                                <span className="font-medium truncate flex-1">{folder.name}</span>
                                                                <span className="text-xs bg-surface-highlight px-2 py-0.5 rounded-full">
                                                                    {folder._count?.vocabulary || 0}
                                                                </span>
                                                            </button>
                                                            {!folder.isDefault && (
                                                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setRenamingFolderId(folder.id);
                                                                            setRenameFolderValue(folder.name);
                                                                        }}
                                                                        className="p-1 text-text-secondary hover:text-primary inline-flex items-center justify-center"
                                                                        title="Đổi tên"
                                                                    >
                                                                        <Icon name="edit" size="sm" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteFolder(folder.id);
                                                                        }}
                                                                        className="p-1 text-text-secondary hover:text-red-400 inline-flex items-center justify-center"
                                                                        title="Xóa"
                                                                    >
                                                                        <Icon name="close" size="sm" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="h-6 w-px bg-border-color" />

                        {/* Search */}
                        <div className="relative group">
                            <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors" size="sm" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm từ vựng..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface-highlight border border-border-color/50 rounded-full pl-10 pr-4 py-2.5 text-sm text-text-base font-bold placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary/50 w-48 md:w-64 transition-all shadow-sm"
                            />
                        </div>

                        <div className="h-6 w-px bg-border-color" />

                        <select
                            value={proficiencyFilter}
                            onChange={(e) => setProficiencyFilter(e.target.value)}
                            className="bg-surface-highlight border border-border-color/50 rounded-full px-5 py-2.5 text-text-secondary text-sm font-bold focus:outline-none focus:border-primary shadow-sm hover:border-primary/50 transition-colors"
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="new">Mới</option>
                            <option value="learning">Đang học</option>
                            <option value="review">Cần ôn</option>
                            <option value="mastered">Đã học</option>
                        </select>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3 px-2">
                        {/* View Toggle */}
                        <div className="flex items-center bg-surface-highlight rounded-full p-1 border border-border-color/60 shadow-inner">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-2 px-5 rounded-full flex items-center gap-2 text-sm font-black transition-all ${viewMode === 'table' ? 'bg-primary text-on-primary shadow-md' : 'text-text-secondary hover:text-text-base hover:bg-surface-highlight'
                                    }`}
                            >
                                <Icon name="table_rows" size="sm" />
                                <span className="hidden sm:inline">Table</span>
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 px-5 rounded-full flex items-center gap-2 text-sm font-black transition-all ${viewMode === 'grid' ? 'bg-primary text-on-primary shadow-md' : 'text-text-secondary hover:text-text-base hover:bg-surface-highlight'
                                    }`}
                            >
                                <Icon name="grid_view" size="sm" />
                                <span className="hidden sm:inline">Grid</span>
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Error Message */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-red-400">{error}</p>
                        <button onClick={fetchVocabulary} className="mt-2 text-sm text-primary hover:underline">
                            Thử lại
                        </button>
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="flex justify-center py-12">
                        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && vocabulary.length === 0 && (
                    <Card variant="default" className="text-center py-16 bg-[#f0f9ff]/50 dark:bg-surface-dark/50">
                        <Icon name="book_2" className="text-6xl text-primary/40 mb-4" />
                        <h3 className="text-2xl font-black text-text-base mb-2">Chưa có từ vựng nào</h3>
                        <p className="text-text-secondary mb-4">
                            Bắt đầu lưu từ vựng khi xem video để xây dựng bộ sưu tập của bạn.
                        </p>
                        <Button variant="primary" onClick={() => router.push('/learn')}>
                            Xem Video
                        </Button>
                    </Card>
                )}

                {/* Main Content: Table + Drawer */}
                {!isLoading && vocabulary.length > 0 && (
                    <div className="flex gap-6 min-w-0">
                        {/* Vocabulary Table */}
                        <Card variant="default" padding="none" className="flex-1 min-w-0 overflow-hidden">
                            {/* Batch Action Bar */}
                            {selectedIds.length > 0 && (
                                <div className="p-3 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-text-base">
                                            Đã chọn <span className="text-primary font-bold">{selectedIds.length}</span> từ
                                        </span>
                                        <button
                                            onClick={() => setSelectedIds([])}
                                            className="text-xs text-text-secondary hover:text-text-base font-black transition-colors"
                                        >
                                            Bỏ chọn
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Xóa nhiều từ vựng?',
                                                    message: `Bạn có chắc muốn xóa ${selectedIds.length} từ đã chọn khỏi sổ từ vựng?`,
                                                    variant: 'danger',
                                                    onConfirm: async () => {
                                                        const idsToDelete = [...selectedIds];
                                                        setSelectedIds([]);
                                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                        setIsLoading(true);
                                                        try {
                                                            await Promise.all(idsToDelete.map(id => userVocabularyApi.remove(id)));
                                                            fetchVocabulary();
                                                            fetchStats();
                                                        } catch (err) {
                                                            console.error('Failed to batch delete:', err);
                                                            alert('Có lỗi xảy ra khi xóa một số từ.');
                                                        } finally {
                                                            setIsLoading(false);
                                                        }
                                                    }
                                                });
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-sm font-medium transition-all"
                                        >
                                            <Icon name="delete" size="sm" />
                                            Xóa tất cả
                                        </button>
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                                                disabled={isMoving}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
                                            >
                                                {isMoving ? (
                                                    <Icon name="sync" className="animate-spin" size="sm" />
                                                ) : (
                                                    <Icon name="drive_file_move" size="sm" />
                                                )}
                                                Di chuyển vào thư mục
                                            </button>
                                            {showMoveDropdown && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setShowMoveDropdown(false)} />
                                                    <div className="absolute right-0 top-full mt-2 w-56 bg-surface-dark rounded-xl border border-border-color shadow-xl z-50 overflow-hidden">
                                                        <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                                            <button
                                                                onClick={() => handleBatchMove(null)}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-highlight hover:text-text-base font-bold rounded-lg transition-colors"
                                                            >
                                                                <Icon name="folder_off" size="sm" />
                                                                Bỏ khỏi thư mục
                                                            </button>
                                                            {folders.map(folder => (
                                                                <button
                                                                    key={folder.id}
                                                                    onClick={() => handleBatchMove(folder.id)}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-highlight hover:text-text-base font-bold rounded-lg transition-colors"
                                                                >
                                                                    <Icon name={folder.icon || 'folder'} size="sm" />
                                                                    {folder.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Grid View */}
                            {viewMode === 'grid' ? (
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {vocabulary.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedWord(item)}
                                            className={`p-4 rounded-2xl border cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${selectedWord?.id === item.id
                                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                : 'border-border-color/60 bg-surface-dark/50'
                                                }`}
                                        >
                                            <div className="text-2xl font-chinese font-black text-text-base text-center mb-1" lang="zh-CN">
                                                {item.vocabulary.hanzi}
                                            </div>
                                            <div className="text-xs text-primary text-center mb-2 font-pinyin font-black tracking-tight">
                                                {item.vocabulary.pinyin}
                                            </div>
                                            <div className="text-[11px] text-text-secondary text-center line-clamp-2 font-bold leading-tight mb-2 min-h-[2.4rem] flex flex-col justify-center">
                                                {(item.vocabulary.meaningVi || item.vocabulary.meaningEn || '').includes('1.') ? (
                                                    (item.vocabulary.meaningVi || item.vocabulary.meaningEn || '').split(/(?=\d+\.)/).slice(0, 2).map((part, i) => (
                                                        <span key={i} className="block truncate max-w-full">
                                                            {renderFormattedMeaning(part)}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="line-clamp-2">
                                                        {item.vocabulary.meaningVi || item.vocabulary.meaningEn}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-2 flex justify-center">
                                                <Badge variant="hsk" hskLevel={item.vocabulary.hskLevel} className="text-[10px]">
                                                    HSK {item.vocabulary.hskLevel}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-border-color/60 text-text-base text-[10px] uppercase font-black tracking-widest bg-surface-highlight/40">
                                                <th className="px-6 py-4 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.length === vocabulary.length && vocabulary.length > 0}
                                                        onChange={toggleSelectAll}
                                                        className="checkbox-theme rounded border-border-color/50 text-primary focus:ring-primary/20"
                                                    />
                                                </th>
                                                <th className="px-6 py-4">Từ</th>
                                                <th className="px-6 py-4">Nghĩa</th>
                                                <th className="px-6 py-4 hidden md:table-cell">HSK</th>
                                                <th className="px-6 py-4 hidden lg:table-cell">Trạng thái</th>
                                                <th className="px-6 py-4 text-center w-28">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-color">
                                            {vocabulary.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => setSelectedWord(item)}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, item.id)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`group hover:bg-white/[0.02] transition-colors cursor-pointer ${selectedWord?.id === item.id ? 'bg-surface-highlight/30 border-l-4 border-l-primary' : ''
                                                        } ${draggedItemId === item.id ? 'opacity-50' : ''} ${selectedIds.includes(item.id) ? 'bg-primary/5' : ''
                                                        }`}
                                                >
                                                    <td className="px-6 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(item.id)}
                                                            onChange={() => toggleSelect(item.id)}
                                                            className="checkbox-theme rounded border-border-color/50 text-primary focus:ring-primary/20"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className={`text-xl font-chinese font-black group-hover:text-primary transition-colors ${selectedWord?.id === item.id ? 'text-primary' : 'text-text-base'}`} lang="zh-CN">
                                                                {item.vocabulary.hanzi}
                                                            </div>
                                                            <div className="text-xs text-primary font-pinyin font-black tracking-tight">{item.vocabulary.pinyin}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-1 max-w-md">
                                                            {(item.vocabulary.meaningVi || item.vocabulary.meaningEn || '').includes('1.') ? (
                                                                (item.vocabulary.meaningVi || item.vocabulary.meaningEn || '').split(/(?=\d+\.)/).map((part, i) => (
                                                                    <p key={i} className="text-sm font-bold text-text-secondary leading-normal">
                                                                        {renderFormattedMeaning(part)}
                                                                    </p>
                                                                ))
                                                            ) : (
                                                                <p className="text-text-base text-sm font-bold leading-normal">
                                                                    {item.vocabulary.meaningVi || item.vocabulary.meaningEn}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 hidden md:table-cell">
                                                        <Badge variant="hsk" hskLevel={item.vocabulary.hskLevel} className="whitespace-nowrap">HSK {item.vocabulary.hskLevel}</Badge>
                                                    </td>
                                                    <td className="px-6 py-4 hidden lg:table-cell">
                                                        <span className={`text-xs font-bold whitespace-nowrap ${getProficiencyColor(item.proficiency).split(' ')[1]}`}>
                                                            {getProficiencyLabel(item.proficiency)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <SpeakerButton
                                                                text={item.vocabulary.hanzi}
                                                                size="sm"
                                                            />
                                                            <button
                                                                className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors inline-flex items-center justify-center"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(item.id);
                                                                }}
                                                                disabled={isDeleting === item.id}
                                                            >
                                                                {isDeleting === item.id ? (
                                                                    <Icon name="sync" className="animate-spin" size="md" />
                                                                ) : (
                                                                    <Icon name="delete" size="md" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center py-6 border-t border-border-color/60 bg-surface-highlight/10">
                                    <nav className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-full text-text-secondary hover:text-text-base hover:bg-surface-highlight border border-transparent hover:border-border-color transition-all disabled:opacity-30"
                                        >
                                            <Icon name="chevron_left" size="md" />
                                        </button>

                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`size-10 rounded-full font-black text-sm transition-all shadow-sm ${currentPage === page
                                                    ? 'bg-primary text-on-primary scale-110 shadow-primary/20'
                                                    : 'text-text-secondary hover:bg-surface-highlight hover:text-text-base border border-transparent hover:border-border-color'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))}

                                        {totalPages > 5 && <span className="px-2 text-text-secondary font-bold">...</span>}

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-full text-text-secondary hover:text-text-base hover:bg-surface-highlight border border-transparent hover:border-border-color transition-all disabled:opacity-30"
                                        >
                                            <Icon name="chevron_right" size="md" />
                                        </button>
                                    </nav>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* Word Detail Overlay Drawer */}
                {selectedWord && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/50 z-40 lg:bg-transparent lg:pointer-events-none"
                            onClick={() => setSelectedWord(null)}
                        />

                        {/* Drawer */}
                        <div className="fixed right-0 top-0 h-full w-full sm:w-[500px] z-50 flex flex-col bg-surface-dark border-l border-border-color shadow-2xl animate-slide-in-right">
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-border-color/60 flex items-center justify-between bg-surface-highlight/20">
                                <div className="flex items-center gap-3 text-text-base">
                                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                        <Icon name="book_2" size="sm" />
                                    </div>
                                    <span className="text-sm uppercase font-black tracking-widest">Chi tiết từ vựng</span>
                                </div>
                                <button
                                    onClick={() => setSelectedWord(null)}
                                    className="text-text-secondary hover:text-text-base hover:bg-surface-highlight p-2 rounded-full transition-all border border-transparent hover:border-border-color"
                                >
                                    <Icon name="close" />
                                </button>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                                {/* Word Header */}
                                <div className="flex flex-col items-center justify-center py-8 bg-blue-500/5 dark:bg-primary/10 rounded-3xl border border-blue-500/20 dark:border-border-color/40 shadow-sm">
                                    <div className="text-6xl font-chinese font-black text-text-base mb-2 select-all" lang="zh-CN">{selectedWord.vocabulary.hanzi}</div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl text-primary font-pinyin font-black tracking-tight">{selectedWord.vocabulary.pinyin}</span>
                                        <SpeakerButton text={selectedWord.vocabulary.hanzi} size="md" className="shadow-lg hover:scale-110 transition-transform" />
                                    </div>
                                </div>

                                {/* Definition Card */}
                                <div className="bg-amber-500/5 dark:bg-surface-highlight/30 rounded-2xl p-6 border border-amber-500/20 dark:border-border-color/60 space-y-3 shadow-sm hover:shadow-md transition-all">
                                    <h3 className="text-amber-600 dark:text-text-secondary text-[10px] uppercase font-black tracking-[0.2em] mb-1">Định nghĩa & Nghĩa</h3>
                                    <div className="space-y-2">
                                        {(selectedWord.vocabulary.meaningVi || selectedWord.vocabulary.meaningEn || '').includes('1.') ? (
                                            (selectedWord.vocabulary.meaningVi || selectedWord.vocabulary.meaningEn || '').split(/(?=\d+\.)/).map((part, i) => (
                                                <p key={i} className="text-lg font-bold text-text-base leading-relaxed">
                                                    {renderFormattedMeaning(part)}
                                                </p>
                                            ))
                                        ) : (
                                            <p className="text-text-base text-xl font-bold leading-relaxed">
                                                {selectedWord.vocabulary.meaningVi || selectedWord.vocabulary.meaningEn}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Example Sentences - Multi-section logic */}
                                {selectedWord.vocabulary.examples && selectedWord.vocabulary.examples.length > 0 && (
                                    <div className="space-y-4 pt-2">
                                        <h4 className="text-text-secondary text-[10px] uppercase font-black tracking-[0.2em] px-1 flex items-center gap-2">
                                            <div className="h-px flex-1 bg-border-color/30" />
                                            VÍ DỤ CÂU
                                            <div className="h-px flex-1 bg-border-color/30" />
                                        </h4>
                                        <div className="space-y-4">
                                            {selectedWord.vocabulary.examples.slice(0, 3).map((ex: any, i) => {
                                                const sentence = ex.hanzi || ex.chinese;
                                                const meaning = ex.meaningVi || ex.translation || ex.vietnamese;
                                                const pinyin = ex.pinyin;

                                                if (!sentence && !pinyin) return null;

                                                return (
                                                    <div key={i} className="animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 100}ms` }}>
                                                        <div className="bg-indigo-500/5 dark:bg-surface-highlight/30 rounded-2xl p-5 border border-indigo-500/20 dark:border-border-color/60 group hover:border-primary/50 hover:bg-indigo-500/10 transition-all duration-300 shadow-sm hover:shadow-md">
                                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                                <p className="text-text-base font-chinese text-xl font-bold leading-relaxed flex-1 select-all" lang="zh-CN">
                                                                    {highlightWord(sentence || "", selectedWord.vocabulary.hanzi)}
                                                                </p>
                                                                <SpeakerButton text={sentence || ''} size="sm" className="opacity-0 group-hover:opacity-100 transition-all shadow-md" />
                                                            </div>
                                                            {pinyin && (
                                                                <p className="text-indigo-600 dark:text-primary font-pinyin font-black text-sm tracking-tight mb-3">
                                                                    {highlightWord(pinyin, selectedWord.vocabulary.pinyin)}
                                                                </p>
                                                            )}
                                                            {meaning && (
                                                                <div className="relative pl-3 border-l-4 border-indigo-500/20 group-hover:border-indigo-500/40 transition-colors">
                                                                    <p className="text-text-secondary text-sm font-bold leading-relaxed italic">
                                                                        {meaning}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Tags */}
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="hsk" hskLevel={selectedWord.vocabulary.hskLevel}>HSK {selectedWord.vocabulary.hskLevel}</Badge>
                                    {selectedWord.vocabulary.tags?.map(tag => (
                                        <Badge key={tag} variant="secondary">{tag}</Badge>
                                    ))}
                                </div>

                                {/* Proficiency */}
                                <div className="bg-emerald-500/5 dark:bg-surface-highlight/30 rounded-2xl p-5 border border-emerald-500/20 dark:border-border-color/60 shadow-sm">
                                    <h3 className="text-emerald-600 dark:text-text-secondary text-[10px] uppercase font-black tracking-[0.2em] mb-3">Tiến độ SRS</h3>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getProficiencyColor(selectedWord.proficiency).replace('bg-', 'bg-opacity-10 ')} ${getProficiencyColor(selectedWord.proficiency).replace('bg-', 'text-')}`}>
                                            {getProficiencyLabel(selectedWord.proficiency)}
                                        </span>
                                        <span className="text-emerald-700 dark:text-text-base font-black">{selectedWord.proficiencyPercent}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-emerald-500/10 dark:bg-surface-highlight rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className={`h-full rounded-full ${getProficiencyColor(selectedWord.proficiency).split(' ')[0]} shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.3)] transition-all duration-500`}
                                            style={{ width: `${selectedWord.proficiencyPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-6 border-t border-border-color/60 bg-surface-highlight/10">
                                <Button
                                    variant="primary"
                                    fullWidth
                                    leftIcon={<Icon name="school" />}
                                    onClick={() => router.push('/review')}
                                >
                                    Ôn tập ngay
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                isLoading={isDeleting !== null}
            />
        </DashboardLayout >
    );
}
