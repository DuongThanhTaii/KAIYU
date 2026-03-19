'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Icon from '@/components/common/Icon';
import Button from '@/components/common/Button';
import { quizzesApi, type VideoQuiz, type QuizQuestion } from '@/services/quizzesApi';

export default function QuizPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;

    const [quiz, setQuiz] = useState<VideoQuiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Quiz state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [isQuizComplete, setIsQuizComplete] = useState(false);
    const [answers, setAnswers] = useState<Record<string, { selected: string; correct: boolean }>>({});

    // Load quiz
    const loadQuiz = useCallback(async () => {
        if (!videoId) return;

        setLoading(true);
        setError(null);
        try {
            const data = await quizzesApi.getByVideoId(videoId);
            if (!data || !data.isPublished) {
                setError('Bài tập chưa có sẵn cho video này');
            } else if (data.questions.length === 0) {
                setError('Bài tập không có câu hỏi nào');
            } else {
                setQuiz(data);
            }
        } catch (err) {
            console.error('Failed to load quiz:', err);
            setError('Không thể tải bài tập');
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        loadQuiz();
    }, [loadQuiz]);

    // Current question
    const currentQuestion = quiz?.questions[currentIndex];

    // Handle answer selection
    const handleSelectAnswer = (answer: string) => {
        if (showResult) return;
        setSelectedAnswer(answer);
    };

    // Check answer
    const handleCheckAnswer = () => {
        if (!selectedAnswer || !currentQuestion) return;

        const isCorrect = selectedAnswer === currentQuestion.blankWord;

        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: { selected: selectedAnswer, correct: isCorrect },
        }));

        if (isCorrect) {
            setCorrectCount(prev => prev + 1);
        }

        setShowResult(true);
    };

    // Next question
    const handleNext = () => {
        if (!quiz) return;

        if (currentIndex < quiz.questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setShowResult(false);
        } else {
            setIsQuizComplete(true);
        }
    };

    // Restart quiz
    const handleRestart = () => {
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setCorrectCount(0);
        setIsQuizComplete(false);
        setAnswers({});
    };

    // Render sentence with blank highlighted
    const renderSentenceWithBlank = (sentence: string, blankWord: string) => {
        const parts = sentence.split(blankWord);
        if (parts.length < 2) return sentence;

        return (
            <>
                {parts[0]}
                <span className="px-2 py-1 mx-1 bg-primary/20 text-primary rounded-lg font-bold">
                    {showResult ? blankWord : '______'}
                </span>
                {parts.slice(1).join(blankWord)}
            </>
        );
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    if (error || !quiz) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <Icon name="quiz" className="text-6xl text-text-secondary mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">
                        {error || 'Không có bài tập'}
                    </h2>
                    <p className="text-text-secondary mb-6">
                        Bài tập chưa được tạo hoặc chưa xuất bản
                    </p>
                    <Button onClick={() => router.push(`/learn/${videoId}`)} variant="primary">
                        <Icon name="arrow_back" className="text-lg" />
                        Quay lại video
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    // Quiz complete screen
    if (isQuizComplete) {
        const percentage = Math.round((correctCount / quiz.questions.length) * 100);

        return (
            <DashboardLayout>
                <div className="max-w-2xl mx-auto py-8 px-4">
                    <div className="bg-surface-dark rounded-2xl border border-border-color p-8 text-center">
                        <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${percentage >= 70 ? 'bg-green-500/20' : percentage >= 50 ? 'bg-yellow-500/20' : 'bg-red-500/20'
                            }`}>
                            <Icon
                                name={percentage >= 70 ? 'celebration' : percentage >= 50 ? 'sentiment_neutral' : 'sentiment_dissatisfied'}
                                className={`text-5xl ${percentage >= 70 ? 'text-green-400' : percentage >= 50 ? 'text-yellow-400' : 'text-red-400'
                                    }`}
                            />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">
                            {percentage >= 70 ? 'Xuất sắc!' : percentage >= 50 ? 'Khá tốt!' : 'Cần cố gắng thêm!'}
                        </h2>

                        <p className="text-text-secondary mb-6">
                            Bạn đã trả lời đúng <span className="text-primary font-bold">{correctCount}</span> / {quiz.questions.length} câu
                        </p>

                        <div className="text-6xl font-bold text-primary mb-8">
                            {percentage}%
                        </div>

                        <div className="flex gap-4 justify-center">
                            <Button onClick={handleRestart} variant="secondary">
                                <Icon name="refresh" className="text-lg" />
                                Làm lại
                            </Button>
                            <Button onClick={() => router.push(`/learn/${videoId}`)} variant="primary">
                                <Icon name="arrow_back" className="text-lg" />
                                Về video
                            </Button>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Quiz in progress
    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto py-8 px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => router.push(`/learn/${videoId}`)}
                        className="p-2 rounded-lg hover:bg-surface-highlight transition-colors"
                    >
                        <Icon name="close" className="text-text-secondary text-xl" />
                    </button>
                    <h1 className="text-lg font-bold text-white">Bài tập</h1>
                    <span className="text-sm text-text-secondary">
                        {currentIndex + 1} / {quiz.questions.length}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-surface-dark rounded-full mb-8 overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${((currentIndex + 1) / quiz.questions.length) * 100}%` }}
                    />
                </div>

                {/* Question Card */}
                {currentQuestion && (
                    <div className="bg-surface-dark rounded-2xl border border-border-color p-6">
                        {/* Question */}
                        <p className="text-sm text-primary font-medium mb-2">Điền vào chỗ trống</p>
                        <p className="text-2xl text-white font-chinese leading-relaxed mb-4 tracking-tight" lang="zh-CN">
                            {renderSentenceWithBlank(currentQuestion.sentenceHanzi, currentQuestion.blankWord)}
                        </p>
                        {currentQuestion.meaningVi && (
                            <p className="text-text-secondary text-sm mb-6">
                                {currentQuestion.meaningVi}
                            </p>
                        )}

                        {/* Options */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {currentQuestion.options.map((option, idx) => {
                                const isSelected = selectedAnswer === option;
                                const isCorrect = option === currentQuestion.blankWord;

                                let buttonClass = 'p-4 rounded-xl border-2 text-left transition-all font-chinese text-lg tracking-tight ';

                                if (showResult) {
                                    if (isCorrect) {
                                        buttonClass += 'border-green-500 bg-green-500/20 text-green-400';
                                    } else if (isSelected && !isCorrect) {
                                        buttonClass += 'border-red-500 bg-red-500/20 text-red-400';
                                    } else {
                                        buttonClass += 'border-border-color text-text-secondary';
                                    }
                                } else {
                                    buttonClass += isSelected
                                        ? 'border-primary bg-primary/20 text-white'
                                        : 'border-border-color hover:border-primary/50 text-white';
                                }

                                return (
                                        <button
                                        key={idx}
                                        onClick={() => handleSelectAnswer(option)}
                                        disabled={showResult}
                                        className={buttonClass}
                                        lang="zh-CN"
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Result feedback */}
                        {showResult && (
                            <div className={`p-4 rounded-xl mb-6 ${selectedAnswer === currentQuestion.blankWord
                                    ? 'bg-green-500/10 border border-green-500/30'
                                    : 'bg-red-500/10 border border-red-500/30'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <Icon
                                        name={selectedAnswer === currentQuestion.blankWord ? 'check_circle' : 'cancel'}
                                        className={`text-xl ${selectedAnswer === currentQuestion.blankWord ? 'text-green-400' : 'text-red-400'
                                            }`}
                                    />
                                    <span className={selectedAnswer === currentQuestion.blankWord ? 'text-green-400' : 'text-red-400'}>
                                        {selectedAnswer === currentQuestion.blankWord ? 'Chính xác!' : `Đáp án đúng: ${currentQuestion.blankWord}`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end">
                            {!showResult ? (
                                <Button
                                    onClick={handleCheckAnswer}
                                    disabled={!selectedAnswer}
                                    variant="primary"
                                >
                                    Kiểm tra
                                </Button>
                            ) : (
                                <Button onClick={handleNext} variant="primary">
                                    {currentIndex < quiz.questions.length - 1 ? 'Tiếp theo' : 'Xem kết quả'}
                                    <Icon name="arrow_forward" className="text-lg" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
