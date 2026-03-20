'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi } from '@/services/authApi';
import Icon from '@/components/common/Icon';
import Button from '@/components/common/Button';

export default function SettingsPage() {
    const router = useRouter();
    const { user, logout, updateProfile } = useAuth();
    const {
        themeMode,
        setThemeMode,
        currentPrimaryColor,
        currentBackgroundColor,
        themeConfig,
        presets,
        backgroundPresets,
        setPreset,
        setCustomColor,
        setBackgroundPreset,
        setCustomBackgroundColor,
        resetToDefault
    } = useTheme();

    // Password change state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Settings state
    const [dailyGoal, setDailyGoal] = useState(user?.dailyGoalMinutes || 30);
    const [hskLevel, setHskLevel] = useState(user?.hskLevel || 1);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsSuccess, setSettingsSuccess] = useState(false);
    const [settingsChanged, setSettingsChanged] = useState(false);

    if (!user) {
        return null;
    }

    // Track if settings changed
    const handleDailyGoalChange = (value: number) => {
        setDailyGoal(value);
        setSettingsChanged(value !== user.dailyGoalMinutes || hskLevel !== user.hskLevel);
    };

    const handleHskLevelChange = (value: number) => {
        setHskLevel(value);
        setSettingsChanged(dailyGoal !== user.dailyGoalMinutes || value !== user.hskLevel);
    };

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        setSettingsSuccess(false);
        try {
            await updateProfile({
                dailyGoalMinutes: dailyGoal,
                hskLevel: hskLevel,
            });
            setSettingsSuccess(true);
            setSettingsChanged(false);
            setTimeout(() => setSettingsSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(false);

        if (passwordData.newPassword.length < 6) {
            setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('Mật khẩu xác nhận không khớp');
            return;
        }

        setIsChangingPassword(true);
        try {
            await authApi.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });
            setPasswordSuccess(true);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordSuccess(false);
            }, 2000);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Không thể đổi mật khẩu';
            setPasswordError(errorMessage);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto p-6">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-surface-highlight transition-colors"
                    >
                        <Icon name="arrow_back" className="text-text-secondary" />
                    </button>
                    <h1 className="text-2xl font-bold text-text-base">Cài đặt</h1>
                </div>

                {/* Settings Success Message */}
                {settingsSuccess && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <p className="text-sm text-green-400">Đã lưu cài đặt thành công!</p>
                    </div>
                )}

                {/* Learning Settings */}
                <div className="bg-surface-dark rounded-3xl border border-border-color p-8 mb-6 shadow-sm transition-colors">
                    <h2 className="text-lg font-bold text-text-base mb-6 flex items-center gap-2">
                        <Icon name="school" className="text-primary" />
                        Học tập
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Mục tiêu hàng ngày
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="10"
                                    max="120"
                                    step="5"
                                    value={dailyGoal}
                                    onChange={(e) => handleDailyGoalChange(Number(e.target.value))}
                                    className="flex-1 h-2 bg-border-color/30 dark:bg-background-dark rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <span className="text-text-base font-black w-20 text-right">{dailyGoal} phút</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Cấp độ HSK hiện tại
                            </label>
                            <select
                                value={hskLevel}
                                onChange={(e) => handleHskLevelChange(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-surface-dark border border-border-color rounded-xl text-text-base font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer"
                            >
                                {[1, 2, 3, 4, 5, 6].map((level) => (
                                    <option key={level} value={level}>HSK {level}</option>
                                ))}
                            </select>
                        </div>

                        {settingsChanged && (
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={handleSaveSettings}
                                disabled={isSavingSettings}
                            >
                                {isSavingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Appearance Settings */}
                <div className="bg-surface-dark rounded-3xl border border-border-color p-8 mb-6 shadow-sm transition-colors">
                    <h2 className="text-lg font-bold text-text-base mb-6 flex items-center gap-2">
                        <Icon name="palette" className="text-primary" />
                        Giao diện
                    </h2>

                    <div className="space-y-6">
                        {/* Theme Mode */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-3">
                                Chế độ giao diện
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'light', name: 'Sáng', icon: 'light_mode' },
                                    { id: 'dark', name: 'Tối', icon: 'dark_mode' },
                                    { id: 'system', name: 'Hệ thống', icon: 'settings_brightness' },
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => setThemeMode(mode.id as any)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${themeMode === mode.id
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border-color hover:border-primary/50'
                                            }`}
                                    >
                                        <Icon name={mode.icon} className={themeMode === mode.id ? 'text-primary' : 'text-text-secondary'} size="md" />
                                        <span className={`text-xs ${themeMode === mode.id ? 'text-primary font-black' : 'text-text-secondary font-medium'}`}>
                                            {mode.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Primary Color Presets */}
                        <div className={themeMode === 'light' ? 'opacity-50 pointer-events-none' : ''}>
                            <label className="block text-sm font-medium text-text-secondary mb-3">
                                Màu chủ đạo {themeMode === 'light' && <span className="text-[10px] font-normal ml-2">(Chỉ dành cho chế độ tối)</span>}
                            </label>
                            <div className="grid grid-cols-5 gap-3">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => setPreset(preset.id)}
                                        className={`group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${themeConfig.primaryMode === 'preset' && themeConfig.presetId === preset.id
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border-color hover:border-primary/50'
                                            }`}
                                        title={preset.name}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-full shadow-lg ring-2 ring-white/10"
                                            style={{ backgroundColor: preset.primary }}
                                        />
                                        <span className="text-[10px] text-text-secondary group-hover:text-text-base truncate max-w-full">
                                            {preset.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {/* Custom Primary Color */}
                            <div className="flex items-center gap-4 mt-4">
                                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg cursor-pointer relative">
                                    <input
                                        type="color"
                                        value={currentPrimaryColor}
                                        onChange={(e) => setCustomColor(e.target.value)}
                                        className="absolute inset-0 w-14 h-14 -m-3 cursor-pointer"
                                        title="Chọn màu chủ đạo tùy ý"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-text-base text-sm font-medium">Màu tùy chỉnh</p>
                                    <p className="text-text-secondary text-xs uppercase">{currentPrimaryColor}</p>
                                </div>
                            </div>
                        </div>

                        {/* Background Color Presets */}
                        <div className={themeMode === 'light' ? 'opacity-50 pointer-events-none' : ''}>
                            <label className="block text-sm font-medium text-text-secondary mb-3">
                                Màu nền {themeMode === 'light' && <span className="text-[10px] font-normal ml-2">(Chỉ dành cho chế độ tối)</span>}
                            </label>
                            <div className="grid grid-cols-5 gap-3">
                                {backgroundPresets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => setBackgroundPreset(preset.id)}
                                        className={`group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${themeConfig.backgroundMode === 'preset' && themeConfig.backgroundPresetId === preset.id
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border-color hover:border-primary/50'
                                            }`}
                                        title={preset.name}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg shadow-lg ring-2 ring-white/10"
                                            style={{ backgroundColor: preset.color }}
                                        />
                                        <span className="text-[10px] text-text-secondary group-hover:text-text-base truncate max-w-full">
                                            {preset.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {/* Custom Background Color */}
                            <div className="flex items-center gap-4 mt-4">
                                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg cursor-pointer relative">
                                    <input
                                        type="color"
                                        value={currentBackgroundColor}
                                        onChange={(e) => setCustomBackgroundColor(e.target.value)}
                                        className="absolute inset-0 w-14 h-14 -m-3 cursor-pointer"
                                        title="Chọn màu nền tùy ý"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-text-base text-sm font-medium">Màu tùy chỉnh</p>
                                    <p className="text-text-secondary text-xs uppercase">{currentBackgroundColor}</p>
                                </div>
                            </div>
                        </div>

                        {/* Reset Button */}
                        <button
                            onClick={resetToDefault}
                            className="w-full py-3 text-sm text-text-secondary font-bold hover:text-text-base border border-border-color rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                            Đặt lại về mặc định
                        </button>
                    </div>
                </div>

                {/* Account Settings */}
                <div className="bg-surface-dark rounded-3xl border border-border-color p-8 mb-6 shadow-sm transition-colors">
                    <h2 className="text-lg font-bold text-text-base mb-6 flex items-center gap-2">
                        <Icon name="person" className="text-primary" />
                        Tài khoản
                    </h2>

                    <div className="space-y-4">
                        {/* Email */}
                        <div className="flex items-center justify-between py-3 border-b border-border-color">
                            <div>
                                <p className="text-sm text-text-secondary font-medium">Email</p>
                                <p className="text-text-base font-bold">{user.email}</p>
                            </div>
                            <Icon name="mail" className="text-text-secondary" />
                        </div>

                        {/* Password */}
                        <div>
                            <div
                                className="flex items-center justify-between py-3 cursor-pointer"
                                onClick={() => setShowPasswordForm(!showPasswordForm)}
                            >
                                <div>
                                    <p className="text-sm text-text-secondary font-medium">Mật khẩu</p>
                                    <p className="text-text-base font-bold">••••••••</p>
                                </div>
                                <Icon
                                    name={showPasswordForm ? 'expand_less' : 'chevron_right'}
                                    className="text-text-secondary"
                                />
                            </div>

                            {showPasswordForm && (
                                <form onSubmit={handleChangePassword} className="space-y-4 mt-6 p-6 bg-background-dark rounded-2xl border border-border-color/50">
                                    {passwordError && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <p className="text-sm text-red-400">{passwordError}</p>
                                        </div>
                                    )}
                                    {passwordSuccess && (
                                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                            <p className="text-sm text-green-400">Đổi mật khẩu thành công!</p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm text-text-secondary mb-1">Mật khẩu hiện tại</label>
                                        <input
                                            type="password"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="w-full px-4 py-2 bg-surface-dark border border-border-color rounded-lg text-text-base focus:outline-none focus:border-primary transition-colors"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-text-secondary mb-1">Mật khẩu mới</label>
                                        <input
                                            type="password"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="w-full px-4 py-2 bg-surface-dark border border-border-color rounded-lg text-text-base focus:outline-none focus:border-primary transition-colors"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-text-secondary mb-1">Xác nhận mật khẩu mới</label>
                                        <input
                                            type="password"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="w-full px-4 py-2 bg-surface-dark border border-border-color rounded-lg text-text-base focus:outline-none focus:border-primary transition-colors"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isChangingPassword}
                                        className="w-full py-2 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                                    >
                                        {isChangingPassword ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-500/5 dark:bg-surface-dark rounded-3xl border border-red-500/20 p-8 shadow-sm">
                    <h2 className="text-lg font-bold text-red-500 mb-6 flex items-center gap-2">
                        <Icon name="dangerous" />
                        Vùng nguy hiểm
                    </h2>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 font-bold rounded-xl hover:bg-red-500/20 transition-colors"
                    >
                        <Icon name="logout" />
                        Đăng xuất
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
}
