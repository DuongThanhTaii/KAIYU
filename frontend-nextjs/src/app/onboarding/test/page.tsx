'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/common/Icon';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';

interface QuizQuestion {
    id: string;
    hanzi: string;
    pinyin: string;
    options: string[];
    correctIndex: number;
}

const quizQuestions: QuizQuestion[] = [
    {
        id: '1',
        hanzi: '你好',
        pinyin: 'Nǐ hǎo',
        options: ['Tạm biệt', 'Xin chào', 'Cảm ơn', 'Xin lỗi'],
        correctIndex: 1,
    },
    {
        id: '2',
        hanzi: '谢谢',
        pinyin: 'Xièxiè',
        options: ['Xin chào', 'Tạm biệt', 'Cảm ơn', 'Làm ơn'],
        correctIndex: 2,
    },
    {
        id: '3',
        hanzi: '再见',
        pinyin: 'Zàijiàn',
        options: ['Hẹn gặp lại', 'Rất vui được gặp bạn', 'Bạn khỏe không?', 'Tạm biệt'],
        correctIndex: 3,
    },
];

export default function OnboardingTestPage() {
    const router = useRouter();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [correctAnswers, setCorrectAnswers] = useState(0);

    const question = quizQuestions[currentQuestion];
    const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;

    const handleSelectAnswer = (index: number) => {
        if (showResult) return;

        setSelectedAnswer(index);
        setShowResult(true);

        if (index === question.correctIndex) {
            setCorrectAnswers(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (currentQuestion < quizQuestions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
            setSelectedAnswer(null);
            setShowResult(false);
        } else {
            // Quiz completed
            router.push('/dashboard');
        }
    };

    const handleSkip = () => {
        router.push('/dashboard');
    };

    return (
        <div className="bg-background-dark text-white font-display min-h-screen flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-border-color">
                <Link href="/onboarding/goals" className="flex items-center gap-3 text-text-secondary hover:text-white transition-colors">
                    <Icon name="arrow_back" />
                    <span className="font-medium">Quay lại</span>
                </Link>
                <div className="flex items-center gap-3">
                    <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-on-primary">
                        <Icon name="translate" size="sm" />
                    </div>
                    <h2 className="text-white text-lg font-bold hidden sm:block">KAIYU</h2>
                </div>
                <button onClick={handleSkip} className="text-text-secondary hover:text-white text-sm font-medium">
                    Bỏ qua
                </button>
            </header>

            {/* Progress Bar */}
            <div className="w-full h-1 bg-surface-dark">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10">
                <div className="w-full max-w-2xl">
                    {/* Question Counter */}
                    <div className="flex justify-center mb-8">
                        <div className="flex items-center gap-2 px-4 py-2 bg-surface-dark rounded-full border border-border-color">
                            <Icon name="quiz" className="text-primary" size="sm" />
                            <span className="text-sm font-bold text-white">
                                Câu {currentQuestion + 1} / {quizQuestions.length}
                            </span>
                        </div>
                    </div>

                    {/* Question Card */}
                    <Card variant="elevated" className="mb-8 text-center">
                        <p className="text-text-secondary text-sm mb-4">Từ này có nghĩa là gì?</p>

                        <div className="py-8">
                            <h2 className="text-6xl md:text-7xl font-bold text-white mb-4">
                                {question.hanzi}
                            </h2>
                            <p className="text-xl text-primary font-medium">{question.pinyin}</p>
                        </div>
                    </Card>

                    {/* Answer Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {question.options.map((option, index) => {
                            let buttonStyle = 'bg-surface-dark border-border-color text-white hover:border-primary/50';

                            if (showResult) {
                                if (index === question.correctIndex) {
                                    buttonStyle = 'bg-green-500/20 border-green-500 text-green-400';
                                } else if (index === selectedAnswer && index !== question.correctIndex) {
                                    buttonStyle = 'bg-red-500/20 border-red-500 text-red-400';
                                } else {
                                    buttonStyle = 'bg-surface-dark border-border-color text-text-secondary opacity-50';
                                }
                            } else if (selectedAnswer === index) {
                                buttonStyle = 'bg-primary/10 border-primary text-white';
                            }

                            return (
                                <button
                                    key={index}
                                    onClick={() => handleSelectAnswer(index)}
                                    disabled={showResult}
                                    className={`p-6 rounded-2xl border-2 text-lg font-bold transition-all flex items-center justify-between ${buttonStyle}`}
                                >
                                    <span>{option}</span>
                                    {showResult && index === question.correctIndex && (
                                        <Icon name="check_circle" className="text-green-400" />
                                    )}
                                    {showResult && index === selectedAnswer && index !== question.correctIndex && (
                                        <Icon name="cancel" className="text-red-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Result & Continue */}
                    {showResult && (
                        <div className="flex flex-col items-center gap-6 animate-fade-in">
                            <div className={`flex items-center gap-3 px-6 py-3 rounded-full ${selectedAnswer === question.correctIndex
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                                }`}>
                                <Icon
                                    name={selectedAnswer === question.correctIndex ? 'celebration' : 'sentiment_dissatisfied'}
                                />
                                <span className="font-bold">
                                    {selectedAnswer === question.correctIndex ? 'Chính xác!' : 'Chưa đúng'}
                                </span>
                            </div>

                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleNext}
                                rightIcon={<Icon name="arrow_forward" />}
                            >
                                {currentQuestion < quizQuestions.length - 1 ? 'Câu tiếp theo' : 'Hoàn thành'}
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
