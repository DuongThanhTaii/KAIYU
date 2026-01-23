'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
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
    type Vocabulary,
    type ImportVocabularyItem
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
    const [importMode, setImportMode] = useState<'json' | 'csv' | 'xlsx'>('xlsx');
    const [importData, setImportData] = useState<ImportVocabularyItem[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);
    const [duplicateConfirm, setDuplicateConfirm] = useState<{ message: string; vocab: Vocabulary } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Meaning entry type for multi-meaning support
    interface MeaningEntry {
        partOfSpeech: string;
        pinyin: string;
        meanings: string;  // comma-separated in form
    }

    // Example sentence type
    interface ExampleEntry {
        chinese: string;
        pinyin: string;
        vietnamese: string;
    }

    // Form state - expanded for all vocabulary fields
    const [formData, setFormData] = useState({
        hanzi: '',
        pinyin: '',
        meaningVi: '',
        meaningEn: '',
        radical: '',
        radicalMeaning: '',
        strokeCount: '',
        hskLevel: 1,
        tags: '',
        mnemonic: '',
    });

    // Dynamic form arrays
    const [meaningEntries, setMeaningEntries] = useState<MeaningEntry[]>([
        { partOfSpeech: '', pinyin: '', meanings: '' }
    ]);
    const [exampleEntries, setExampleEntries] = useState<ExampleEntry[]>([
        { chinese: '', pinyin: '', vietnamese: '' }
    ]);
    const [synonyms, setSynonyms] = useState('');  // comma separated hanzi:pinyin:meaning
    const [antonyms, setAntonyms] = useState('');  // comma separated

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
            meaningVi: '',
            meaningEn: '',
            radical: '',
            radicalMeaning: '',
            strokeCount: '',
            hskLevel: 1,
            tags: '',
            mnemonic: '',
        });
        setMeaningEntries([{ partOfSpeech: '', pinyin: '', meanings: '' }]);
        setExampleEntries([{ chinese: '', pinyin: '', vietnamese: '' }]);
        setSynonyms('');
        setAntonyms('');
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
            meaningVi: vocab.meaningVi,
            meaningEn: vocab.meaningEn || '',
            radical: vocab.radical || '',
            radicalMeaning: vocab.radicalMeaning || '',
            strokeCount: vocab.strokeCount?.toString() || '',
            hskLevel: vocab.hskLevel,
            tags: vocab.tags?.join(', ') || '',
            mnemonic: vocab.mnemonic || '',
        });
        // Load meanings if available
        const vocabMeanings = (vocab as any).meanings;
        if (vocabMeanings && Array.isArray(vocabMeanings) && vocabMeanings.length > 0) {
            setMeaningEntries(vocabMeanings.map((m: any) => ({
                partOfSpeech: m.partOfSpeech || '',
                pinyin: m.pinyin || '',
                meanings: Array.isArray(m.meanings) ? m.meanings.join(', ') : '',
            })));
        } else {
            setMeaningEntries([{ partOfSpeech: vocab.partOfSpeech || '', pinyin: vocab.pinyin, meanings: vocab.meaningVi }]);
        }
        // Load examples
        const vocabExamples = vocab.examples;
        if (vocabExamples && Array.isArray(vocabExamples) && vocabExamples.length > 0) {
            setExampleEntries(vocabExamples.map((e: any) => ({
                chinese: e.chinese || '',
                pinyin: e.pinyin || '',
                vietnamese: e.vietnamese || '',
            })));
        } else {
            setExampleEntries([{ chinese: '', pinyin: '', vietnamese: '' }]);
        }
        // Load synonyms/antonyms
        const vocabSynonyms = vocab.synonyms;
        if (vocabSynonyms && Array.isArray(vocabSynonyms)) {
            setSynonyms(vocabSynonyms.map((s: any) => `${s.hanzi}:${s.pinyin}:${s.meaningVi}`).join(', '));
        }
        const vocabAntonyms = vocab.antonyms;
        if (vocabAntonyms && Array.isArray(vocabAntonyms)) {
            setAntonyms(vocabAntonyms.map((a: any) => `${a.hanzi}:${a.pinyin}:${a.meaningVi}`).join(', '));
        }
        setShowModal(true);
    };

    // Parse synonyms/antonyms from comma-separated format "hanzi:pinyin:meaning, ..."
    const parseRelatedWords = (input: string) => {
        if (!input.trim()) return [];
        return input.split(',').map(item => {
            const parts = item.trim().split(':');
            return {
                hanzi: parts[0]?.trim() || '',
                pinyin: parts[1]?.trim() || '',
                meaningVi: parts[2]?.trim() || '',
            };
        }).filter(w => w.hanzi);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            // Build meanings array from form
            const meanings = meaningEntries
                .filter(m => m.partOfSpeech || m.meanings)
                .map(m => ({
                    partOfSpeech: m.partOfSpeech,
                    pinyin: m.pinyin || formData.pinyin,
                    meanings: m.meanings.split(',').map(s => s.trim()).filter(Boolean),
                }));

            // Build examples array
            const examples = exampleEntries
                .filter(e => e.chinese)
                .map(e => ({
                    chinese: e.chinese,
                    pinyin: e.pinyin,
                    vietnamese: e.vietnamese,
                }));

            // Combine meaningVi from meanings or use direct input
            let primaryMeaningVi = formData.meaningVi;
            if (meanings.length > 0) {
                primaryMeaningVi = meanings.flatMap(m => m.meanings).join('; ');
            }

            const vocabData: any = {
                hanzi: formData.hanzi,
                pinyin: formData.pinyin,
                meaningVi: primaryMeaningVi,
                meaningEn: formData.meaningEn || undefined,
                radical: formData.radical || undefined,
                radicalMeaning: formData.radicalMeaning || undefined,
                strokeCount: formData.strokeCount ? parseInt(formData.strokeCount) : undefined,
                hskLevel: formData.hskLevel,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                mnemonic: formData.mnemonic || undefined,
                examples: examples.length > 0 ? examples : undefined,
                meanings: meanings.length > 0 ? meanings : undefined,
                synonyms: parseRelatedWords(synonyms),
                antonyms: parseRelatedWords(antonyms),
            };

            if (editingVocab) {
                await updateVocabulary(editingVocab.id, vocabData);
            } else {
                await createVocabulary(vocabData);
            }

            setShowModal(false);
            resetForm();
            fetchVocabulary(pagination.page);
        } catch (err: any) {
            console.error('Failed to save vocabulary:', err);
            const errorMessage = err?.message || 'Không thể lưu từ vựng';

            // Check if it's a duplicate error (409 Conflict)
            if (errorMessage.includes('đã tồn tại')) {
                // Find the existing vocabulary to offer edit option
                const existingVocab = vocabulary.find(v => v.hanzi === formData.hanzi);
                if (existingVocab) {
                    // Show Modal to switch to edit mode
                    setDuplicateConfirm({ message: errorMessage, vocab: existingVocab });
                    return;
                }
            }

            setError(errorMessage);
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

        if (importMode === 'xlsx') {
            // Parse XLSX
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                    // Map to ImportVocabularyItem format
                    const items: ImportVocabularyItem[] = jsonData.map(row => ({
                        hanzi: row.hanzi || row['汉字'] || '',
                        pinyin: row.pinyin || row['拼音'] || '',
                        meaningVi: row.meaningVi || row.meaning_vi || row['nghĩa'] || row['vietnamese'] || '',
                        meaningEn: row.meaningEn || row.meaning_en || row['english'],
                        radical: row.radical || row['bộ thủ'],
                        radicalMeaning: row.radicalMeaning || row.radical_meaning,
                        strokeCount: parseInt(row.strokeCount || row.stroke_count) || undefined,
                        partOfSpeech: row.partOfSpeech || row.part_of_speech || row.pos || row['loại từ'],
                        hskLevel: parseInt(row.hskLevel || row.hsk_level || row.hsk) || 1,
                        example1_cn: row.example1_cn || row['ví dụ 1'],
                        example1_py: row.example1_py,
                        example1_vi: row.example1_vi,
                        synonym1: row.synonym1 || row['đồng nghĩa'],
                        antonym1: row.antonym1 || row['trái nghĩa'],
                    }));

                    setImportData(items.filter(i => i.hanzi && i.pinyin && i.meaningVi));
                    setImportError(null);
                } catch (err) {
                    console.error('XLSX parse error:', err);
                    setImportError('Không thể đọc file XLSX. Vui lòng kiểm tra định dạng.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            // Parse CSV/JSON
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    if (importMode === 'json') {
                        const data = JSON.parse(content);
                        const items = (Array.isArray(data) ? data : [data]).map((item: any) => ({
                            hanzi: item.hanzi || '',
                            pinyin: item.pinyin || '',
                            meaningVi: item.meaningVi || item.meaning_vi || '',
                            meaningEn: item.meaningEn || item.meaning_en,
                            partOfSpeech: item.partOfSpeech || item.part_of_speech,
                            hskLevel: item.hskLevel || item.hsk_level || 1,
                        }));
                        setImportData(items.filter((i: ImportVocabularyItem) => i.hanzi && i.pinyin && i.meaningVi));
                        setImportError(null);
                    } else {
                        // Parse CSV
                        const lines = content.split('\n').filter(line => line.trim());
                        if (lines.length < 2) {
                            setImportError('File CSV cần có header và ít nhất 1 dòng dữ liệu');
                            return;
                        }
                        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                        const items: ImportVocabularyItem[] = lines.slice(1).map(line => {
                            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                            const item: any = {};
                            headers.forEach((header, index) => {
                                if (header === 'hanzi') item.hanzi = values[index];
                                else if (header === 'pinyin') item.pinyin = values[index];
                                else if (['meaningvi', 'meaning_vi', 'vietnamese', 'nghĩa'].includes(header)) item.meaningVi = values[index];
                                else if (['meaningen', 'meaning_en', 'english'].includes(header)) item.meaningEn = values[index];
                                else if (['partofspeech', 'part_of_speech', 'pos'].includes(header)) item.partOfSpeech = values[index];
                                else if (['hsklevel', 'hsk_level', 'hsk'].includes(header)) item.hskLevel = parseInt(values[index]) || 1;
                                else if (header === 'radical') item.radical = values[index];
                            });
                            return item;
                        });
                        setImportData(items.filter(i => i.hanzi && i.pinyin && i.meaningVi));
                        setImportError(null);
                    }
                } catch {
                    setImportError('Không thể đọc file. Vui lòng kiểm tra định dạng.');
                }
            };
            reader.readAsText(file);
        }
    };

    const handleImportConfirm = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const result = await importVocabulary(importData);

            setShowImportModal(false);
            setImportData([]);
            fetchVocabulary(1);

            // Show result in modal
            setImportResult(result);
        } catch (err: any) {
            console.error('Failed to import vocabulary:', err);
            setImportError(err?.message || 'Import thất bại. Vui lòng thử lại.');
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

    // Download template file
    const handleDownloadTemplate = () => {
        // Sample data với đầy đủ các cột
        const templateData = [
            {
                hanzi: '好',
                pinyin: 'hǎo',
                meaningVi: 'tốt, đẹp, khỏe',
                meaningEn: 'good, fine, well',
                hskLevel: 1,
                radical: '女',
                radicalMeaning: 'nữ, phụ nữ',
                strokeCount: 6,
                partOfSpeech: 'adj',
                tags: 'greeting, common',
                mnemonic: 'Chữ 好 gồm bộ 女 (nữ) và 子 (con) = người phụ nữ bế con → điều tốt đẹp',
                example1_cn: '你好！',
                example1_py: 'Nǐ hǎo!',
                example1_vi: 'Xin chào!',
                example2_cn: '很好',
                example2_py: 'hěn hǎo',
                example2_vi: 'rất tốt',
                synonym1: '棒:bàng:tuyệt',
                synonym2: '佳:jiā:tốt đẹp',
                antonym1: '坏:huài:xấu',
                antonym2: '差:chà:kém',
            },
            {
                hanzi: '学',
                pinyin: 'xué',
                meaningVi: 'học, học tập',
                meaningEn: 'to learn, to study',
                hskLevel: 1,
                radical: '子',
                radicalMeaning: 'con, đứa trẻ',
                strokeCount: 8,
                partOfSpeech: 'verb',
                tags: 'education, common',
                mnemonic: 'Chữ 学 có phần trên giống hai tay đang giữ sách, phần dưới là 子 (con) = đứa trẻ đang học',
                example1_cn: '我学中文',
                example1_py: 'Wǒ xué zhōngwén',
                example1_vi: 'Tôi học tiếng Trung',
                example2_cn: '',
                example2_py: '',
                example2_vi: '',
                synonym1: '习:xí:học tập',
                synonym2: '',
                antonym1: '教:jiào:dạy',
                antonym2: '',
            },
        ];

        // Tạo workbook
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vocabulary');

        // Set column widths
        ws['!cols'] = [
            { wch: 8 },  // hanzi
            { wch: 12 }, // pinyin
            { wch: 25 }, // meaningVi
            { wch: 20 }, // meaningEn
            { wch: 8 },  // hskLevel
            { wch: 6 },  // radical
            { wch: 15 }, // radicalMeaning
            { wch: 10 }, // strokeCount
            { wch: 10 }, // partOfSpeech
            { wch: 15 }, // tags
            { wch: 40 }, // mnemonic
            { wch: 15 }, // example1_cn
            { wch: 15 }, // example1_py
            { wch: 20 }, // example1_vi
            { wch: 15 }, // example2_cn
            { wch: 15 }, // example2_py
            { wch: 20 }, // example2_vi
            { wch: 15 }, // synonym1
            { wch: 15 }, // synonym2
            { wch: 15 }, // antonym1
            { wch: 15 }, // antonym2
        ];

        // Download
        XLSX.writeFile(wb, 'vocabulary_template.xlsx');
    };

    // Filter vocabulary
    const filteredVocabulary = vocabulary.filter(v => {
        const matchHsk = !filterHsk || v.hskLevel === filterHsk;
        const matchSearch = !searchQuery ||
            v.hanzi.includes(searchQuery) ||
            v.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.meaningVi.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.meaningEn && v.meaningEn.toLowerCase().includes(searchQuery.toLowerCase()));
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
            key: 'radical',
            header: 'Bộ thủ',
            width: '80px',
            render: (vocab: Vocabulary) => (
                <div className="text-center">
                    {vocab.radical ? (
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-lg font-chinese text-amber-400">{vocab.radical}</span>
                            {vocab.strokeCount && (
                                <span className="text-[10px] text-text-secondary">{vocab.strokeCount} nét</span>
                            )}
                        </div>
                    ) : (
                        <span className="text-text-secondary">-</span>
                    )}
                </div>
            ),
        },
        {
            key: 'meaning',
            header: 'Nghĩa',
            render: (vocab: Vocabulary) => (
                <div className="flex flex-col gap-1">
                    <span className="text-white">{vocab.meaningVi || vocab.meaningEn}</span>
                    {vocab.partOfSpeech && (
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full w-fit">{vocab.partOfSpeech}</span>
                    )}
                </div>
            ),
        },
        {
            key: 'examples',
            header: 'Ví dụ',
            width: '200px',
            render: (vocab: Vocabulary) => {
                const examples = vocab.examples as Array<{ chinese?: string; pinyin?: string; vietnamese?: string }> | null;
                if (!examples || examples.length === 0) return <span className="text-text-secondary text-sm">-</span>;
                const first = examples[0];
                return (
                    <div className="text-sm">
                        <p className="text-white font-chinese">{first.chinese}</p>
                        <p className="text-primary/70 text-xs">{first.pinyin}</p>
                        <p className="text-text-secondary text-xs">{first.vietnamese}</p>
                        {examples.length > 1 && (
                            <span className="text-xs text-amber-500">+{examples.length - 1} khác</span>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'relatedWords',
            header: 'Từ liên quan',
            width: '150px',
            render: (vocab: Vocabulary) => {
                const synonyms = vocab.synonyms as Array<{ hanzi?: string; meaning?: string }> | null;
                const antonyms = vocab.antonyms as Array<{ hanzi?: string; meaning?: string }> | null;
                const hasSynonyms = synonyms && synonyms.length > 0;
                const hasAntonyms = antonyms && antonyms.length > 0;

                if (!hasSynonyms && !hasAntonyms) return <span className="text-text-secondary text-sm">-</span>;

                return (
                    <div className="text-xs space-y-1">
                        {hasSynonyms && (
                            <div className="flex items-center gap-1">
                                <span className="text-green-400">≈</span>
                                <span className="text-green-300 font-chinese">{synonyms.slice(0, 2).map(s => s.hanzi).join(', ')}</span>
                            </div>
                        )}
                        {hasAntonyms && (
                            <div className="flex items-center gap-1">
                                <span className="text-red-400">↔</span>
                                <span className="text-red-300 font-chinese">{antonyms.slice(0, 2).map(a => a.hanzi).join(', ')}</span>
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'mnemonic',
            header: 'Gợi ý nhớ',
            width: '180px',
            render: (vocab: Vocabulary) => (
                vocab.mnemonic ? (
                    <p className="text-xs text-amber-300/80 line-clamp-2" title={vocab.mnemonic}>
                        💡 {vocab.mnemonic}
                    </p>
                ) : (
                    <span className="text-text-secondary text-sm">-</span>
                )
            ),
        },
        {
            key: 'hskLevel',
            header: 'HSK',
            width: '70px',
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
                <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Section 1: Basic Info */}
                    <div className="bg-surface-highlight/30 rounded-xl p-4 space-y-4">
                        <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                            <Icon name="info" size="sm" />
                            Thông tin cơ bản
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    Hán tự <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.hanzi}
                                    onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white text-2xl text-center placeholder-text-secondary focus:outline-none focus:border-amber-500"
                                    placeholder="好"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    Bộ thủ
                                </label>
                                <input
                                    type="text"
                                    value={formData.radical}
                                    onChange={(e) => setFormData({ ...formData, radical: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white text-xl text-center"
                                    placeholder="女"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    Số nét
                                </label>
                                <input
                                    type="number"
                                    value={formData.strokeCount}
                                    onChange={(e) => setFormData({ ...formData, strokeCount: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white text-center"
                                    placeholder="6"
                                    min="1"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    Pinyin chính <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.pinyin}
                                    onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white"
                                    placeholder="hǎo"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    Nghĩa bộ thủ
                                </label>
                                <input
                                    type="text"
                                    value={formData.radicalMeaning}
                                    onChange={(e) => setFormData({ ...formData, radicalMeaning: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white"
                                    placeholder="nữ, phụ nữ"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    HSK Level <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={formData.hskLevel}
                                    onChange={(e) => setFormData({ ...formData, hskLevel: Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white"
                                >
                                    {[1, 2, 3, 4, 5, 6].map((level) => (
                                        <option key={level} value={level}>HSK {level}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    Tags (phẩy cách)
                                </label>
                                <input
                                    type="text"
                                    value={formData.tags}
                                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white"
                                    placeholder="greeting, common"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Meanings (Dynamic) */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                <Icon name="translate" size="sm" />
                                Nghĩa và Loại từ
                            </h4>
                            <button
                                type="button"
                                onClick={() => setMeaningEntries([...meaningEntries, { partOfSpeech: '', pinyin: '', meanings: '' }])}
                                className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                            >
                                + Thêm nghĩa
                            </button>
                        </div>
                        {meaningEntries.map((entry, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-3">
                                    <label className="block text-xs text-text-secondary mb-1">Loại từ</label>
                                    <select
                                        value={entry.partOfSpeech}
                                        onChange={(e) => {
                                            const newEntries = [...meaningEntries];
                                            newEntries[idx].partOfSpeech = e.target.value;
                                            setMeaningEntries(newEntries);
                                        }}
                                        className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded text-white text-sm"
                                    >
                                        <option value="">Chọn</option>
                                        <option value="noun">Danh từ</option>
                                        <option value="verb">Động từ</option>
                                        <option value="adj">Tính từ</option>
                                        <option value="adv">Trạng từ</option>
                                        <option value="prep">Giới từ</option>
                                        <option value="conj">Liên từ</option>
                                        <option value="phrase">Cụm từ</option>
                                        <option value="other">Khác</option>
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-xs text-text-secondary mb-1">Pinyin</label>
                                    <input
                                        type="text"
                                        value={entry.pinyin}
                                        onChange={(e) => {
                                            const newEntries = [...meaningEntries];
                                            newEntries[idx].pinyin = e.target.value;
                                            setMeaningEntries(newEntries);
                                        }}
                                        className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded text-white text-sm"
                                        placeholder="hǎo"
                                    />
                                </div>
                                <div className="col-span-5">
                                    <label className="block text-xs text-text-secondary mb-1">Nghĩa (phẩy cách)</label>
                                    <input
                                        type="text"
                                        value={entry.meanings}
                                        onChange={(e) => {
                                            const newEntries = [...meaningEntries];
                                            newEntries[idx].meanings = e.target.value;
                                            setMeaningEntries(newEntries);
                                        }}
                                        className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded text-white text-sm"
                                        placeholder="tốt, đẹp, khỏe"
                                    />
                                </div>
                                <div className="col-span-1">
                                    {meaningEntries.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setMeaningEntries(meaningEntries.filter((_, i) => i !== idx))}
                                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                                        >
                                            <Icon name="delete" size="sm" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        <p className="text-xs text-text-secondary italic">
                            💡 Thêm nhiều nghĩa nếu từ có nhiều cách đọc/loại từ khác nhau
                        </p>
                    </div>

                    {/* Section 3: Examples (Dynamic) */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                <Icon name="format_quote" size="sm" />
                                Ví dụ câu
                            </h4>
                            {exampleEntries.length < 3 && (
                                <button
                                    type="button"
                                    onClick={() => setExampleEntries([...exampleEntries, { chinese: '', pinyin: '', vietnamese: '' }])}
                                    className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30"
                                >
                                    + Thêm ví dụ
                                </button>
                            )}
                        </div>
                        {exampleEntries.map((ex, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-4">
                                    <label className="block text-xs text-text-secondary mb-1">Câu tiếng Trung</label>
                                    <input
                                        type="text"
                                        value={ex.chinese}
                                        onChange={(e) => {
                                            const newExamples = [...exampleEntries];
                                            newExamples[idx].chinese = e.target.value;
                                            setExampleEntries(newExamples);
                                        }}
                                        className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded text-white text-sm"
                                        placeholder="我很好"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-xs text-text-secondary mb-1">Pinyin</label>
                                    <input
                                        type="text"
                                        value={ex.pinyin}
                                        onChange={(e) => {
                                            const newExamples = [...exampleEntries];
                                            newExamples[idx].pinyin = e.target.value;
                                            setExampleEntries(newExamples);
                                        }}
                                        className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded text-white text-sm"
                                        placeholder="wǒ hěn hǎo"
                                    />
                                </div>
                                <div className="col-span-4">
                                    <label className="block text-xs text-text-secondary mb-1">Dịch tiếng Việt</label>
                                    <input
                                        type="text"
                                        value={ex.vietnamese}
                                        onChange={(e) => {
                                            const newExamples = [...exampleEntries];
                                            newExamples[idx].vietnamese = e.target.value;
                                            setExampleEntries(newExamples);
                                        }}
                                        className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded text-white text-sm"
                                        placeholder="Tôi rất khỏe"
                                    />
                                </div>
                                <div className="col-span-1">
                                    {exampleEntries.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setExampleEntries(exampleEntries.filter((_, i) => i !== idx))}
                                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                                        >
                                            <Icon name="delete" size="sm" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Section 4: Related Words */}
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                            <Icon name="hub" size="sm" />
                            Từ liên quan
                        </h4>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">
                                Đồng nghĩa <span className="text-text-secondary">(format: hanzi:pinyin:nghĩa, ...)</span>
                            </label>
                            <input
                                type="text"
                                value={synonyms}
                                onChange={(e) => setSynonyms(e.target.value)}
                                className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white text-sm"
                                placeholder="棒:bàng:tuyệt vời, 佳:jiā:tốt đẹp"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">
                                Trái nghĩa <span className="text-text-secondary">(format: hanzi:pinyin:nghĩa, ...)</span>
                            </label>
                            <input
                                type="text"
                                value={antonyms}
                                onChange={(e) => setAntonyms(e.target.value)}
                                className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white text-sm"
                                placeholder="坏:huài:xấu, 差:chà:kém"
                            />
                        </div>
                    </div>

                    {/* Section 5: Mnemonic */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                            <Icon name="lightbulb" size="sm" />
                            Gợi ý nhớ (Mnemonic)
                        </h4>
                        <textarea
                            value={formData.mnemonic}
                            onChange={(e) => setFormData({ ...formData, mnemonic: e.target.value })}
                            className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white text-sm resize-none"
                            rows={2}
                            placeholder="Ví dụ: Chữ 好 gồm bộ 女 (nữ) và 子 (con), ý nghĩa: một người phụ nữ bế con → điều tốt đẹp..."
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
                                onClick={() => setImportMode('xlsx')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${importMode === 'xlsx'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-white'
                                    }`}
                            >
                                Excel/XLSX
                            </button>
                            <button
                                onClick={() => setImportMode('csv')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${importMode === 'csv'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-white'
                                    }`}
                            >
                                CSV
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
                            accept={importMode === 'json' ? '.json' : importMode === 'xlsx' ? '.xlsx,.xls' : '.csv'}
                            onChange={handleFileImport}
                            className="hidden"
                        />
                        <Icon name="upload_file" className="text-4xl text-text-secondary mx-auto mb-3" />
                        <p className="text-sm text-text-secondary mb-2">
                            Kéo thả file {importMode === 'json' ? 'JSON' : importMode === 'xlsx' ? 'Excel (.xlsx)' : 'CSV'} vào đây hoặc
                        </p>
                        <button className="px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-lg">
                            Chọn File
                        </button>
                    </div>

                    {/* Template Info */}
                    <div className="p-4 bg-surface-highlight rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-white">
                                {importMode === 'xlsx' ? 'Cấu trúc Excel (cột bắt buộc):' : importMode === 'csv' ? 'Cấu trúc CSV:' : 'Cấu trúc JSON:'}
                            </p>
                            {importMode === 'xlsx' && (
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-xs font-medium rounded-lg transition-colors"
                                >
                                    <Icon name="download" size="sm" />
                                    Tải file mẫu
                                </button>
                            )}
                        </div>
                        <pre className="text-xs text-text-secondary bg-background-dark p-3 rounded overflow-x-auto whitespace-pre-wrap">
                            {importMode === 'xlsx'
                                ? 'Cột bắt buộc: hanzi, pinyin, meaningVi, hskLevel\nCột tùy chọn: radical, radicalMeaning, strokeCount, partOfSpeech, tags, mnemonic\n           example1_cn, example1_py, example1_vi, example2_cn...\n           synonym1, synonym2, antonym1, antonym2\n\n💡 Nhấn "Tải file mẫu" để xem cấu trúc đầy đủ với dữ liệu ví dụ'
                                : importMode === 'csv'
                                    ? 'hanzi,pinyin,meaningVi,hskLevel,partOfSpeech\n好,hǎo,tốt thích,1,adj'
                                    : '[{\n  "hanzi": "好",\n  "pinyin": "hǎo",\n  "meaningVi": "tốt, thích",\n  "hskLevel": 1\n}]'
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

            {/* Import Result Modal */}
            <Modal
                isOpen={!!importResult}
                onClose={() => setImportResult(null)}
                title="Kết quả Import"
                size="sm"
                footer={
                    <button
                        onClick={() => setImportResult(null)}
                        className="px-6 py-2 bg-gradient-to-r from-primary to-cyan-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Đóng
                    </button>
                }
            >
                {importResult && (
                    <div className="space-y-4">
                        {/* Success icon */}
                        <div className="flex justify-center">
                            <div className="size-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                <Icon name="check_circle" className="text-4xl text-green-400" />
                            </div>
                        </div>

                        <h3 className="text-center text-lg font-bold text-white">
                            Import hoàn tất!
                        </h3>

                        {/* Stats */}
                        <div className="space-y-3">
                            {/* Created */}
                            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                <div className="size-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <Icon name="add_circle" className="text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-text-secondary">Từ mới thêm thành công</p>
                                    <p className="text-xl font-bold text-green-400">{importResult.created}</p>
                                </div>
                            </div>

                            {/* Skipped */}
                            {importResult.skipped > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <Icon name="skip_next" className="text-amber-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-text-secondary">Bỏ qua (đã tồn tại)</p>
                                        <p className="text-xl font-bold text-amber-400">{importResult.skipped}</p>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {importResult.errors > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <div className="size-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                        <Icon name="error" className="text-red-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-text-secondary">Lỗi (thiếu thông tin)</p>
                                        <p className="text-xl font-bold text-red-400">{importResult.errors}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tip */}
                        {importResult.created === 0 && importResult.skipped > 0 && (
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                                <p className="text-sm text-primary flex items-center gap-2">
                                    <Icon name="lightbulb" size="sm" />
                                    Tất cả từ đều đã tồn tại. Không có từ mới được thêm.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Duplicate Confirmation Modal */}
            <Modal
                isOpen={!!duplicateConfirm}
                onClose={() => setDuplicateConfirm(null)}
                title="Từ vựng đã tồn tại"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => setDuplicateConfirm(null)}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={() => {
                                if (duplicateConfirm) {
                                    handleOpenEdit(duplicateConfirm.vocab);
                                    setDuplicateConfirm(null);
                                }
                            }}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Sửa từ này
                        </button>
                    </>
                }
            >
                {duplicateConfirm && (
                    <div className="space-y-4">
                        {/* Warning icon */}
                        <div className="flex justify-center">
                            <div className="size-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <Icon name="warning" className="text-4xl text-amber-400" />
                            </div>
                        </div>

                        {/* Message */}
                        <div className="text-center space-y-2">
                            <p className="text-white">
                                Từ vựng <span className="text-2xl font-bold text-amber-400 font-chinese">{duplicateConfirm.vocab.hanzi}</span> đã tồn tại trong hệ thống.
                            </p>
                            <p className="text-sm text-text-secondary">
                                Bạn có muốn chuyển sang chế độ <strong className="text-amber-400">Sửa</strong> để cập nhật từ này không?
                            </p>
                        </div>

                        {/* Existing word info */}
                        <div className="p-4 bg-surface-highlight rounded-xl">
                            <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Thông tin hiện có</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-text-secondary">Pinyin: </span>
                                    <span className="text-primary">{duplicateConfirm.vocab.pinyin}</span>
                                </div>
                                <div>
                                    <span className="text-text-secondary">HSK: </span>
                                    <span className="text-white">{duplicateConfirm.vocab.hskLevel}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-text-secondary">Nghĩa: </span>
                                    <span className="text-white">{duplicateConfirm.vocab.meaningVi}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </AdminLayout>
    );
}
