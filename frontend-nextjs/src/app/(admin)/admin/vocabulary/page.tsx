'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import AdminLayout from '@/components/layout/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import Icon from '@/components/common/Icon';
import SpeakerButton from '@/components/common/SpeakerButton';
import { useAuth } from '@/contexts/AuthContext';
import {
    getAllVocabulary,
    createVocabulary,
    updateVocabulary,
    deleteVocabulary,
    importVocabulary,
    validateImport,
    bulkUpdateVocabulary,
    getVocabularyStats,
    deleteAllVocabulary,
    type Vocabulary,
    type ImportVocabularyItem
} from '@/services/adminApi';
import { dictionaryApi } from '@/services/dictionaryApi';
import { HSK_COLORS, POS_COLORS } from '@/constants/vocabulary';
import { highlightWord, getPosColor } from '@/utils/chinese';

const POS_OPTIONS = [
    'Danh từ', 'Danh từ riêng', 'Động từ', 'Tính từ', 'Trạng từ', 
    'Số từ', 'Lượng từ', 'Giới từ', 'Liên từ', 'Đại từ', 
    'Thán từ', 'Trợ từ', 'Cụm từ'
];

/**
 * Format a Vietnamese meaning line by removing numbering and colorizing the part of speech
 */
const renderFormattedMeaning = (text: string) => {
    if (!text) return null;
    
    // Check if the text has numbering like "1. ... 2. ..."
    const hasNumbering = /\d+\./.test(text);
    
    if (hasNumbering) {
        const parts = text.split(/\s*(?:\d+)\.\s*/).filter(p => p.trim());
        
        return (
            <div className="flex flex-col gap-1.5 py-1">
                {parts.map((part, idx) => {
                    const cleanPart = part.trim();
                    const colonIndex = cleanPart.indexOf(':');
                    
                    if (colonIndex > 0) {
                        const pos = cleanPart.substring(0, colonIndex).trim();
                        const meaning = cleanPart.substring(colonIndex + 1).trim();
                        const colorClass = getPosColor(pos);
                        
                        return (
                            <div key={idx} className="flex items-start gap-1 leading-tight">
                                <div className="text-sm">
                                    <span className={`${colorClass} font-bold mr-1.5 uppercase tracking-tighter text-[10px]`}>{pos}:</span>
                                    <span className="text-text-base">{meaning}</span>
                                </div>
                            </div>
                        );
                    }
                    
                    return (
                        <div key={idx} className="flex items-start gap-1 leading-tight">
                            <span className="text-sm text-text-base">{cleanPart}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    // Default formatting for single line without numbering
    const match = text.match(/^([^:]+):/);
    if (match) {
        const pos = match[1].trim();
        const meaning = text.substring(match[0].length).trim();
        const colorClass = getPosColor(pos);

        return (
            <div className="text-sm py-0.5">
                <span className={`${colorClass} font-bold mr-2 uppercase tracking-tighter text-[10px]`}>{pos}:</span>
                <span className="text-text-base">{meaning}</span>
            </div>
        );
    }

    return <span className="text-text-base text-sm">{text}</span>;
}

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
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [importMode, setImportMode] = useState<'json' | 'csv' | 'xlsx'>('xlsx');
    const [importData, setImportData] = useState<ImportVocabularyItem[]>([]);
    const [updateData, setUpdateData] = useState<ImportVocabularyItem[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; skipped: number; merged?: number; errors: number; errorDetails?: { hanzi: string; error: string }[]; skippedDetails?: { hanzi: string; reason: string }[] } | null>(null);
    const [updateResult, setUpdateResult] = useState<{ updated: number; skipped: number; errors: number } | null>(null);
    const [duplicateConfirm, setDuplicateConfirm] = useState<{ message: string; vocab: Vocabulary } | null>(null);
    const [hskStats, setHskStats] = useState<Record<number, number>>({});
    const [importProgress, setImportProgress] = useState<{ active: boolean; message: string; percent?: number }>({ active: false, message: '' });
    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
    const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
    const [isLookingUp, setIsLookingUp] = useState(false);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Detail state
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedVocab, setSelectedVocab] = useState<Vocabulary | null>(null);

    // New states for Single-Sheet import and Duplicate review
    const [importTargetSheet, setImportTargetSheet] = useState<string>('all');
    const [duplicateConfirmImport, setDuplicateConfirmImport] = useState<{ duplicates: string[], total: number } | null>(null);

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
        partOfSpeech: '',
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
    const fetchVocabulary = useCallback(async (page = 1, search?: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await getAllVocabulary({
                page,
                limit: 50,
                hskLevel: filterHsk || undefined,
                search: search !== undefined ? search : searchQuery || undefined,
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
    }, [filterHsk, searchQuery]);

    // Fetch HSK stats from database
    const fetchStats = useCallback(async () => {
        try {
            const stats = await getVocabularyStats();
            const statsMap: Record<number, number> = {};
            stats.forEach(s => { statsMap[s.hskLevel] = s.count; });
            setHskStats(statsMap);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'admin') {
            fetchVocabulary();
            fetchStats();
        }
    }, [fetchVocabulary, fetchStats, isAuthenticated, user]);

    // Auto-scroll to first highlighted search result
    useEffect(() => {
        if (searchQuery && vocabulary.length > 0) {
            const q = searchQuery.toLowerCase();
            const firstMatch = vocabulary.find(item =>
                item.hanzi.toLowerCase().includes(q) ||
                item.pinyin.toLowerCase().includes(q) ||
                (item.meaningVi || '').toLowerCase().includes(q) ||
                (item.meaningEn || '').toLowerCase().includes(q)
            );
            if (firstMatch) {
                // Short timeout to ensure DOM update
                setTimeout(() => {
                    const row = document.getElementById(`vocab-row-${firstMatch.id}`);
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }
    }, [vocabulary, searchQuery]);

    const resetForm = () => {
        setFormData({
            hanzi: '',
            pinyin: '',
            meaningVi: '',
            partOfSpeech: '',
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

    const handleDictionaryLookup = async () => {
        if (!formData.hanzi.trim()) {
            setError('Vui lòng nhập Hán tự để tra cứu');
            return;
        }
        setIsLookingUp(true);
        setError(null);
        try {
            const hanzi = formData.hanzi.trim();
            const result = await dictionaryApi.lookup(hanzi);
            if (result && result.found) {
                setFormData(prev => ({
                    ...prev,
                    pinyin: result.pinyin || prev.pinyin,
                    meaningVi: result.meaningVi || result.meaningEn || prev.meaningVi,
                    meaningEn: result.meaningEn || prev.meaningEn,
                    partOfSpeech: result.partOfSpeech || prev.partOfSpeech,
                    hskLevel: result.hskLevel || prev.hskLevel,
                }));

                const newMeanings = [...meaningEntries];
                if (result.meaningVi || result.meaningEn) {
                    newMeanings[0].meanings = result.meaningVi || result.meaningEn || '';
                    if (result.partOfSpeech) newMeanings[0].partOfSpeech = result.partOfSpeech;
                    setMeaningEntries(newMeanings);
                }

                try {
                    const examples = await dictionaryApi.getExamples(hanzi);
                    if (examples && examples.length > 0) {
                        setExampleEntries(examples.map(ex => ({
                            chinese: ex.chinese,
                            pinyin: ex.pinyin || '',
                            vietnamese: ex.translation || '',
                        })));
                    }
                } catch (e) {
                    console.error('Failed to fetch examples:', e);
                }
            } else {
                setError('Không tìm thấy từ này trong từ điển');
            }
        } catch (err: any) {
            setError(err?.message || 'Lỗi tra từ điển');
        } finally {
            setIsLookingUp(false);
        }
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
            partOfSpeech: (vocab.partOfSpeech || '').toLowerCase(),
            meaningEn: vocab.meaningEn || '',
            radical: vocab.radical || '',
            radicalMeaning: vocab.radicalMeaning || '',
            strokeCount: vocab.strokeCount !== undefined ? String(vocab.strokeCount) : '',
            hskLevel: vocab.hskLevel,
            tags: Array.isArray(vocab.tags) ? vocab.tags.join(', ') : (vocab.tags || ''),
            mnemonic: vocab.mnemonic || '',
        });
        
        // Load meanings if available
        const vocabMeanings = (vocab as any).meanings;
        if (vocabMeanings && Array.isArray(vocabMeanings) && vocabMeanings.length > 0) {
            setMeaningEntries(vocabMeanings.map((m: any) => ({
                partOfSpeech: (m.partOfSpeech || '').toLowerCase(),
                pinyin: m.pinyin || '',
                meanings: Array.isArray(m.meanings) ? m.meanings.join('; ') : (m.meanings || ''),
            })));
        } else {
            setMeaningEntries([{ 
                partOfSpeech: (vocab.partOfSpeech || '').toLowerCase(), 
                pinyin: vocab.pinyin || '', 
                meanings: vocab.meaningVi || '' 
            }]);
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
            // Build meanings array
            const meanings = meaningEntries
                .filter(m => m.partOfSpeech || m.meanings)
                .map(m => ({
                    partOfSpeech: m.partOfSpeech,
                    pinyin: m.pinyin || formData.pinyin,
                    meanings: m.meanings.split(';').map(s => s.trim()).filter(Boolean),
                }));

            // Use the first one as primary for compatibility
            const primaryMeaning = meanings[0]?.meanings?.join('; ') || formData.meaningVi;
            const primaryPoS = meanings[0]?.partOfSpeech || formData.partOfSpeech;

            // Build examples array
            const examples = exampleEntries
                .filter(e => e.chinese)
                .map(e => ({
                    chinese: e.chinese,
                    pinyin: e.pinyin,
                    vietnamese: e.vietnamese,
                }));

            const vocabData: any = {
                hanzi: formData.hanzi,
                pinyin: formData.pinyin,
                meaningVi: primaryMeaning,
                partOfSpeech: primaryPoS || undefined,
                hskLevel: formData.hskLevel,
                examples: examples,
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

    // Helper: detect HSK level from sheet name
    const getHskLevelFromSheetName = (name: string): number => {
        const trimmed = name.trim();
        const hskMatch = trimmed.match(/^HSK\s*(\d+)/i);
        if (hskMatch) return parseInt(hskMatch[1]);
        if (trimmed.includes('ngoài HSK') || trimmed.includes('Từ vựng ngoài')) return 7;
        if (trimmed.includes('không chia') || trimmed.includes('Không chia cấp')) return 0;
        return 1; // default
    };

    // Helper: parse one sheet row to ImportVocabularyItem using Vietnamese header keys
    // Uses fuzzy matching (includes) for all Vietnamese headers to handle variations
    const parseSheetRow = (row: any, hskLevel: number): ImportVocabularyItem | null => {
        let hanzi = '', pinyin = '', meaningVi = '', partOfSpeech = '', exampleCn = '', examplePy = '', exampleVi = '', synonymRaw = '', antonymRaw = '';
        const unmatchedKeys: string[] = [];

        Object.keys(row).forEach(k => {
            const key = k.trim().toLowerCase();
            const val = String(row[k] || '').trim();
            if (!val) return;

            // Skip STT column
            if (key === 'stt' || key === '__rownum__') return;

            // Hanzi: "từ vựng", "hanzi", "汉字", "chữ hán"
            if (key === 'từ vựng' || key === 'hanzi' || key === '汉字' || key.includes('chữ hán')) {
                hanzi = val;
            }
            // Pinyin: "pinyin", "拼音", "phiên âm ví dụ" is NOT pinyin of the word
            else if ((key === 'pinyin' || key.startsWith('pinyin')) && !key.includes('phiên âm')) {
                pinyin = val;
            }
            // Part of speech: "từ loại", "partofspeech"
            else if (key.includes('từ loại') || key === 'partofspeech' || key === 'pos') {
                partOfSpeech = val;
            }
            // Meaning Vi: "nghĩa", "meaningvi", "ý nghĩa" 
            // IMPORTANT: Must check BEFORE 'đồng nghĩa' and 'trái nghĩa' to avoid false match
            else if (
                (key === 'nghĩa' || key === 'nghia' || key === 'meaningvi' || key.includes('ý nghĩa'))
                && !key.includes('đồng nghĩa') && !key.includes('cận nghĩa') && !key.includes('trái nghĩa')
            ) {
                meaningVi = val;
            }
            // Example Chinese: "ví dụ (chữ hán)", "ví dụ"
            else if (key.includes('ví dụ')) {
                exampleCn = val;
            }
            // Example Pinyin: "phiên âm" (for example sentence)
            else if (key.includes('phiên âm') || (key.startsWith('pinyin') && key.includes('phiên âm'))) {
                examplePy = val;
            }
            // Example Vietnamese: "dịch", "nghĩa tiếng việt"
            else if (key === 'dịch' || key.startsWith('dịch') || key.includes('nghĩa tiếng việt')) {
                exampleVi = val;
            }
            // Synonyms: "từ cận nghĩa", "từ đồng nghĩa", "cận nghĩa", "đồng nghĩa"
            else if (key.includes('cận nghĩa') || key.includes('đồng nghĩa')) {
                synonymRaw = val;
            }
            // Antonyms: "từ trái nghĩa", "trái nghĩa"
            else if (key.includes('trái nghĩa')) {
                antonymRaw = val;
            }
            else {
                unmatchedKeys.push(key);
            }
        });

        // Log unmatched headers once (for debugging)
        if (unmatchedKeys.length > 0 && hanzi) {
            console.debug(`[parseSheetRow] hanzi='${hanzi}': unmatched headers: [${unmatchedKeys.join(', ')}]`);
        }

        if (!hanzi) return null;

        return {
            hanzi,
            pinyin: pinyin || '-',
            meaningVi: meaningVi || '-',
            meaningEn: '',
            partOfSpeech: partOfSpeech || '',
            hskLevel,
            example1_cn: exampleCn || '',
            example1_py: examplePy || '',
            example1_vi: exampleVi || '',
            synonym1: synonymRaw || '',
            antonym1: antonymRaw || '',
        };
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (importMode === 'xlsx') {
            // Parse XLSX - multi-sheet support
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const allItems: ImportVocabularyItem[] = [];

                    // Read configured sheets
                    for (const sheetName of workbook.SheetNames) {
                        if (importTargetSheet !== 'all' && sheetName.trim() !== importTargetSheet) continue;

                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
                        const hskLevel = getHskLevelFromSheetName(sheetName);

                        for (const row of jsonData) {
                            const item = parseSheetRow(row, hskLevel);
                            if (item && item.hanzi) {
                                allItems.push(item);
                            }
                        }
                    }

                    setImportData(allItems);
                    setImportError(allItems.length === 0
                        ? 'Không tìm thấy từ vựng hợp lệ trong file. Kiểm tra cấu trúc cột.'
                        : null
                    );
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
                            pinyin: item.pinyin || '-',
                            meaningVi: item.meaningVi || item.meaning_vi || '-',
                            meaningEn: item.meaningEn || item.meaning_en,
                            partOfSpeech: item.partOfSpeech || item.part_of_speech,
                            hskLevel: item.hskLevel || item.hsk_level || 1,
                        }));
                        setImportData(items.filter((i: ImportVocabularyItem) => i.hanzi));
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
                            item.pinyin = item.pinyin || '-';
                            item.meaningVi = item.meaningVi || '-';
                            return item;
                        });
                        setImportData(items.filter(i => i.hanzi));
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
        setImportProgress({ active: true, message: `Đang kiểm tra từ vựng trùng lặp...` });
        try {
            const validation = await validateImport(importData);
            if (validation.duplicates.length > 0) {
                setDuplicateConfirmImport(validation);
                setImportProgress({ active: false, message: '' });
                setIsSaving(false);
            } else {
                await executeImport('skip');
            }
        } catch (err: any) {
            console.error('Failed to validate vocabulary:', err);
            setImportError(err?.message || 'Kiểm tra thất bại. Vui lòng thử lại.');
            setImportProgress({ active: false, message: '' });
            setIsSaving(false);
        }
    };

    const executeImport = async (duplicateAction: 'skip' | 'overwrite') => {
        setIsSaving(true);
        setDuplicateConfirmImport(null);
        setImportProgress({ active: true, message: `Bắt đầu import ${importData.length} từ vựng...`, percent: 0 });

        try {
            const CHUNK_SIZE = 500;
            const totalItems = importData.length;
            const chunks = [];

            for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
                chunks.push(importData.slice(i, i + CHUNK_SIZE));
            }

            const aggregatedResult: {
                created: number; skipped: number; merged: number; errors: number;
                errorDetails: { hanzi: string; error: string }[];
                skippedDetails: { hanzi: string; reason: string }[];
            } = { created: 0, skipped: 0, merged: 0, errors: 0, errorDetails: [], skippedDetails: [] };
            let processedItems = 0;

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const result = await importVocabulary(chunk, duplicateAction);

                aggregatedResult.created += result.created;
                aggregatedResult.skipped += result.skipped;
                aggregatedResult.merged += (result.merged || 0);
                aggregatedResult.errors += result.errors;
                if (result.errorDetails) aggregatedResult.errorDetails.push(...result.errorDetails);
                if (result.skippedDetails) aggregatedResult.skippedDetails.push(...result.skippedDetails);

                processedItems += chunk.length;
                const percent = Math.round((processedItems / totalItems) * 100);

                setImportProgress({
                    active: true,
                    message: `Đang import... (${processedItems}/${totalItems})`,
                    percent
                });
            }

            setShowImportModal(false);
            setImportData([]);
            setImportProgress({ active: false, message: '' });
            fetchVocabulary(1);
            fetchStats();

            // Show aggregated result in modal
            setImportResult(aggregatedResult);
        } catch (err: any) {
            console.error('Failed to import vocabulary:', err);
            setImportError(err?.message || 'Import thất bại. Vui lòng thử lại.');
            setImportProgress({ active: false, message: '' });
        } finally {
            setIsSaving(false);
        }
    };

    // Update file handler (multi-sheet support, same as import)
    const handleUpdateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const allItems: ImportVocabularyItem[] = [];

                // Read ALL sheets
                for (const sheetName of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
                    const hskLevel = getHskLevelFromSheetName(sheetName);

                    for (const row of jsonData) {
                        const item = parseSheetRow(row, hskLevel);
                        if (item && item.hanzi) {
                            allItems.push(item);
                        }
                    }
                }

                setUpdateData(allItems);
                setImportError(allItems.length === 0
                    ? 'Không tìm thấy từ vựng hợp lệ trong file.'
                    : null
                );
            } catch (err) {
                console.error('XLSX parse error:', err);
                setImportError('Không thể đọc file XLSX. Vui lòng kiểm tra định dạng.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleUpdateConfirm = async () => {
        setIsSaving(true);
        setError(null);
        setImportProgress({ active: true, message: `Đang cập nhật ${updateData.length} từ vựng...` });
        try {
            const result = await bulkUpdateVocabulary(updateData);

            setShowUpdateModal(false);
            setUpdateData([]);
            setImportProgress({ active: false, message: '' });
            fetchVocabulary(pagination.page);
            fetchStats();

            // Show result
            setUpdateResult(result);
        } catch (err: any) {
            console.error('Failed to update vocabulary:', err);
            setImportError(err?.message || 'Cập nhật thất bại. Vui lòng thử lại.');
            setImportProgress({ active: false, message: '' });
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

    // Download template file (multi-sheet, matching customer XLSX format)
    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();

        // Column widths for standard sheets
        const standardCols = [
            { wch: 5 },   // STT
            { wch: 10 },  // TỪ VỰNG
            { wch: 12 },  // PINYIN
            { wch: 18 },  // TỪ LOẠI
            { wch: 30 },  // NGHĨA
            { wch: 25 },  // VÍ DỤ (CHỮ HÁN)
            { wch: 25 },  // PHIÊN ÂM
            { wch: 30 },  // DỊCH
            { wch: 20 },  // TỪ CẬN NGHĨA
            { wch: 20 },  // TỪ TRÁI NGHĨA
        ];

        // Sample data for HSK1 sheet
        const hsk1Data = [
            { 'STT': 1, 'TỪ VỰNG': '爱', 'PINYIN': 'ài', 'TỪ LOẠI': 'Động từ / danh từ', 'NGHĨA': 'quý, yêu, thương', 'VÍ DỤ (CHỮ HÁN)': '我爱你。', 'PHIÊN ÂM': 'Wǒ ài nǐ.', 'DỊCH': 'Tôi yêu bạn.', 'TỪ CẬN NGHĨA': '爱情, 喜爱, 热爱', 'TỪ TRÁI NGHĨA': '恨, 讨厌' },
            { 'STT': 2, 'TỪ VỰNG': '好', 'PINYIN': 'hǎo', 'TỪ LOẠI': 'Tính từ', 'NGHĨA': 'tốt, đẹp, khỏe', 'VÍ DỤ (CHỮ HÁN)': '你好！', 'PHIÊN ÂM': 'Nǐ hǎo!', 'DỊCH': 'Xin chào!', 'TỪ CẬN NGHĨA': '棒, 佳', 'TỪ TRÁI NGHĨA': '坏, 差' },
        ];

        // Create sheets for HSK1-6
        const sheetNames = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
        sheetNames.forEach((name, idx) => {
            const data = idx === 0 ? hsk1Data : [
                { 'STT': 1, 'TỪ VỰNG': '', 'PINYIN': '', 'TỪ LOẠI': '', 'NGHĨA': '', 'VÍ DỤ (CHỮ HÁN)': '', 'PHIÊN ÂM': '', 'DỊCH': '', 'TỪ CẬN NGHĨA': '', 'TỪ TRÁI NGHĨA': '' }
            ];
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = standardCols;
            XLSX.utils.book_append_sheet(wb, ws, name);
        });

        // Sheet 7: Từ vựng ngoài HSK tiêu chuẩn
        const extraData = [
            { 'STT': 1, 'TỪ VỰNG': '', 'PINYIN': '', 'TỪ LOẠI': '', 'NGHĨA': '', 'VÍ DỤ (CHỮ HÁN)': '', 'PHIÊN ÂM': '', 'DỊCH': '', 'TỪ ĐỒNG NGHĨA': '', 'TỪ TRÁI NGHĨA': '' }
        ];
        const wsExtra = XLSX.utils.json_to_sheet(extraData);
        wsExtra['!cols'] = standardCols;
        XLSX.utils.book_append_sheet(wb, wsExtra, 'Từ vựng ngoài HSK tiêu chuẩn');

        // Sheet 8: Từ vựng không chia cấp độ (fewer columns)
        const nolevelData = [
            { 'STT': 1, 'TỪ VỰNG': '', 'PINYIN': '', 'NGHĨA': '', 'VÍ DỤ (CHỮ HÁN)': '', 'PHIÊN ÂM': '', 'DỊCH': '' }
        ];
        const wsNoLevel = XLSX.utils.json_to_sheet(nolevelData);
        wsNoLevel['!cols'] = [
            { wch: 5 },   // STT
            { wch: 10 },  // TỪ VỰNG
            { wch: 12 },  // PINYIN
            { wch: 30 },  // NGHĨA
            { wch: 25 },  // VÍ DỤ
            { wch: 25 },  // PHIÊN ÂM
            { wch: 30 },  // DỊCH
        ];
        XLSX.utils.book_append_sheet(wb, wsNoLevel, 'Từ vựng không chia cấp độ');

        // Download
        XLSX.writeFile(wb, 'BANG_TU_VUNG_HSK_Template.xlsx');
    };

    // Filter vocabulary
    // Search debounce handler - clears HSK filter for global search
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (value.trim()) {
            // When searching, clear HSK filter to search globally
            setFilterHsk('');
        }
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            fetchVocabulary(1, value);
        }, 400);
    };

    // Highlight matching text
    const highlightText = (text: string, query: string) => {
        if (!query || !text) return text;
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        return (
            <>
                {text.slice(0, idx)}
                <span className="bg-amber-500/40 text-white rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
                {text.slice(idx + query.length)}
            </>
        );
    };

    // Delete all vocabulary handler
    const handleDeleteAll = async () => {
        setIsSaving(true);
        setImportProgress({ active: true, message: 'Đang xóa toàn bộ từ vựng...' });
        try {
            const result = await deleteAllVocabulary();
            setShowDeleteAllConfirm(false);
            setDeleteAllConfirmText('');
            setImportProgress({ active: false, message: '' });
            fetchVocabulary(1);
            fetchStats();
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Xóa thất bại.');
            setImportProgress({ active: false, message: '' });
        } finally {
            setIsSaving(false);
        }
    };

    // Pass server data directly (no duplicate client-side filter)
    const filteredVocabulary = vocabulary;

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
            width: '160px',
            sortable: true,
            render: (vocab: Vocabulary) => (
                <div className="flex flex-col min-w-0">
                    <span className="text-xl font-bold text-text-base font-chinese whitespace-nowrap overflow-hidden text-ellipsis" lang="zh-CN">
                        {searchQuery ? highlightText(vocab.hanzi, searchQuery) : vocab.hanzi}
                    </span>
                    <span className="text-xs text-primary/80 mt-0.5 font-pinyin tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        {searchQuery ? highlightText(vocab.pinyin, searchQuery) : vocab.pinyin}
                    </span>
                </div>
            ),
        },
        {
            key: 'partOfSpeech',
            header: 'Từ loại',
            width: '100px',
            render: (vocab: Vocabulary) => {
                if (!vocab.partOfSpeech) {
                    return <span className="text-text-secondary italic text-xs">-</span>;
                }
                const tags = vocab.partOfSpeech.split(/[\/,]/).map(t => t.trim()).filter(Boolean);
                return (
                    <div className="flex flex-wrap gap-1 max-w-[90px]">
                        {tags.map((tag, idx) => (
                            <span key={idx} className="text-[9px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20 uppercase tracking-tighter">
                                {tag}
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            key: 'meaning',
            header: 'Nghĩa (Các biến thể)',
            width: '280px',
            render: (vocab: Vocabulary) => {
                const multi = (vocab.meanings as any[]) || [];
                if (multi.length > 0) {
                    return (
                        <div className="flex flex-col gap-1 min-w-[200px]">
                            {/* Primary meaning */}
                            {renderFormattedMeaning(vocab.meaningVi || vocab.meaningEn || '-')}
                            
                            {/* Variants */}
                            {multi.map((m, idx) => (
                                <div key={idx} className="border-t border-border-color/30 pt-1 mt-1">
                                    <div className="text-[10px] text-primary/60 font-pinyin mb-0.5">({m.pinyin})</div>
                                    {renderFormattedMeaning(`${m.partOfSpeech ? m.partOfSpeech + ': ' : ''}${Array.isArray(m.meanings) ? m.meanings.join(', ') : m.meanings}`)}
                                </div>
                            ))}
                        </div>
                    );
                }
                return renderFormattedMeaning(vocab.meaningVi || vocab.meaningEn || '-');
            },
        },
        {
            key: 'examples',
            header: 'Ví dụ',
            width: '250px',
            render: (vocab: Vocabulary) => {
                const examples = vocab.examples as Array<{ chinese?: string; pinyin?: string; vietnamese?: string }> | null;
                if (!examples || examples.length === 0) return <span className="text-text-secondary text-sm">-</span>;
                const first = examples[0];
                return (
                    <div className="text-sm">
                        <p className="text-text-base font-chinese">{highlightWord(first.chinese || "", vocab.hanzi)}</p>
                        <p className="text-primary/70 text-xs font-pinyin">{highlightWord(first.pinyin || "", vocab.pinyin)}</p>
                        <p className="text-text-secondary text-xs">{first.vietnamese}</p>
                    </div>
                );
            },
        },
        {
            key: 'relatedWords',
            header: 'Cận nghĩa / Trái nghĩa',
            width: '160px',
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
                                <span className="text-green-300 font-chinese">{synonyms.slice(0, 3).map(s => s.hanzi).join(', ')}</span>
                            </div>
                        )}
                        {hasAntonyms && (
                            <div className="flex items-center gap-1">
                                <span className="text-red-400">↔</span>
                                <span className="text-red-300 font-chinese">{antonyms.slice(0, 3).map(a => a.hanzi).join(', ')}</span>
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'hskLevel',
            header: 'HSK',
            width: '70px',
            render: (vocab: Vocabulary) => (
                <div className="flex justify-center">
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border whitespace-nowrap ${
                        vocab.hskLevel <= 2 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        vocab.hskLevel <= 4 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        vocab.hskLevel <= 6 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                        {vocab.hskLevel === 0 ? 'N/A' : vocab.hskLevel === 7 ? 'EXT' : `HSK ${vocab.hskLevel}`}
                    </span>
                </div>
            ),
        },
    ];

    const actions = (vocab: Vocabulary) => (
        <div className="flex items-center justify-center gap-0.5" onClick={e => e.stopPropagation()}>
            <SpeakerButton
                text={vocab.hanzi}
                size="sm"
            />
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(vocab);
                }}
                className="inline-flex items-center justify-center p-2 rounded-full hover:bg-amber-500/20 text-amber-400 transition-all hover:scale-110 active:scale-95"
                title="Sửa"
            >
                <Icon name="edit" className="text-lg" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(vocab.id);
                }}
                className="inline-flex items-center justify-center p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-all hover:scale-110 active:scale-95"
                title="Xóa"
            >
                <Icon name="delete" className="text-lg" />
            </button>
        </div>
    );

    return (
        <AdminLayout
            title="Quản lý Từ vựng"
            actions={
                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <button
                            className="flex items-center gap-2 px-4 py-2 bg-surface-dark border border-border-color text-text-base font-medium rounded-lg hover:bg-surface-highlight transition-colors"
                        >
                            <Icon name="download" />
                            Export
                            <Icon name="expand_more" className="text-sm" />
                        </button>
                        <div className="absolute right-0 mt-2 w-40 py-2 bg-surface-dark border border-border-color rounded-lg shadow-xl hidden group-hover:block z-10">
                            <button
                                onClick={handleExportCSV}
                                className="w-full px-4 py-2 text-left text-sm text-text-base hover:bg-surface-highlight"
                            >
                                Export CSV
                            </button>
                            <button
                                onClick={handleExportJSON}
                                className="w-full px-4 py-2 text-left text-sm text-text-base hover:bg-surface-highlight"
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
                        onClick={() => setShowUpdateModal(true)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50"
                    >
                        <Icon name="sync" />
                        Cập nhật
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

            {/* Progress Bar */}
            {importProgress.active && (
                <div className="mb-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-primary font-medium">{importProgress.message}</p>
                        </div>
                        {importProgress.percent !== undefined && (
                            <span className="text-sm font-bold text-primary">{importProgress.percent}%</span>
                        )}
                    </div>
                    <div className="w-full h-2 bg-background-dark rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full transition-all duration-300 relative overflow-hidden"
                            style={{ width: `${importProgress.percent || 100}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 0].map((level) => {
                    const count = hskStats[level] || 0;
                    const label = level === 0 ? 'Không chia cấp' : level === 7 ? 'Ngoài HSK' : `HSK ${level}`;
                    return (
                        <button
                            key={level}
                            onClick={() => setFilterHsk(filterHsk === level ? '' : level)}
                            className={`p-3 rounded-xl border transition-all ${filterHsk === level
                                ? 'bg-primary/20 border-primary scale-105'
                                : 'bg-surface-dark border-border-color hover:border-primary/30'
                                }`}
                        >
                            <p className="text-xl font-bold text-text-base">{count}</p>
                            <p className="text-[10px] text-text-secondary leading-tight">{label}</p>
                        </button>
                    );
                })}
            </div>
            {/* Total + Delete All */}
            <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-text-secondary">
                    Tổng: <span className="text-text-base font-bold">{Object.values(hskStats).reduce((a, b) => a + b, 0)}</span> từ vựng
                </p>
                <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    disabled={isSaving}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                    Xóa toàn bộ để import lại
                </button>
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
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Tìm kiếm từ vựng (Hanzi, Pinyin, nghĩa)..."
                        className="w-full pl-12 pr-4 py-3 bg-surface-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                    />
                </div>
                {filterHsk && (
                    <button
                        onClick={() => setFilterHsk('')}
                        className="flex items-center gap-2 px-4 py-3 bg-primary/20 text-primary rounded-xl whitespace-nowrap"
                    >
                        {filterHsk === 7 ? 'Ngoài HSK' : filterHsk === 0 ? 'Không chia cấp' : `HSK ${filterHsk}`}
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
                onPageChange={(page) => fetchVocabulary(page)}
                onRowClick={(vocab: Vocabulary) => {
                    setSelectedVocab(vocab);
                    setShowDetailModal(true);
                }}
                actions={actions}
                emptyMessage="Chưa có từ vựng nào"
                rowId={(item: Vocabulary) => `vocab-row-${item.id}`}
                rowClassName={(item: Vocabulary) => {
                    if (!searchQuery) return '';
                    const q = searchQuery.toLowerCase();
                    const isMatch = item.hanzi.toLowerCase().includes(q) ||
                        item.pinyin.toLowerCase().includes(q) ||
                        (item.meaningVi || '').toLowerCase().includes(q) ||
                        (item.meaningEn || '').toLowerCase().includes(q);
                    return isMatch ? 'bg-primary/20 border-l-4 border-primary' : '';
                }}
            />

            {/* Vocabulary Detail Modal */}
            <Modal
                isOpen={showDetailModal}
                onClose={() => {
                    setShowDetailModal(false);
                    setSelectedVocab(null);
                }}
                title="Chi tiết từ vựng"
                size="lg"
            >
                {selectedVocab && (
                    <div className="space-y-6">
                        {/* Bento-style Header Section */}
                        <div className="bg-surface-highlight/10 border border-border-color/30 rounded-3xl p-8 text-center relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                            
                            <h2 className="text-7xl font-chinese text-text-base mb-2 leading-none drop-shadow-lg">{selectedVocab.hanzi}</h2>
                            <p className="text-3xl font-pinyin text-primary mb-6 tracking-wide drop-shadow-md">{selectedVocab.pinyin}</p>
                            
                            <div className="flex flex-wrap justify-center gap-3">
                                {selectedVocab.hskLevel > 0 && (
                                    <div className={`px-4 py-1.5 ${HSK_COLORS[selectedVocab.hskLevel] || 'bg-gray-500'} bg-opacity-20 border-none text-text-base text-xs font-black rounded-full uppercase tracking-widest shadow-sm flex items-center gap-2`}>
                                        <span className="opacity-60 text-[10px]">LEVEL</span>
                                        HSK {selectedVocab.hskLevel}
                                    </div>
                                )}
                                {selectedVocab.partOfSpeech && (
                                    <div className="px-4 py-1.5 bg-surface-dark border border-border-color text-text-secondary text-xs font-black rounded-full uppercase tracking-widest shadow-sm flex items-center gap-2">
                                        <Icon name="category" size="sm" className="opacity-40" />
                                        {selectedVocab.partOfSpeech}
                                    </div>
                                )}
                            </div>

                            {selectedVocab.meaningVi && (
                                <div className="mt-8 p-4 bg-surface-dark/60 rounded-2xl border border-border-color/30 inline-block min-w-[300px] text-left">
                                    <div className="space-y-2">
                                        {selectedVocab.meaningVi.includes('1.') ? (
                                            selectedVocab.meaningVi.split(/(?=\d+\.)/).map((part, i) => (
                                                <div key={i} className="text-xl font-medium leading-relaxed">
                                                    {renderFormattedMeaning(part)}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-2xl text-text-base font-semibold tracking-tight text-center">
                                                {selectedVocab.meaningVi}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Grid: Radical, Strokes, Tags (Strokes removed) */}
                        <div className="grid grid-cols-1 gap-4">
                            {(selectedVocab.radical || selectedVocab.radicalMeaning) && (
                                <div className="bg-surface-dark border border-border-color rounded-xl p-4">
                                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Icon name="category" size="sm" />
                                        Bộ thủ
                                    </h4>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-chinese text-text-base">{selectedVocab.radical || '-'}</span>
                                        <span className="text-sm text-text-secondary">{selectedVocab.radicalMeaning}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mnemonics */}
                        {selectedVocab.mnemonic && (
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Icon name="lightbulb" size="sm" />
                                    Gợi ý nhớ
                                </h4>
                                <p className="text-sm text-text-base italic whitespace-pre-wrap">{selectedVocab.mnemonic}</p>
                            </div>
                        )}

                        {/* Examples Section - Partitioned Visual Blocks */}
                        {selectedVocab.examples && selectedVocab.examples.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                                    <div className="w-8 h-px bg-border-color" />
                                    CÁC VÍ DỤ CÂU
                                    <div className="flex-1 h-px bg-border-color" />
                                </h4>
                                <div className="grid gap-4">
                                    {selectedVocab.examples.map((ex, idx) => (
                                        <div key={idx} className="bg-surface-highlight/10 border border-border-color/40 rounded-3xl p-6 hover:border-primary/30 transition-all group relative overflow-hidden">
                                            <div className="absolute top-4 right-4 text-[10px] font-black text-primary/60 tracking-tighter uppercase pointer-events-none">
                                                VÍ DỤ {idx + 1}
                                            </div>
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex-1 space-y-3">
                                                    <p className="text-2xl font-chinese text-text-base leading-snug" lang="zh-CN">
                                                        {highlightWord(ex.chinese || "", selectedVocab.hanzi)}
                                                    </p>
                                                    <div className="space-y-1">
                                                        <p className="text-primary font-pinyin text-lg tracking-tight opacity-80">
                                                            {highlightWord(ex.pinyin || "", selectedVocab.pinyin)}
                                                        </p>
                                                        <p className="text-text-secondary text-base italic border-l-2 border-primary/20 pl-4 py-1">{ex.vietnamese}</p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 pt-1 group-hover:scale-110 transition-transform">
                                                    <SpeakerButton text={ex.chinese} size="sm" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Synonyms / Antonyms */}
                        <div className="grid grid-cols-2 gap-4">
                            {selectedVocab.synonyms && selectedVocab.synonyms.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                        <Icon name="double_arrow" size="sm" />
                                        Đồng nghĩa
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedVocab.synonyms.map((s, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20 text-sm font-chinese">
                                                {s.hanzi}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {selectedVocab.antonyms && selectedVocab.antonyms.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                        <Icon name="swap_horiz" size="sm" />
                                        Trái nghĩa
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedVocab.antonyms.map((a, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-red-500/10 text-red-400 rounded-full border border-red-500/20 text-sm font-chinese">
                                                {a.hanzi}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tags */}
                        {selectedVocab.tags && selectedVocab.tags.length > 0 && (
                            <div className="pt-4 border-t border-border-color flex flex-wrap gap-2">
                                {selectedVocab.tags.map((tag, idx) => (
                                    <span key={idx} className="text-[10px] text-text-secondary bg-surface-dark px-2 py-0.5 rounded border border-border-color">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title={editingVocab ? 'Chỉnh sửa Từ vựng' : 'Thêm Từ vựng mới'}
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
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
                    <div className="bg-surface-highlight/30 border border-border-color rounded-xl p-4 space-y-4">
                        <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                            <Icon name="info" size="sm" />
                            Thông tin cơ bản
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center justify-between text-xs font-medium text-text-secondary mb-1">
                                    <span>Hán tự <span className="text-red-400">*</span></span>
                                    <button
                                        type="button"
                                        onClick={handleDictionaryLookup}
                                        disabled={isLookingUp || !formData.hanzi.trim()}
                                        className="text-[10px] flex items-center gap-1 text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
                                    >
                                        {isLookingUp ? <span className="size-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/> : <Icon name="search" size="sm" className="text-[14px]" />}
                                        Tra từ điển
                                    </button>
                                </label>
                                <input
                                    type="text"
                                    value={formData.hanzi}
                                    onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-text-base text-2xl font-chinese font-bold"
                                    placeholder="好"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">
                                    Pinyin <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.pinyin}
                                    onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-text-base"
                                    placeholder="hǎo"
                                    required
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
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-text-base"
                                >
                                    {[1, 2, 3, 4, 5, 6].map((level) => (
                                        <option key={level} value={level}>HSK {level}</option>
                                    ))}
                                    <option value={7}>Ngoài tiêu chuẩn (HSK 7+)</option>
                                    <option value={0}>Không chia cấp độ</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Meanings & Parts of Speech */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                <Icon name="translate" size="sm" />
                                Nghĩa và Loại từ
                            </h4>
                        </div>
                        
                        <div className="space-y-4">
                            {meaningEntries.map((entry, idx) => (
                                <div key={idx} className="relative bg-background-dark/50 p-3 rounded-lg border border-border-color/50 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1.5">Loại từ (Chọn nhiều)</label>
                                            <div className="flex flex-wrap gap-1.5 p-1 bg-background-dark/30 rounded border border-border-color/30">
                                                {POS_OPTIONS.map(pos => {
                                                    const currentTags = entry.partOfSpeech.split(/[\/,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
                                                    const isSelected = currentTags.includes(pos.toLowerCase());
                                                    const colorClass = getPosColor(pos);
                                                    
                                                    return (
                                                        <button
                                                            key={pos}
                                                            type="button"
                                                            onClick={() => {
                                                                const currentTagsRaw = entry.partOfSpeech.split(/[\/,]/).map(t => t.trim()).filter(Boolean);
                                                                let nextTags;
                                                                if (isSelected) {
                                                                    nextTags = currentTagsRaw.filter(p => p.toLowerCase() !== pos.toLowerCase());
                                                                } else {
                                                                    nextTags = [...currentTagsRaw, pos];
                                                                }
                                                                const newEntries = [...meaningEntries];
                                                                newEntries[idx].partOfSpeech = nextTags.join(', ');
                                                                setMeaningEntries(newEntries);
                                                            }}
                                                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                                                isSelected 
                                                                    ? `${colorClass.replace('text-', 'bg-').replace('-400', '-500/20').replace('-300', '-500/20')} ${colorClass} border-current ring-1 ring-current/30` 
                                                                    : 'bg-background-dark/50 text-text-secondary border-border-color hover:border-text-secondary'
                                                            }`}
                                                        >
                                                            {pos}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Pinyin (nếu khác {formData.pinyin})</label>
                                            <input
                                                type="text"
                                                value={entry.pinyin}
                                                onChange={(e) => {
                                                    const newEntries = [...meaningEntries];
                                                    newEntries[idx].pinyin = e.target.value;
                                                    setMeaningEntries(newEntries);
                                                }}
                                                className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded-lg text-text-base text-sm font-pinyin"
                                                placeholder={formData.pinyin || "hǎo"}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Dịch nghĩa (cách nhau bởi dấu chấm phẩy)</label>
                                        <textarea
                                            value={entry.meanings}
                                            onChange={(e) => {
                                                const newEntries = [...meaningEntries];
                                                newEntries[idx].meanings = e.target.value;
                                                setMeaningEntries(newEntries);
                                            }}
                                            className="w-full px-2 py-1.5 bg-background-dark border border-border-color rounded-lg text-text-base text-sm min-h-[60px]"
                                            placeholder="tốt; đẹp; khỏe"
                                            required={idx === 0}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 3: Examples */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                <Icon name="format_quote" size="sm" />
                                Ví dụ tiêu biểu
                            </h4>
                            <button
                                type="button"
                                onClick={() => setExampleEntries([...exampleEntries, { chinese: '', pinyin: '', vietnamese: '' }])}
                                className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                            >
                                + Thêm ví dụ
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {exampleEntries.map((ex, idx) => (
                                <div key={idx} className="relative bg-background-dark/50 p-3 rounded-lg border border-border-color/50 space-y-3">
                                    {exampleEntries.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setExampleEntries(exampleEntries.filter((_, i) => i !== idx))}
                                            className="absolute top-2 right-2 p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                        >
                                            <Icon name="delete" size="sm" />
                                        </button>
                                    )}
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Câu bằng chữ Hán</label>
                                            <input
                                                type="text"
                                                value={ex.chinese}
                                                onChange={(e) => {
                                                    const newExamples = [...exampleEntries];
                                                    newExamples[idx].chinese = e.target.value;
                                                    setExampleEntries(newExamples);
                                                }}
                                                className="w-full px-3 py-1.5 bg-background-dark border border-border-color rounded-lg text-text-base text-sm font-chinese"
                                                placeholder="我很好"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Phiên âm (Pinyin)</label>
                                                <input
                                                    type="text"
                                                    value={ex.pinyin}
                                                    onChange={(e) => {
                                                        const newExamples = [...exampleEntries];
                                                        newExamples[idx].pinyin = e.target.value;
                                                        setExampleEntries(newExamples);
                                                    }}
                                                    className="w-full px-3 py-1.5 bg-background-dark border border-border-color rounded-lg text-text-base text-sm font-pinyin"
                                                    placeholder="wǒ hěn hǎo"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Dịch nghĩa</label>
                                                <input
                                                    type="text"
                                                    value={ex.vietnamese}
                                                    onChange={(e) => {
                                                        const newExamples = [...exampleEntries];
                                                        newExamples[idx].vietnamese = e.target.value;
                                                        setExampleEntries(newExamples);
                                                    }}
                                                    className="w-full px-3 py-1.5 bg-background-dark border border-border-color rounded-lg text-text-base text-sm"
                                                    placeholder="Tôi rất khỏe"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 4: Related Words */}
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                            <Icon name="hub" size="sm" />
                            Từ cận nghĩa / trái nghĩa
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">
                                    Từ cận nghĩa
                                </label>
                                <input
                                    type="text"
                                    value={synonyms}
                                    onChange={(e) => setSynonyms(e.target.value)}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-white text-sm"
                                    placeholder="棒, 佳"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">
                                    Từ trái nghĩa
                                </label>
                                <input
                                    type="text"
                                    value={antonyms}
                                    onChange={(e) => setAntonyms(e.target.value)}
                                    className="w-full px-3 py-2 bg-background-dark border border-border-color rounded-lg text-text-base text-sm"
                                    placeholder="坏, 差"
                                />
                            </div>
                        </div>
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
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
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
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleImportConfirm}
                            disabled={importData.length === 0 || isSaving}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {isSaving ? 'Đang import...' : `Import ${importData.length} từ`}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-4 mb-4">
                        <span className="text-sm text-text-secondary">Định dạng:</span>
                        <div className="flex items-center gap-1 bg-background-dark rounded-lg p-1 border border-border-color">
                            <button
                                onClick={() => setImportMode('xlsx')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${importMode === 'xlsx'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-text-base'
                                    }`}
                            >
                                Excel/XLSX
                            </button>
                            <button
                                onClick={() => setImportMode('csv')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${importMode === 'csv'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-text-base'
                                    }`}
                            >
                                CSV
                            </button>
                            <button
                                onClick={() => setImportMode('json')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${importMode === 'json'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-text-base'
                                    }`}
                            >
                                JSON
                            </button>
                        </div>
                    </div>

                    {/* Target Sheet Selector (XLSX only) */}
                    {importMode === 'xlsx' && (
                        <div className="flex items-center gap-4 mb-4">
                            <span className="text-sm text-text-secondary">Chọn Sheet Import:</span>
                            <select
                                value={importTargetSheet}
                                onChange={(e) => setImportTargetSheet(e.target.value)}
                                className="px-3 py-2 bg-background-dark border border-border-color rounded-lg text-text-base text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="all">Tất cả các Sheet</option>
                                <option value="HSK1">HSK1</option>
                                <option value="HSK2">HSK2</option>
                                <option value="HSK3">HSK3</option>
                                <option value="HSK4">HSK4</option>
                                <option value="HSK5">HSK5</option>
                                <option value="HSK6">HSK6</option>
                                <option value="HSK7">Ngoài tiêu chuẩn</option>
                                <option value="HSK0">Không chia cấp độ</option>
                            </select>
                        </div>
                    )}

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
                    <div className="p-4 bg-surface-highlight/10 border border-border-color rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-text-base">
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
                        <pre className="text-xs text-text-secondary bg-background-dark p-3 rounded border border-border-color/30 overflow-x-auto whitespace-pre-wrap">
                            {importMode === 'xlsx'
                                ? 'File XLSX gồm nhiều sheet (HSK1-6, Ngoài HSK, Không chia cấp)\nCột bắt buộc: TỪ VỰNG, PINYIN, NGHĨA\nCột tùy chọn: TỪ LOẠI, VÍ DỤ (CHỮ HÁN), PHIÊN ÂM, DỊCH,\n              TỪ CẬN NGHĨA/TỪ ĐỒNG NGHĨA, TỪ TRÁI NGHĨA\n\n💡 HSK level tự động xác định từ tên sheet\n💡 Nhấn "Tải file mẫu" để tải template chuẩn'
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
                            <p className="text-sm font-medium text-text-base mb-2">
                                Xem trước ({importData.length} từ):
                            </p>
                            <div className="max-h-48 overflow-y-auto border border-border-color rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-background-dark sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-text-secondary">Từ vựng</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">Pinyin</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">Nghĩa</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">HSK</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-color">
                                        {importData.slice(0, 10).map((item, index) => (
                                            <tr key={index} className="border-b border-border-color/30 last:border-0">
                                                <td className="px-3 py-2 text-text-base font-chinese">{item.hanzi}</td>
                                                <td className="px-3 py-2 text-primary font-pinyin">{item.pinyin}</td>
                                                <td className="px-3 py-2 text-text-secondary">{item.meaningVi}</td>
                                                <td className="px-3 py-2 text-text-secondary">{item.hskLevel}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {importData.length > 10 && (
                                    <p className="px-3 py-2 text-xs text-text-secondary text-center bg-background-dark mt-auto">
                                        ...và {importData.length - 10} từ khác
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Duplicate Review Modal */}
            <Modal
                isOpen={!!duplicateConfirmImport}
                onClose={() => setDuplicateConfirmImport(null)}
                title="Phát hiện từ vựng trùng lặp"
                size="md"
                footer={
                    <>
                        <button
                            onClick={() => executeImport('skip')}
                            disabled={isSaving}
                            className="px-4 py-2 bg-surface-highlight/20 text-text-base border border-border-color rounded-lg hover:bg-surface-highlight/30 transition-colors disabled:opacity-50"
                        >
                            Chỉ thêm từ mới (Bỏ qua trùng)
                        </button>
                        <button
                            onClick={() => executeImport('overwrite')}
                            disabled={isSaving}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            Ghi đè tất cả (Cập nhật trùng)
                        </button>
                    </>
                }
            >
                {duplicateConfirmImport && (
                    <div className="space-y-4">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <Icon name="warning" className="text-amber-400 text-xl" />
                                <h3 className="text-amber-400 font-bold">Trùng lặp dữ liệu</h3>
                            </div>
                            <p className="text-sm text-text-secondary">
                                Tệp import chứa <strong className="text-white">{duplicateConfirmImport.total}</strong> từ vựng.
                                Phát hiện <strong className="text-amber-400">{duplicateConfirmImport.duplicates.length}</strong> Hán tự đã tồn tại trong hệ thống.
                            </p>
                            <p className="text-sm text-text-secondary mt-2">
                                Bạn muốn xử lý các từ trùng lặp này như thế nào?
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-text-base mb-2">
                                Xem trước một số từ trùng:
                            </p>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-background-dark border border-border-color rounded-lg">
                                {duplicateConfirmImport.duplicates.slice(0, 20).map((hanzi, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-surface-highlight text-primary rounded text-sm font-chinese">
                                        {hanzi}
                                    </span>
                                ))}
                                {duplicateConfirmImport.duplicates.length > 20 && (
                                    <span className="px-2 py-1 text-text-secondary text-sm italic">
                                        ...+{duplicateConfirmImport.duplicates.length - 20} từ khác
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Import Result Modal */}
            <Modal
                isOpen={!!importResult}
                onClose={() => setImportResult(null)}
                title="Kết quả Import"
                size="lg"
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

                        <h3 className="text-center text-lg font-bold text-text-base">
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

                            {/* Merged */}
                            {importResult.merged !== undefined && importResult.merged > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                    <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Icon name="merge_type" className="text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-text-secondary">Gộp vào từ có sẵn (Nhiều nghĩa)</p>
                                        <p className="text-xl font-bold text-blue-400">{importResult.merged}</p>
                                    </div>
                                </div>
                            )}

                            {/* Skipped */}
                            {importResult.skipped > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <Icon name="skip_next" className="text-amber-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-text-secondary">Bỏ qua (đã tồn tại / không thao tác)</p>
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

                        {/* Error Details */}
                        {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-red-400 flex items-center gap-1">
                                    <Icon name="error" size="sm" /> Chi tiết lỗi ({importResult.errorDetails.length})
                                </h4>
                                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/5">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-surface-secondary">
                                            <tr>
                                                <th className="text-left p-2 text-text-secondary">Hanzi</th>
                                                <th className="text-left p-2 text-text-secondary">Lỗi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResult.errorDetails.map((e, i) => (
                                                <tr key={i} className="border-t border-red-500/10">
                                                    <td className="p-2 font-chinese text-text-base">{e.hanzi}</td>
                                                    <td className="p-2 text-red-300">{e.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Skipped Details */}
                        {importResult.skippedDetails && importResult.skippedDetails.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1">
                                    <Icon name="info" size="sm" /> Chi tiết bỏ qua ({importResult.skippedDetails.length})
                                </h4>
                                <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-500/20 bg-amber-500/5">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-surface-secondary">
                                            <tr>
                                                <th className="text-left p-2 text-text-secondary">Hanzi</th>
                                                <th className="text-left p-2 text-text-secondary">Lý do</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResult.skippedDetails.slice(0, 100).map((s, i) => (
                                                <tr key={i} className="border-t border-amber-500/10">
                                                    <td className="p-2 font-chinese text-text-base">{s.hanzi}</td>
                                                    <td className="p-2 text-amber-300">{s.reason}</td>
                                                </tr>
                                            ))}
                                            {importResult.skippedDetails.length > 100 && (
                                                <tr>
                                                    <td colSpan={2} className="p-2 text-center text-text-secondary italic">
                                                        ... và {importResult.skippedDetails.length - 100} từ khác
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

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
                            <p className="text-text-base">
                                Từ vựng <span className="text-2xl font-bold text-amber-500 font-chinese">{duplicateConfirm.vocab.hanzi}</span> đã tồn tại trong hệ thống.
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
                                    <span className="text-text-base font-bold">{duplicateConfirm.vocab.hskLevel}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-text-secondary">Nghĩa: </span>
                                    <span className="text-text-base">{duplicateConfirm.vocab.meaningVi}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete All Confirmation Modal */}
            <Modal
                isOpen={showDeleteAllConfirm}
                onClose={() => {
                    setShowDeleteAllConfirm(false);
                    setDeleteAllConfirmText('');
                }}
                title="Xóa toàn bộ Từ vựng"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowDeleteAllConfirm(false);
                                setDeleteAllConfirmText('');
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleDeleteAll}
                            disabled={isSaving || deleteAllConfirmText.toLowerCase() !== 'xác nhận xóa'}
                            className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {isSaving ? 'Đang xóa...' : 'Xóa tất cả'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex justify-center">
                        <div className="size-16 rounded-full bg-red-500/20 flex items-center justify-center">
                            <Icon name="delete_forever" className="text-4xl text-red-400" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-text-base">
                            Bạn có chắc muốn xóa <span className="text-red-500 font-black">{Object.values(hskStats).reduce((a, b) => a + b, 0)}</span> từ vựng?
                        </p>
                        <p className="text-sm text-text-secondary">
                            Hành động này không thể hoàn tác. Bạn sẽ cần import lại file XLSX sau khi xóa.
                        </p>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm text-text-secondary mb-2 text-center">
                            Vui lòng nhập <strong className="text-red-500">xác nhận xóa</strong> để tiếp tục
                        </label>
                        <input
                            type="text"
                            value={deleteAllConfirmText}
                            onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                            className="w-full px-4 py-2 bg-background-dark border border-border-color rounded-lg text-text-base text-center focus:outline-none focus:border-red-500 transition-colors"
                            placeholder="xác nhận xóa"
                        />
                    </div>
                </div>
            </Modal>

            {/* Bulk Update Modal */}
            <Modal
                isOpen={showUpdateModal}
                onClose={() => {
                    setShowUpdateModal(false);
                    setUpdateData([]);
                    setImportError(null);
                }}
                title="Cập nhật Từ vựng hàng loạt"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowUpdateModal(false);
                                setUpdateData([]);
                                setImportError(null);
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleUpdateConfirm}
                            disabled={updateData.length === 0 || isSaving}
                            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {isSaving ? 'Đang cập nhật...' : `Cập nhật ${updateData.length} từ`}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* Info Banner */}
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                        <div className="flex items-start gap-3">
                            <Icon name="info" className="text-purple-400 mt-0.5" />
                            <div className="text-sm">
                                <p className="text-purple-300 font-medium mb-1">Hướng dẫn Cập nhật:</p>
                                <ul className="text-text-secondary space-y-1 list-disc list-inside">
                                    <li>Upload file XLSX chứa các từ cần <strong className="text-purple-400">cập nhật</strong></li>
                                    <li>Chỉ những từ <strong className="text-purple-400">đã tồn tại</strong> sẽ được cập nhật</li>
                                    <li>Từ không có trong cơ sở dữ liệu sẽ bị bỏ qua</li>
                                    <li>Cột <code className="text-purple-400">hanzi</code> là key để tìm từ cần update</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div
                        className="border-2 border-dashed border-purple-500/30 rounded-xl p-8 text-center hover:border-purple-500/50 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('updateFileInput')?.click()}
                    >
                        <input
                            id="updateFileInput"
                            type="file"
                            accept=".xlsx"
                            className="hidden"
                            onChange={handleUpdateFileUpload}
                        />
                        <Icon name="sync" className="text-4xl text-purple-400 mb-3" />
                        <p className="text-sm text-text-secondary mb-2">
                            Kéo thả file Excel (.xlsx) vào đây hoặc
                        </p>
                        <button className="px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-lg">
                            Chọn File
                        </button>
                    </div>

                    {/* Error */}
                    {importError && (
                        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{importError}</p>
                        </div>
                    )}

                    {/* Preview */}
                    {updateData.length > 0 && (
                        <div>
                            <p className="text-sm font-medium text-white mb-2">
                                Xem trước ({updateData.length} từ sẽ được cập nhật):
                            </p>
                            <div className="max-h-48 overflow-y-auto border border-border-color rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-background-dark sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-text-secondary">Hanzi</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">Pinyin</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">Nghĩa</th>
                                            <th className="px-3 py-2 text-left text-text-secondary">HSK</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-color">
                                        {updateData.slice(0, 10).map((item, index) => (
                                            <tr key={index} className="border-b border-border-color/30 last:border-0 hover:bg-surface-highlight/5 transition-colors">
                                                <td className="px-3 py-2 text-text-base font-chinese">{item.hanzi}</td>
                                                <td className="px-3 py-2 text-primary font-pinyin">{item.pinyin}</td>
                                                <td className="px-3 py-2 text-text-secondary">{item.meaningVi}</td>
                                                <td className="px-3 py-2 text-text-base font-bold">{item.hskLevel}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {updateData.length > 10 && (
                                <p className="text-xs text-text-secondary mt-1">
                                    ...và {updateData.length - 10} từ khác
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Update Result Modal */}
            <Modal
                isOpen={!!updateResult}
                onClose={() => setUpdateResult(null)}
                title="Kết quả Cập nhật"
                size="sm"
                footer={
                    <button
                        onClick={() => setUpdateResult(null)}
                        className="px-6 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Đóng
                    </button>
                }
            >
                {updateResult && (
                    <div className="space-y-4">
                        {/* Success icon */}
                        <div className="flex justify-center">
                            <div className="size-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <Icon name="sync" className="text-4xl text-purple-400" />
                            </div>
                        </div>

                        <h3 className="text-center text-lg font-bold text-text-base">
                            Cập nhật hoàn tất!
                        </h3>

                        {/* Stats */}
                        <div className="space-y-3">
                            {/* Updated */}
                            <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <div className="size-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Icon name="edit" className="text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-text-secondary">Từ đã cập nhật</p>
                                    <p className="text-xl font-bold text-purple-400">{updateResult.updated}</p>
                                </div>
                            </div>

                            {/* Skipped */}
                            {updateResult.skipped > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <Icon name="skip_next" className="text-amber-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-text-secondary">Bỏ qua (chưa tồn tại)</p>
                                        <p className="text-xl font-bold text-amber-400">{updateResult.skipped}</p>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {updateResult.errors > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <div className="size-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                        <Icon name="error" className="text-red-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-text-secondary">Lỗi</p>
                                        <p className="text-xl font-bold text-red-400">{updateResult.errors}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tip */}
                        {updateResult.updated === 0 && updateResult.skipped > 0 && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <p className="text-sm text-amber-400 flex items-center gap-2">
                                    <Icon name="lightbulb" size="sm" />
                                    Không có từ nào được cập nhật vì tất cả từ trong file chưa tồn tại trong database.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </AdminLayout>
    );
}
