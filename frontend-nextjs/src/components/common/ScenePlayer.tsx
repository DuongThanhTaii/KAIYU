'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Icon from './Icon';
import SpeakerButton from './SpeakerButton';
import { type DialogFlow, type DialogNode, type DialogChoice } from '@/services/scenesApi';

interface ScenePlayerProps {
    sceneName: string;
    sceneNameVi: string;
    dialogFlow: DialogFlow;
    onComplete: (score: number, choices: string[]) => void;
    onClose: () => void;
}

const ScenePlayer: React.FC<ScenePlayerProps> = ({
    sceneName,
    sceneNameVi,
    dialogFlow,
    onComplete,
    onClose,
}) => {
    const [currentNodeId, setCurrentNodeId] = useState<string>('start');
    const [choiceHistory, setChoiceHistory] = useState<string[]>([]);
    const [totalScore, setTotalScore] = useState(0);
    const [correctChoices, setCorrectChoices] = useState(0);
    const [showPinyin, setShowPinyin] = useState(true);
    const [showVi, setShowVi] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    const currentNode: DialogNode | undefined = dialogFlow[currentNodeId];

    // Handle choice selection
    const handleChoice = useCallback((choice: DialogChoice) => {
        if (isAnimating) return;

        setIsAnimating(true);
        setChoiceHistory(prev => [...prev, choice.text]);

        if (choice.correct) {
            setCorrectChoices(prev => prev + 1);
        }

        // Animate transition
        setTimeout(() => {
            const nextNode = dialogFlow[choice.next];

            if (nextNode?.isEnd) {
                // Scene completed - calculate real score based on correct choices
                // +1 because this choice hasn't been added to history yet
                const totalChoices = choiceHistory.length + 1;
                const totalCorrect = choice.correct ? correctChoices + 1 : correctChoices;
                const finalScore = Math.round((totalCorrect / totalChoices) * 100);
                setTotalScore(finalScore);
                setCurrentNodeId(choice.next);
            } else {
                setCurrentNodeId(choice.next);
            }
            setIsAnimating(false);
        }, 300);
    }, [dialogFlow, correctChoices, choiceHistory.length, isAnimating]);

    // Handle scene completion
    const handleComplete = useCallback(() => {
        onComplete(totalScore, choiceHistory);
    }, [totalScore, choiceHistory, onComplete]);

    // Get score color
    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-400';
        if (score >= 70) return 'text-yellow-400';
        if (score >= 50) return 'text-orange-400';
        return 'text-red-400';
    };

    // Get score emoji
    const getScoreEmoji = (score: number) => {
        if (score >= 90) return '🌟';
        if (score >= 70) return '👍';
        if (score >= 50) return '💪';
        return '📚';
    };

    if (!currentNode) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-text-secondary">Scene not found</p>
            </div>
        );
    }

    return (
        <div className="bg-surface-dark rounded-3xl border border-border-color shadow-2xl overflow-hidden max-w-2xl w-full mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-color bg-background-dark">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Icon name="theater_comedy" className="text-xl text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">{sceneName}</h2>
                        <p className="text-text-secondary text-sm">{sceneNameVi}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle buttons */}
                    <button
                        onClick={() => setShowPinyin(!showPinyin)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${showPinyin
                            ? 'bg-primary/20 text-primary'
                            : 'bg-surface-highlight text-text-secondary'
                            }`}
                    >
                        Pinyin
                    </button>
                    <button
                        onClick={() => setShowVi(!showVi)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${showVi
                            ? 'bg-primary/20 text-primary'
                            : 'bg-surface-highlight text-text-secondary'
                            }`}
                    >
                        Việt
                    </button>
                    <button
                        onClick={onClose}
                        className="size-8 rounded-full bg-surface-highlight hover:bg-red-500/20 flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors"
                    >
                        <Icon name="close" size="sm" />
                    </button>
                </div>
            </div>

            {/* Dialog content */}
            <div className={`p-6 transition-opacity duration-300 ${isAnimating ? 'opacity-50' : 'opacity-100'}`}>
                {currentNode.isEnd ? (
                    // End screen
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">{getScoreEmoji(totalScore)}</div>
                        <h3 className="text-2xl font-bold text-white mb-2">Hoàn thành!</h3>
                        <div className="flex items-center justify-center gap-2 mb-6">
                            <span className={`text-5xl font-bold ${getScoreColor(totalScore)}`}>
                                {totalScore}
                            </span>
                            <span className="text-text-secondary text-xl">/100</span>
                        </div>

                        {/* Stats */}
                        <div className="flex justify-center gap-8 mb-6 text-sm">
                            <div>
                                <p className="text-text-secondary">Số bước</p>
                                <p className="text-white font-bold text-lg">{choiceHistory.length}</p>
                            </div>
                            <div>
                                <p className="text-text-secondary">Câu đúng</p>
                                <p className="text-green-400 font-bold text-lg">{correctChoices}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleComplete}
                            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary text-black font-bold rounded-full hover:bg-primary-hover transition-colors"
                        >
                            <span>Tiếp tục</span>
                            <Icon name="arrow_forward" size="sm" />
                        </button>
                    </div>
                ) : (
                    // Dialog node
                    <>
                        {/* Speaker */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="size-12 rounded-full bg-surface-highlight flex items-center justify-center">
                                <Icon name="person" className="text-xl text-text-secondary" />
                            </div>
                            <div>
                                <p className="font-bold text-white">{currentNode.speaker}</p>
                                <p className="text-text-secondary text-sm">{currentNode.speakerVi}</p>
                            </div>
                            <SpeakerButton text={currentNode.text} size="md" className="ml-auto" />
                        </div>

                        {/* Dialog bubble */}
                        <div className="bg-background-dark rounded-2xl p-5 mb-6">
                            {showPinyin && (
                                <p className="text-primary text-sm mb-2">{currentNode.pinyin}</p>
                            )}
                            <p className="text-white text-xl font-chinese font-bold mb-2">
                                {currentNode.text}
                            </p>
                            {showVi && (
                                <p className="text-text-secondary italic">"{currentNode.textVi}"</p>
                            )}
                        </div>

                        {/* Choices */}
                        <div className="space-y-3">
                            <p className="text-text-secondary text-sm mb-2">Chọn câu trả lời:</p>
                            {currentNode.choices?.map((choice) => (
                                <div
                                    key={choice.id}
                                    className="flex items-center gap-2 group"
                                >
                                    <button
                                        onClick={() => handleChoice(choice)}
                                        disabled={isAnimating}
                                        className="flex-1 text-left p-4 rounded-xl border border-border-color bg-surface-highlight/30 hover:bg-surface-highlight hover:border-primary transition-all disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                                {choice.id.toUpperCase()}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-white font-chinese group-hover:text-primary transition-colors">
                                                    {choice.text}
                                                </p>
                                                {showVi && (
                                                    <p className="text-text-secondary text-sm">{choice.textVi}</p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                    <SpeakerButton
                                        text={choice.text}
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Progress indicator */}
            {!currentNode.isEnd && (
                <div className="px-6 py-3 border-t border-border-color bg-background-dark flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                        Bước {choiceHistory.length + 1}
                    </span>
                    <div className="flex items-center gap-2">
                        {choiceHistory.length > 0 && (
                            <span className="text-text-secondary">
                                {correctChoices}/{choiceHistory.length} đúng
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScenePlayer;
