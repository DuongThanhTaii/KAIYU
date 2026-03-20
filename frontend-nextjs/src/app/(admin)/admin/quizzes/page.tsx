'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import Icon from '@/components/common/Icon';
import Button from '@/components/common/Button';
import Modal from '@/components/admin/Modal';
import { quizzesApi, type VideoQuiz, type QuizQuestion, type CreateQuestionDto } from '@/services/quizzesApi';
import { videoApi } from '@/services/videoApi';

function QuizContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const videoId = searchParams.get('videoId');

    const [quiz, setQuiz] = useState<VideoQuiz | null>(null);
    const [videoTitle, setVideoTitle] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => { },
    });

    // Add question modal
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [savingQuestion, setSavingQuestion] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
    const [questionForm, setQuestionForm] = useState({
        sentenceHanzi: '',
        blankWord: '',
        option1: '',
        option2: '',
        option3: '',
        meaningVi: '',
    });
    // For click-to-select blank word
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

    // Load quiz for video
    const loadQuiz = useCallback(async () => {
        if (!videoId) return;

        setLoading(true);
        setError(null);
        try {
            const video = await videoApi.getById(videoId);
            setVideoTitle(video.title);

            const existingQuiz = await quizzesApi.getByVideoId(videoId);
            setQuiz(existingQuiz);
        } catch (err) {
            console.error('Failed to load quiz:', err);
            setError('Không thể tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        loadQuiz();
    }, [loadQuiz]);

    // Create quiz manually (empty)
    const handleCreateManual = async () => {
        if (!videoId) return;

        const proceedCreate = async () => {
            setGenerating(true);
            setError(null);
            try {
                const newQuiz = await quizzesApi.create(videoId);
                setQuiz(newQuiz);
            } catch (err) {
                console.error('Failed to create quiz:', err);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errorMsg = (err as any).response?.data?.message || (err as Error).message || 'Không thể tạo tự động.';
                setError('Lỗi tạo bài tập: ' + errorMsg);
            } finally {
                setGenerating(false);
            }
        };

        if (quiz) {
            setConfirmAction({
                isOpen: true,
                message: 'Bạn đã có bài tập cho video này. Việc tạo mới thủ công sẽ xóa toàn bộ câu hỏi hiện tại. Bạn có chắc chắn muốn tiếp tục?',
                onConfirm: proceedCreate,
            });
        } else {
            proceedCreate();
        }
    };

    // Generate quiz from subtitles
    const handleGenerate = async () => {
        if (!videoId) return;

        const proceedGenerate = async () => {
            setGenerating(true);
            setError(null);
            try {
                const newQuiz = await quizzesApi.generate(videoId);
                setQuiz(newQuiz);
            } catch (err) {
                console.error('Failed to generate quiz:', err);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errorMsg = (err as any).response?.data?.message || (err as Error).message || 'Không thể tạo tự động.';
                setError('Lỗi AI: ' + errorMsg);
            } finally {
                setGenerating(false);
            }
        };

        if (quiz) {
            setConfirmAction({
                isOpen: true,
                message: 'Hệ thống sẽ dùng AI để phân tích lại toàn bộ phụ đề và tạo bài tập mới. TOÀN BỘ CÂU HỎI CŨ SẼ BỊ XÓA (nếu AI tạo thành công). Bạn có chắc chắn muốn tiếp tục?',
                onConfirm: proceedGenerate,
            });
        } else {
            proceedGenerate();
        }
    };

    // Publish quiz
    const handlePublish = async () => {
        if (!quiz) return;
        try {
            const updated = await quizzesApi.publish(quiz.id);
            setQuiz(updated);
        } catch (err) {
            console.error('Failed to publish quiz:', err);
        }
    };

    // Delete question
    const handleDeleteQuestion = async (questionId: string) => {
        setConfirmAction({
            isOpen: true,
            message: 'Bạn có chắc chắn muốn xóa câu hỏi này không?',
            onConfirm: async () => {
                try {
                    await quizzesApi.deleteQuestion(questionId);
                    if (quiz) {
                        setQuiz({
                            ...quiz,
                            questions: quiz.questions.filter(q => q.id !== questionId),
                        });
                    }
                } catch (err) {
                    console.error('Failed to delete question:', err);
                }
            }
        });
    };

    // Add question manually
    const handleAddQuestion = async () => {
        if (!quiz) return;
        setSavingQuestion(true);
        try {
            const options = [
                questionForm.blankWord,
                questionForm.option1,
                questionForm.option2,
                questionForm.option3,
            ].filter(o => o.trim() !== '');

            // Shuffle options
            const shuffledOptions = options.sort(() => Math.random() - 0.5);

            const newQuestion = await quizzesApi.addQuestion(quiz.id, {
                sentenceHanzi: questionForm.sentenceHanzi,
                blankWord: questionForm.blankWord,
                blankPosition: questionForm.sentenceHanzi.indexOf(questionForm.blankWord),
                options: shuffledOptions,
                meaningVi: questionForm.meaningVi || undefined,
                sequenceOrder: quiz.questions.length,
            });

            setQuiz({
                ...quiz,
                questions: [...quiz.questions, newQuestion],
            });

            setShowAddQuestion(false);
            setQuestionForm({
                sentenceHanzi: '',
                blankWord: '',
                option1: '',
                option2: '',
                option3: '',
                meaningVi: '',
            });
        } catch (err) {
            console.error('Failed to add question:', err);
            setError('Không thể thêm câu hỏi');
        } finally {
            setSavingQuestion(false);
        }
    };

    // Open edit modal with question data
    const openEditModal = (question: QuizQuestion) => {
        const otherOptions = question.options.filter(o => o !== question.blankWord);
        setEditingQuestion(question);
        setQuestionForm({
            sentenceHanzi: question.sentenceHanzi,
            blankWord: question.blankWord,
            option1: otherOptions[0] || '',
            option2: otherOptions[1] || '',
            option3: otherOptions[2] || '',
            meaningVi: question.meaningVi || '',
        });
    };

    // Save edited question
    const handleSaveEdit = async () => {
        if (!quiz || !editingQuestion) return;
        setSavingQuestion(true);
        try {
            const options = [
                questionForm.blankWord,
                questionForm.option1,
                questionForm.option2,
                questionForm.option3,
            ].filter(o => o.trim() !== '');

            const shuffledOptions = options.sort(() => Math.random() - 0.5);

            const updated = await quizzesApi.updateQuestion(editingQuestion.id, {
                sentenceHanzi: questionForm.sentenceHanzi,
                blankWord: questionForm.blankWord,
                blankPosition: questionForm.sentenceHanzi.indexOf(questionForm.blankWord),
                options: shuffledOptions,
                meaningVi: questionForm.meaningVi || undefined,
            });

            setQuiz({
                ...quiz,
                questions: quiz.questions.map(q => q.id === updated.id ? updated : q),
            });

            setEditingQuestion(null);
            setQuestionForm({
                sentenceHanzi: '',
                blankWord: '',
                option1: '',
                option2: '',
                option3: '',
                meaningVi: '',
            });
        } catch (err) {
            console.error('Failed to update question:', err);
            setError('Không thể cập nhật câu hỏi');
        } finally {
            setSavingQuestion(false);
        }
    };

    // Render sentence with blank
    const renderSentenceWithBlank = (sentence: string, blankWord: string) => {
        return sentence.replace(blankWord, '______');
    };

    // Render preview with highlighted blank positions
    const renderPreview = (sentence: string, blankWord: string) => {
        if (!sentence || !blankWord) return null;
        if (!sentence.includes(blankWord)) {
            return (
                <p className="text-red-400 text-sm">
                    ⚠️ Không tìm thấy &quot;{blankWord}&quot; trong câu. Vui lòng kiểm tra lại.
                </p>
            );
        }
        const parts = sentence.split(blankWord);
        const multipleOccurrences = parts.length > 2;
        return (
            <>
                <p className="text-xl font-chinese text-white">
                    {parts.map((part, index) => (
                        <span key={index}>
                            {part}
                            {index < parts.length - 1 && (
                                <span className="px-2 py-1 mx-1 bg-primary/30 text-primary rounded-lg font-bold border-2 border-dashed border-primary">
                                    ______
                                </span>
                            )}
                        </span>
                    ))}
                </p>
                {multipleOccurrences && (
                    <p className="text-amber-400 text-xs mt-2">
                        💡 Từ &quot;{blankWord}&quot; xuất hiện nhiều lần - tất cả sẽ thành chỗ trống.
                    </p>
                )}
            </>
        );
    };

    // Handle character click for blank word selection
    const handleCharClick = (index: number) => {
        if (selectionStart === null) {
            // Start new selection
            setSelectionStart(index);
            setSelectionEnd(index);
        } else if (selectionEnd === index && selectionStart === index) {
            // Clicked same char - clear selection
            setSelectionStart(null);
            setSelectionEnd(null);
            setQuestionForm({ ...questionForm, blankWord: '' });
        } else {
            // Extend or finalize selection
            const start = Math.min(selectionStart, index);
            const end = Math.max(selectionStart, index);
            setSelectionStart(start);
            setSelectionEnd(end);
            const selected = questionForm.sentenceHanzi.slice(start, end + 1);
            setQuestionForm({ ...questionForm, blankWord: selected });
        }
    };

    // Render clickable sentence for blank word selection
    const renderInteractiveSentence = (sentence: string) => {
        if (!sentence) return <p className="text-text-secondary">Nhập câu tiếng Trung ở trên</p>;

        return (
            <div className="flex flex-wrap gap-0.5">
                {sentence.split('').map((char, index) => {
                    const isSelected = selectionStart !== null && selectionEnd !== null &&
                        index >= Math.min(selectionStart, selectionEnd) &&
                        index <= Math.max(selectionStart, selectionEnd);

                    return (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleCharClick(index)}
                            className={`px-1.5 py-1 rounded text-xl font-chinese transition-all ${isSelected
                                ? 'bg-primary text-white scale-110 shadow-lg'
                                : 'bg-surface-dark text-white hover:bg-surface-highlight hover:scale-105'
                                }`}
                        >
                            {char}
                        </button>
                    );
                })}
            </div>
        );
    };

    // Clear selection when sentence changes
    const handleSentenceChange = (newSentence: string) => {
        setQuestionForm({ ...questionForm, sentenceHanzi: newSentence, blankWord: '' });
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    if (!videoId) {
        return (
            <AdminLayout>
                <p className="text-red-400">Video ID không hợp lệ</p>
                <Button onClick={() => router.push('/admin/videos')} className="mt-4">
                    Quay lại Videos
                </Button>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/admin/videos')}
                        className="inline-flex items-center justify-center p-3 hover:bg-surface-highlight rounded-full transition-colors"
                    >
                        <Icon name="arrow_back" className="text-text-secondary" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Quản lý bài tập</h1>
                        <p className="text-text-secondary text-sm">{videoTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button onClick={handleCreateManual} disabled={generating || loading} variant="secondary" size="sm" className="whitespace-nowrap">
                        {generating ? '...' : (
                            <>
                                <Icon name="add" className="text-[16px]" />
                                Tạo thủ công
                            </>
                        )}
                    </Button>
                    <Button onClick={handleGenerate} disabled={generating || loading} variant="secondary" size="sm" className="whitespace-nowrap bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-none">
                        {generating ? 'Đang tạo bằng AI...' : (
                            <>
                                <Icon name="auto_awesome" className="text-[16px] text-amber-500" />
                                AI Tự động
                            </>
                        )}
                    </Button>
                    <div className="w-px h-6 bg-border-color mx-1"></div>
                    {quiz && !quiz.isPublished && (
                        <Button onClick={handlePublish} variant="primary" size="sm" className="whitespace-nowrap">
                            <Icon name="publish" className="text-lg" />
                            Xuất bản
                        </Button>
                    )}
                    {quiz?.isPublished && (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium whitespace-nowrap">
                            Đã xuất bản
                        </span>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
            )}

            {/* No Quiz */}
            {!loading && !quiz && (
                <div className="bg-surface-dark rounded-2xl border border-border-color p-8 text-center">
                    <Icon name="quiz" className="text-6xl text-text-secondary mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Chưa có bài tập</h2>
                    <p className="text-text-secondary mb-6">
                        Sử dụng các nút phía trên để tạo bài tập thủ công hoặc tự động bằng trí tuệ nhân tạo.
                    </p>
                </div>
            )}

            {/* Quiz Questions */}
            {!loading && quiz && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white">
                            Câu hỏi ({quiz.questions.length})
                        </h2>
                        <div className="flex gap-2">
                            <Button onClick={() => setShowAddQuestion(true)} variant="primary" size="sm">
                                <Icon name="add" className="text-lg" />
                                Thêm câu hỏi
                            </Button>
                        </div>
                    </div>

                    {quiz.questions.length === 0 ? (
                        <div className="bg-surface-dark rounded-xl border border-border-color p-6 text-center">
                            <p className="text-text-secondary">Chưa có câu hỏi. Hãy thêm câu hỏi mới.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {quiz.questions.map((question, index) => (
                                <div
                                    key={question.id}
                                    className="bg-surface-dark rounded-xl border border-border-color p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-sm font-medium">
                                                    Câu {index + 1}
                                                </span>
                                                <span className="px-2 py-0.5 bg-surface-highlight text-text-secondary rounded text-xs">
                                                    Đáp án: {question.blankWord}
                                                </span>
                                            </div>
                                            <p className="text-white text-lg font-chinese">
                                                {renderSentenceWithBlank(question.sentenceHanzi, question.blankWord)}
                                            </p>
                                            {question.meaningVi && (
                                                <p className="text-text-secondary text-sm mt-1">
                                                    {question.meaningVi}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {question.options.map((option, optIdx) => (
                                                    <span
                                                        key={optIdx}
                                                        className={`px-3 py-1 rounded-lg text-sm ${option === question.blankWord
                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                            : 'bg-surface-highlight text-text-secondary'
                                                            }`}
                                                    >
                                                        {option}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => openEditModal(question)}
                                                className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                                title="Chỉnh sửa"
                                            >
                                                <Icon name="edit" className="text-lg" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteQuestion(question.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Xóa"
                                            >
                                                <Icon name="delete" className="text-lg" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add Question Modal */}
            <Modal
                isOpen={showAddQuestion}
                onClose={() => setShowAddQuestion(false)}
                title="Thêm câu hỏi mới"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => setShowAddQuestion(false)}
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleAddQuestion}
                            disabled={savingQuestion || !questionForm.sentenceHanzi || !questionForm.blankWord || !questionForm.sentenceHanzi.includes(questionForm.blankWord)}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50"
                        >
                            {savingQuestion ? 'Đang lưu...' : 'Thêm câu hỏi'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Câu tiếng Trung <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={questionForm.sentenceHanzi}
                            onChange={(e) => handleSentenceChange(e.target.value)}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese text-lg"
                            placeholder="VD: 我今天很高兴"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Chọn từ cần điền <span className="text-red-400">*</span>
                        </label>
                        <div className="p-4 bg-background-dark border border-border-color rounded-xl min-h-[60px]">
                            {renderInteractiveSentence(questionForm.sentenceHanzi)}
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                            👆 Click vào ký tự để chọn. Click ký tự đầu rồi click ký tự cuối để chọn nhiều ký tự.
                        </p>
                        {questionForm.blankWord && (
                            <p className="text-sm text-primary mt-2">
                                ✓ Đã chọn: <span className="font-bold font-chinese">{questionForm.blankWord}</span>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Đáp án sai 1
                            </label>
                            <input
                                type="text"
                                value={questionForm.option1}
                                onChange={(e) => setQuestionForm({ ...questionForm, option1: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese"
                                placeholder="VD: 快乐"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Đáp án sai 2
                            </label>
                            <input
                                type="text"
                                value={questionForm.option2}
                                onChange={(e) => setQuestionForm({ ...questionForm, option2: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese"
                                placeholder="VD: 开心"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Đáp án sai 3
                            </label>
                            <input
                                type="text"
                                value={questionForm.option3}
                                onChange={(e) => setQuestionForm({ ...questionForm, option3: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese"
                                placeholder="VD: 难过"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Nghĩa tiếng Việt (tùy chọn)
                        </label>
                        <input
                            type="text"
                            value={questionForm.meaningVi}
                            onChange={(e) => setQuestionForm({ ...questionForm, meaningVi: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="VD: Hôm nay tôi rất vui"
                        />
                    </div>

                    {/* Preview Section */}
                    {(questionForm.sentenceHanzi && questionForm.blankWord) && (
                        <div className="p-4 bg-surface-highlight rounded-xl border border-border-color">
                            <p className="text-sm font-medium text-text-secondary mb-2">📋 Xem trước câu hỏi:</p>
                            {renderPreview(questionForm.sentenceHanzi, questionForm.blankWord)}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Edit Question Modal */}
            <Modal
                isOpen={!!editingQuestion}
                onClose={() => {
                    setEditingQuestion(null);
                    setQuestionForm({
                        sentenceHanzi: '',
                        blankWord: '',
                        option1: '',
                        option2: '',
                        option3: '',
                        meaningVi: '',
                    });
                }}
                title="Chỉnh sửa câu hỏi"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setEditingQuestion(null);
                                setQuestionForm({
                                    sentenceHanzi: '',
                                    blankWord: '',
                                    option1: '',
                                    option2: '',
                                    option3: '',
                                    meaningVi: '',
                                });
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSaveEdit}
                            disabled={savingQuestion || !questionForm.sentenceHanzi || !questionForm.blankWord}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors disabled:opacity-50"
                        >
                            {savingQuestion ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Câu tiếng Trung <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={questionForm.sentenceHanzi}
                            onChange={(e) => setQuestionForm({ ...questionForm, sentenceHanzi: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese text-lg"
                            placeholder="VD: 我今天很高兴"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Từ cần điền (đáp án đúng) <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={questionForm.blankWord}
                            onChange={(e) => setQuestionForm({ ...questionForm, blankWord: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese"
                            placeholder="VD: 高兴"
                        />
                        <p className="text-xs text-text-secondary mt-1">Từ này phải có trong câu ở trên</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Đáp án sai 1
                            </label>
                            <input
                                type="text"
                                value={questionForm.option1}
                                onChange={(e) => setQuestionForm({ ...questionForm, option1: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese"
                                placeholder="VD: 快乐"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Đáp án sai 2
                            </label>
                            <input
                                type="text"
                                value={questionForm.option2}
                                onChange={(e) => setQuestionForm({ ...questionForm, option2: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese"
                                placeholder="VD: 开心"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Đáp án sai 3
                            </label>
                            <input
                                type="text"
                                value={questionForm.option3}
                                onChange={(e) => setQuestionForm({ ...questionForm, option3: e.target.value })}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors font-chinese"
                                placeholder="VD: 难过"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Nghĩa tiếng Việt (tùy chọn)
                        </label>
                        <input
                            type="text"
                            value={questionForm.meaningVi}
                            onChange={(e) => setQuestionForm({ ...questionForm, meaningVi: e.target.value })}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="VD: Hôm nay tôi rất vui"
                        />
                    </div>

                    {/* Preview Section */}
                    {(questionForm.sentenceHanzi && questionForm.blankWord) && (
                        <div className="p-4 bg-surface-highlight rounded-xl border border-border-color">
                            <p className="text-sm font-medium text-text-secondary mb-2">📋 Xem trước câu hỏi:</p>
                            {renderPreview(questionForm.sentenceHanzi, questionForm.blankWord)}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Confirm Action Modal */}
            <Modal
                isOpen={confirmAction.isOpen}
                onClose={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                title="Xác nhận hành động"
            >
                <div className="p-6">
                    <p className="text-white mb-8 text-center text-lg">{confirmAction.message}</p>
                    <div className="flex justify-center gap-4">
                        <Button
                            variant="secondary"
                            onClick={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="primary"
                            className="bg-red-500 hover:bg-red-600 border-none"
                            onClick={() => {
                                confirmAction.onConfirm();
                                setConfirmAction({ ...confirmAction, isOpen: false });
                            }}
                        >
                            <Icon name="check_circle" className="text-lg" />
                            Xác nhận
                        </Button>
                    </div>
                </div>
            </Modal>
        </AdminLayout>
    );
}

export default function AdminQuizzesPage() {
    return (
        <Suspense fallback={
            <AdminLayout>
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
            </AdminLayout>
        }>
            <QuizContent />
        </Suspense>
    );
}
