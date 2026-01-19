'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/common/Icon';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import { learningGoalsApi } from '@/services/learningGoalsApi';
import { authApi } from '@/services/authApi';

interface GoalOption {
    id: string;
    label: string;
    description?: string;
    icon?: string;
}

const hskLevels: GoalOption[] = [
    { id: '1', label: 'HSK 1', description: 'Beginner - 150 từ' },
    { id: '2', label: 'HSK 2', description: 'Elementary - 300 từ' },
    { id: '3', label: 'HSK 3', description: 'Intermediate - 600 từ' },
    { id: '4', label: 'HSK 4', description: 'Upper-Int - 1200 từ' },
    { id: '5', label: 'HSK 5', description: 'Advanced - 2500 từ' },
    { id: '6', label: 'HSK 6', description: 'Proficient - 5000 từ' },
];

const dailyGoals: GoalOption[] = [
    { id: '5', label: '5 phút', description: 'Nhẹ nhàng' },
    { id: '15', label: '15 phút', description: 'Thường xuyên' },
    { id: '30', label: '30 phút', description: 'Chăm chỉ' },
    { id: '60', label: '60 phút', description: 'Chuyên sâu' },
];

const interests: GoalOption[] = [
    { id: 'travel', label: 'Du lịch', icon: 'flight' },
    { id: 'business', label: 'Kinh doanh', icon: 'work' },
    { id: 'culture', label: 'Văn hóa', icon: 'temple_buddhist' },
    { id: 'food', label: 'Ẩm thực', icon: 'restaurant' },
    { id: 'music', label: 'Âm nhạc', icon: 'music_note' },
    { id: 'movies', label: 'Phim ảnh', icon: 'movie' },
];

export default function OnboardingGoalsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [selectedHsk, setSelectedHsk] = useState<string>(String(user?.hskLevel || 3));
    const [selectedDailyGoal, setSelectedDailyGoal] = useState<string>(String(user?.dailyGoalMinutes || 15));
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleInterest = (id: string) => {
        setSelectedInterests(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleContinue = async () => {
        setIsSaving(true);
        setError(null);
        try {
            // Save goals to backend
            await learningGoalsApi.saveGoals({
                hskLevel: parseInt(selectedHsk),
                dailyGoalMinutes: parseInt(selectedDailyGoal),
                interests: selectedInterests,
            });

            // Update profile
            await authApi.updateProfile({
                hskLevel: parseInt(selectedHsk),
                dailyGoalMinutes: parseInt(selectedDailyGoal),
            });

            router.push('/onboarding/test');
        } catch (err: any) {
            setError(err.message || 'Không thể lưu cài đặt. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSkip = () => {
        router.push('/dashboard');
    };

    return (
        <div className="bg-background-dark text-white font-display min-h-screen flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-border-color">
                <Link href="/" className="flex items-center gap-3">
                    <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-on-primary">
                        <Icon name="translate" />
                    </div>
                    <h2 className="text-white text-xl font-bold">KAIYU</h2>
                </Link>
                <button onClick={handleSkip} className="text-text-secondary hover:text-white text-sm font-medium">
                    Bỏ qua
                </button>
            </header>

            {/* Progress Bar */}
            <div className="w-full h-1 bg-surface-dark">
                <div className="h-full bg-primary w-1/2 transition-all" />
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10">
                <div className="w-full max-w-4xl">
                    {/* Title */}
                    <div className="text-center mb-10">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
                            Cá nhân hóa hành trình của bạn
                        </h1>
                        <p className="text-text-secondary text-lg">Cho chúng tôi biết về mục tiêu của bạn để tùy chỉnh trải nghiệm.</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* HSK Level Selection */}
                        <Card variant="default" className="md:row-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Icon name="school" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">Cấp độ mục tiêu</h3>
                                    <p className="text-text-secondary text-sm">Bạn muốn đạt HSK mấy?</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {hskLevels.map((level) => (
                                    <button
                                        key={level.id}
                                        onClick={() => setSelectedHsk(level.id)}
                                        className={`p-4 rounded-xl border text-left transition-all ${selectedHsk === level.id
                                            ? 'bg-primary/10 border-primary text-white'
                                            : 'bg-surface-highlight border-border-color text-text-secondary hover:border-primary/50 hover:text-white'
                                            }`}
                                    >
                                        <div className="font-bold text-lg">{level.label}</div>
                                        <div className="text-xs opacity-70">{level.description}</div>
                                    </button>
                                ))}
                            </div>
                        </Card>

                        {/* Daily Goal Selection */}
                        <Card variant="default">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                                    <Icon name="timer" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">Mục tiêu hàng ngày</h3>
                                    <p className="text-text-secondary text-sm">Bạn có thể dành bao nhiêu thời gian mỗi ngày?</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {dailyGoals.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => setSelectedDailyGoal(goal.id)}
                                        className={`p-3 rounded-xl border text-center transition-all ${selectedDailyGoal === goal.id
                                            ? 'bg-primary/10 border-primary text-white'
                                            : 'bg-surface-highlight border-border-color text-text-secondary hover:border-primary/50 hover:text-white'
                                            }`}
                                    >
                                        <div className="font-bold">{goal.label}</div>
                                        <div className="text-xs opacity-70">{goal.description}</div>
                                    </button>
                                ))}
                            </div>
                        </Card>

                        {/* Interests Selection */}
                        <Card variant="default">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                                    <Icon name="favorite" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">Sở thích</h3>
                                    <p className="text-text-secondary text-sm">Chọn các chủ đề bạn quan tâm</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {interests.map((interest) => (
                                    <button
                                        key={interest.id}
                                        onClick={() => toggleInterest(interest.id)}
                                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${selectedInterests.includes(interest.id)
                                            ? 'bg-primary/10 border-primary text-white'
                                            : 'bg-surface-highlight border-border-color text-text-secondary hover:border-primary/50 hover:text-white'
                                            }`}
                                    >
                                        <Icon name={interest.icon || 'star'} size="lg" />
                                        <div className="text-sm font-medium">{interest.label}</div>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Continue Button */}
                    <div className="mt-8 flex justify-center">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleContinue}
                            rightIcon={<Icon name="arrow_forward" />}
                            className="min-w-[200px]"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Đang lưu...' : 'Tiếp tục'}
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
