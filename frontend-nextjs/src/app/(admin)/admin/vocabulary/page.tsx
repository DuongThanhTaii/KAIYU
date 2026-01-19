'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/contexts/AuthContext';
import {
    getAllVocabulary,
    createVocabulary,
    updateVocabulary,
    deleteVocabulary,
    importVocabulary,
    type Vocabulary
} from '@/services/adminApi';

export default function AdminVocabularyPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [vocabulary, setVocabulary] = useState<Vocabulary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterHsk, setFilterHsk] = useState<number | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
    });

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingVocab, setEditingVocab] = useState<Vocabulary | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMode, setImportMode] = useState<'json' | 'csv'>('csv');
    const [importData, setImportData] = useState<Partial<Vocabulary>[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        hanzi: '',
        pinyin: '',
        meaningEn: '',
        meaningVi: '',
        partOfSpeech: '',
        hskLevel: 1,
        tags: '',
    });

    // Auth check
    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated) router.replace('/login');
            else if (user?.role !== 'admin') router.replace('/dashboard');
        }
    }, [authLoading, isAuthenticated, user, router]);

    // Fetch vocabulary
    const fetchVocabulary = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const response = await getAllVocabulary({
                page,
                limit: 50,
                hskLevel: filterHsk || undefined
            });
            setVocabulary(response.data);
            setPagination({
                page: response.meta.page,
                limit: response.meta.limit,
                total: response.meta.total,
                totalPages: response.meta.totalPages,
            });
        } catch (err) {
            console.error('Failed to fetch vocabulary:', err);
            setError('Không thể tải danh sách từ vựng');
        } finally {
            setLoading(false);
        }
    }, [filterHsk]);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'admin') {
            fetchVocabulary();
        }
    }, [fetchVocabulary, isAuthenticated, user]);

    const resetForm = () => {
        setFormData({
            hanzi: '',
            pinyin: '',
            meaningEn: '',
            meaningVi: '',
            partOfSpeech: '',
            hskLevel: 1,
            tags: '',
        });
        setEditingVocab(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const handleOpenEdit = (vocab: Vocabulary) => {
        setEditingVocab(vocab);
        setFormData({
            hanzi: vocab.hanzi,
            pinyin: vocab.pinyin,
            meaningEn: vocab.meaningEn,
            meaningVi: vocab.meaningVi || '',
            partOfSpeech: vocab.partOfSpeech || '',
            hskLevel: vocab.hskLevel,
            tags: vocab.tags?.join(', ') || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const vocabData = {
                hanzi: formData.hanzi,
                pinyin: formData.pinyin,
                meaningEn: formData.meaningEn,
                meaningVi: formData.meaningVi || undefined,
                partOfSpeech: formData.partOfSpeech || undefined,
                hskLevel: formData.hskLevel,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
            };

            if (editingVocab) {
                await updateVocabulary(editingVocab.id, vocabData);
            } else {
                await createVocabulary(vocabData);
            }

            setShowModal(false);
            resetForm();
            fetchVocabulary(pagination.page);
        } catch (err) {
            console.error('Failed to save vocabulary:', err);
            setError('Không thể lưu từ vựng');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setIsSaving(true);
        try {
            await deleteVocabulary(id);
            setVocabulary(vocabulary.filter(v => v.id !== id));
            setShowDeleteConfirm(null);
        } catch (err) {
            console.error('Failed to delete vocabulary:', err);
            setError('Không thể xóa từ vựng');
        } finally {
            setIsSaving(false);
        }
    };

    // Import handlers
    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                if (importMode === 'json') {
                    const data = JSON.parse(content);
                    setImportData(Array.isArray(data) ? data : [data]);
                    setImportError(null);
                } else {
                    // Parse CSV
                    const lines = content.split('\n').filter(line => line.trim());
                    if (lines.length < 2) {
                        setImportError('File CSV cần có header và ít nhất 1 dòng dữ liệu');
                        return;
                    }
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                    const data = lines.slice(1).map(line => {
                        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                        const item: Partial<Vocabulary> = {};
                        headers.forEach((header, index) => {
                            if (header === 'hanzi') item.hanzi = values[index];
                            else if (header === 'pinyin') item.pinyin = values[index];
                            else if (header === 'meaningen' || header === 'meaning_en' || header === 'english') item.meaningEn = values[index];
                            else if (header === 'meaningvi' || header === 'meaning_vi' || header === 'vietnamese') item.meaningVi = values[index];
                            else if (header === 'partofspeech' || header === 'part_of_speech' || header === 'pos') item.partOfSpeech = values[index];
                            else if (header === 'hsklevel' || header === 'hsk_level' || header === 'hsk') item.hskLevel = parseInt(values[index]) || 1;
                        });
                        return item;
                    });
                    setImportData(data);
                    setImportError(null);
                }
            } catch {
                setImportError('Không thể đọc file. Vui lòng kiểm tra định dạng.');
            }
        };
        reader.readAsText(file);
    };

    const handleImportConfirm = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const result = await importVocabulary(importData.map(item => ({
                hanzi: item.hanzi || '',
                pinyin: item.pinyin || '',
                meaningEn: item.meaningEn || '',
                meaningVi: item.meaningVi,
                partOfSpeech: item.partOfSpeech,
                hskLevel: item.hskLevel || 1,
                tags: [],
            })));

            setShowImportModal(false);
            setImportData([]);
            fetchVocabulary(1);

            // Show success message
            alert(`Import thành công: ${result.created} từ mới, ${result.skipped} bỏ qua, ${result.errors} lỗi`);
        } catch (err) {
            console.error('Failed to import vocabulary:', err);
            setImportError('Import thất bại. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    // Export handlers
    const handleExportCSV = () => {
        const headers = 'hanzi,pinyin,meaningEn,meaningVi,partOfSpeech,hskLevel';
        const rows = vocabulary.map(v =>
            `${v.hanzi},${v.pinyin},"${v.meaningEn}","${v.meaningVi || ''}",${v.partOfSpeech || ''},${v.hskLevel}`
        );
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vocabulary_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportJSON = () => {
        const json = JSON.stringify(vocabulary, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vocabulary_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Filter vocabulary
    const filteredVocabulary = vocabulary.filter(v => {
        const matchHsk = !filterHsk || v.hskLevel === filterHsk;
        const matchSearch = !searchQuery ||
            v.hanzi.includes(searchQuery) ||
            v.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.meaningEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.meaningVi && v.meaningVi.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchHsk && matchSearch;
    });

    // Show loading while checking auth
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const columns = [
        {
            key: 'hanzi',
            header: 'Từ vựng',
            width: '120px',
            render: (vocab: Vocabulary) => (
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-bold text-white font-chinese">{vocab.hanzi}</span>
                    <span className="text-xs text-primary/80">{vocab.pinyin}</span>
                </div>
            ),
        },
        {
            key: 'meaning',
            header: 'Nghĩa',
            render: (vocab: Vocabulary) => (
                <span className="text-white">{vocab.meaningVi || vocab.meaningEn}</span>
            ),
        },
        {
            key: 'partOfSpeech',
            header: 'Loại từ',
            width: '80px',
            render: (vocab: Vocabulary) => (
                <span className="text-xs text-text-secondary">{vocab.partOfSpeech || '-'}</span>
            ),
        },
        {
            key: 'hskLevel',
            header: 'HSK',
            width: '80px',
            render: (vocab: Vocabulary) => (
                <span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${vocab.hskLevel <= 2 ? 'bg-green-500/20 text-green-400' :
                    vocab.hskLevel <= 4 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                    }`}>
                    HSK {vocab.hskLevel}
                </span>
            ),
        },
    ];

    const actions = (vocab: Vocabulary) => (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(vocab);
                }}
                className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors"
                title="Sửa"
            >
                <Icon name="edit" className="text-lg" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(vocab.id);
                }}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                title="Xóa"
            >
                <Icon name="delete" className="text-lg" />
            </button>
        </>
    );

    return (
        <AdminLayout
            title="Quản lý Từ vựng"
            actions={
                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <button
                            className="flex items-center gap-2 px-4 py-2 bg-surface-dark border border-border-color text-white font-medium rounded-lg hover:bg-surface-highlight transition-colors"
                        >
                            <Icon name="download" />
                            Export
                            <Icon name="expand_more" className="text-sm" />
                        </button>
                        <div className="absolute right-0 mt-2 w-40 py-2 bg-surface-dark border border-border-color rounded-lg shadow-xl hidden group-hover:block z-10">
                            <button
                                onClick={handleExportCSV}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-surface-highlight"
                            >
                                Export CSV
                            </button>
                            <button
                                onClick={handleExportJSON}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-surface-highlight"
                            >
                                Export JSON
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowImportModal(true)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50"
                    >
                        <Icon name="upload" />
                        Import
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50"
                    >
                        <Icon name="add" />
                        Thêm Từ
                    </button>
                </div>
            }
        >
            {/* Error Toast */}
            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Icon name="error" className="text-red-400" />
                        <p className="text-red-400">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                        <Icon name="close" />
                    </button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-6 gap-4 mb-6">
                {[1, 2, 3, 4, 5, 6].map((level) => {
                    const count = vocabulary.filter(v => v.hskLevel === level).length;
                    return (
                        <button
                            key={level}
                            onClick={() => setFilterHsk(filterHsk === level ? '' : level)}
                            className={`p-4 rounded-xl border transition-colors ${filterHsk === level
                                ? 'bg-primary/20 border-primary'
                                : 'bg-surface-dark border-border-color hover:border-primary/30'
                                }`}
                        >
                            <p className="text-2xl font-bold text-white">{count}</p>
                            <p className="text-xs text-text-secondary">HSK {level}</p>
                        </button>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                    <Icon
                        name="search"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm từ vựng (Hanzi, Pinyin, nghĩa)..."
                        className="w-full pl-12 pr-4 py-3 bg-surface-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                    />
                </div>
                {filterHsk && (
                    <button
                        onClick={() => setFilterHsk('')}
                        className="flex items-center gap-2 px-4 py-3 bg-primary/20 text-primary rounded-xl"
                    >
                        HSK {filterHsk}
                        <Icon name="close" className="text-sm" />
                    </button>
                )}
            </div>

            {/* Data Table */}
            <DataTable
                data={filteredVocabulary}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page) => setPagination({ ...pagination, page })}
                actions={actions}
                emptyMessage="Chưa có từ vựng nào"
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title={editingVocab ? 'Chỉnh sửa Từ vựng' : 'Thêm Từ vựng mới'}
                size="md"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors"
                        >
                            {editingVocab ? 'Cập nhật' : 'Thêm'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Hanzi <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.hanzi}
                                onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white text-2xl text-center placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                                placeholder="你好"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Pinyin <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.pinyin}
                                onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                                placeholder="nǐ hǎo"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Nghĩa tiếng Anh <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.meaningEn}
                            onChange={(e) => setFormData({ ...formData, meaningEn: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="Hello"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Nghĩa tiếng Việt
                        </label>
                        <input
                            type="text"
                            value={formData.meaningVi}
                            onChange={(e) => setFormData({ ...formData, meaningVi: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="Xin chào"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Loại từ
                            </label>
                            <select
                                value={formData.partOfSpeech}
                                onChange={(e) => setFormData({ ...formData, partOfSpeech: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors"
                            >
                                <option value="">Chọn loại từ</option>
                                <option value="noun">Danh từ (Noun)</option>
                                <option value="verb">Động từ (Verb)</option>
                                <option value="adjective">Tính từ (Adjective)</option>
                                <option value="adverb">Trạng từ (Adverb)</option>
                                <option value="phrase">Cụm từ (Phrase)</option>
                                <option value="other">Khác</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                HSK Level
                            </label>
                            <select
                                value={formData.hskLevel}
                                onChange={(e) => setFormData({ ...formData, hskLevel: Number(e.target.value) })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors"
                            >
                                {[1, 2, 3, 4, 5, 6].map((level) => (
                                    <option key={level} value={level}>HSK {level}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Tags (phân cách bởi dấu phẩy)
                        </label>
                        <input
                            type="text"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="greeting, polite, common"
                        />
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(null)}
                title="Xác nhận xóa"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                            className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400 transition-colors"
                        >
                            Xóa
                        </button>
                    </>
                }
            >
                <p className="text-text-secondary">
                    Bạn có chắc chắn muốn xóa từ vựng này? Hành động này không thể hoàn tác.
                </p>
            </Modal>

            {/* Import Modal */}
            <Modal
                isOpen={showImportModal}
                onClose={() => {
                    setShowImportModal(false);
                    setImportData([]);
                    setImportError(null);
                }}
                title="Import Từ vựng"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowImportModal(false);
                                setImportData([]);
                                setImportError(null);
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleImportConfirm}
                            disabled={importData.length === 0}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Import {importData.length} từ
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-4 mb-4">
                        <span className="text-sm text-text-secondary">Định dạng:</span>
                        <div className="flex items-center gap-1 bg-background-dark rounded-lg p-1">
                            <button
                                onClick={() => setImportMode('csv')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${importMode === 'csv'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-white'
                                    }`}
                            >
                                CSV/Excel
                            </button>
                            <button
                                onClick={() => setImportMode('json')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${importMode === 'json'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-white'
                                    }`}
                            >
                                JSON
                            </button>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div
                        className="border-2 border-dashed border-border-color rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={importMode === 'json' ? '.json' : '.csv,.xlsx,.xls'}
                            onChange={handleFileImport}
                            className="hidden"
                        />
                        <Icon name="upload_file" className="text-4xl text-text-secondary mx-auto mb-3" />
                        <p className="text-sm text-text-secondary mb-2">
                            Kéo thả file {importMode === 'json' ? 'JSON' : 'CSV/Excel'} vào đây hoặc
                        </p>
                        <button className="px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-lg">
                            Chọn File
                        </button>
                    </div>

                    {/* Template Info */}
                    <div className="p-4 bg-surface-highlight rounded-lg">
                        <p className="text-sm font-medium text-white mb-2">
                            {importMode === 'csv' ? 'Cấu trúc CSV:' : 'Cấu trúc JSON:'}
                        </p>
                        <pre className="text-xs text-text-secondary bg-background-dark p-3 rounded overflow-x-auto">
                            {importMode === 'csv'
                                ? 'hanzi,pinyin,meaningEn,meaningVi,partOfSpeech,hskLevel\n你好,nǐ hǎo,Hello,Xin chào,phrase,1'
                                : '[\n  {\n    "hanzi": "你好",\n    "pinyin": "nǐ hǎo",\n    "meaningEn": "Hello",\n    "meaningVi": "Xin chào",\n    "hskLevel": 1\n  }\n]'
                            }
                        </pre>
                    </div>

                    {/* Error */}
                    {importError && (
                        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{importError}</p>
                        </div>
                    )}

                    {/* Preview */}
                    {importData.length > 0 && (
                        <div>
                            <p className="text-sm font-medium text-white mb-2">
                                Xem trước ({importData.length} từ):
                            </p>
                            <div className="max-h-48 overflow-y-auto border border-border-color rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-background-dark sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-text-secondary">Hanzi</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">Pinyin</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">English</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">HSK</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-color">
                                        {importData.slice(0, 10).map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-3 py-2 text-white">{item.hanzi}</td>
                                                <td className="px-3 py-2 text-primary">{item.pinyin}</td>
                                                <td className="px-3 py-2 text-text-secondary">{item.meaningEn}</td>
                                                <td className="px-3 py-2 text-text-secondary">{item.hskLevel}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {importData.length > 10 && (
                                    <p className="px-3 py-2 text-xs text-text-secondary text-center bg-background-dark">
                                        ...và {importData.length - 10} từ khác
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </AdminLayout>
    );
}
