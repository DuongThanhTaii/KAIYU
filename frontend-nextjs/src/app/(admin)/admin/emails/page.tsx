'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { EditorRef } from 'react-email-editor';

const EmailEditor = dynamic(() => import('react-email-editor').then(mod => mod.EmailEditor), { ssr: false });

import AdminLayout from '@/components/layout/AdminLayout';
import Icon from '@/components/common/Icon';
import { useToastState, ToastContainer } from '@/components/common/Toast';
import {
    getEmailTemplates, upsertEmailTemplate, deleteEmailTemplate,
    seedEmailTemplates, testSendEmail, getEmailStatistics, previewEmailTemplate,
    type EmailTemplate, type EmailStatistics
} from '@/services/emailApi';

// Trigger type options
const triggerTypes = [
    { value: 'inactive_days', label: 'Không hoạt động X ngày', icon: 'schedule' },
    { value: 'daily', label: 'Hàng ngày', icon: 'today' },
    { value: 'weekly', label: 'Hàng tuần', icon: 'calendar_month' },
    { value: 'manual', label: 'Gửi thủ công', icon: 'touch_app' },
];

const daysOfWeek = [
    { value: 0, label: 'Chủ nhật' },
    { value: 1, label: 'Thứ 2' },
    { value: 2, label: 'Thứ 3' },
    { value: 3, label: 'Thứ 4' },
    { value: 4, label: 'Thứ 5' },
    { value: 5, label: 'Thứ 6' },
    { value: 6, label: 'Thứ 7' },
];

// Available variables
const availableVariables = [
    { key: 'userName', label: 'Tên user' },
    { key: 'streakDays', label: 'Số ngày streak' },
    { key: 'dueCount', label: 'Số từ cần ôn' },
    { key: 'weekRange', label: 'Tuần (vd: 13/01-19/01)' },
    { key: 'weeklyXP', label: 'XP tuần' },
    { key: 'vocabLearned', label: 'Từ đã học' },
    { key: 'videosWatched', label: 'Video đã xem' },
    { key: 'inactiveDays', label: 'Số ngày không học' },
    { key: 'appUrl', label: 'Link app' },
];

export default function AdminEmailsPage() {
    const { toasts, showToast, removeToast } = useToastState();
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [statistics, setStatistics] = useState<EmailStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testSending, setTestSending] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [showPreview, setShowPreview] = useState(false);
    const emailEditorRef = useRef<EditorRef>(null);

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        nameVi: '',
        subject: '',
        htmlBody: '',
        textBody: '',
        designJson: null as any,
        variables: [] as string[],
        category: 'reminder',
        isActive: true,
        triggerType: 'inactive_days',
        triggerDays: 3,
        triggerHour: 18,
        triggerDayOfWeek: 0,
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [templatesData, statsData] = await Promise.all([
                getEmailTemplates(),
                getEmailStatistics().catch(() => null),
            ]);
            setTemplates(templatesData);
            setStatistics(statsData);
        } catch (error) {
            showToast('Không thể tải dữ liệu', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreate = () => {
        setSelectedTemplate(null);
        setFormData({
            code: '',
            name: '',
            nameVi: '',
            subject: '',
            htmlBody: '',
            textBody: '',
            designJson: null,
            variables: [],
            category: 'reminder',
            isActive: true,
            triggerType: 'inactive_days',
            triggerDays: 3,
            triggerHour: 18,
            triggerDayOfWeek: 0,
        });
        setIsEditing(true);
        setShowPreview(false);
    };

    const handleEdit = (template: EmailTemplate) => {
        setSelectedTemplate(template);
        setFormData({
            code: template.code,
            name: template.name,
            nameVi: template.nameVi,
            subject: template.subject,
            htmlBody: template.htmlBody,
            textBody: template.textBody || '',
            designJson: template.designJson || null,
            variables: template.variables || [],
            category: template.category,
            isActive: template.isActive,
            triggerType: template.triggerType || 'inactive_days',
            triggerDays: template.triggerDays || 3,
            triggerHour: template.triggerHour || 18,
            triggerDayOfWeek: template.triggerDayOfWeek || 0,
        });
        setIsEditing(true);
        setShowPreview(false);
    };

    const handleSave = async () => {
        if (!formData.code || !formData.nameVi || !formData.subject) {
            showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
            return;
        }

        const saveTemplate = async (htmlBodyToSave: string, designJsonToSave: any) => {
            setSaving(true);
            try {
                await upsertEmailTemplate({
                    ...formData,
                    htmlBody: htmlBodyToSave || formData.htmlBody,
                    designJson: designJsonToSave || formData.designJson
                });
                await fetchData();
                setIsEditing(false);
                setSelectedTemplate(null);
                showToast(selectedTemplate ? 'Đã cập nhật template' : 'Đã tạo template mới', 'success');
            } catch (error) {
                showToast('Lỗi khi lưu template', 'error');
            } finally {
                setSaving(false);
            }
        };

        if (emailEditorRef.current?.editor) {
            emailEditorRef.current.editor.exportHtml((data) => {
                const { design, html } = data;
                setFormData(prev => ({ ...prev, htmlBody: html, designJson: design }));
                saveTemplate(html, design);
            });
        } else {
            saveTemplate(formData.htmlBody, formData.designJson);
        }
    };

    const handleDelete = async (code: string) => {
        if (!confirm('Bạn có chắc muốn xóa template này?')) return;
        try {
            await deleteEmailTemplate(code);
            await fetchData();
            showToast('Đã xóa template', 'success');
        } catch (error) {
            showToast('Lỗi khi xóa template', 'error');
        }
    };

    const handleSeed = async () => {
        try {
            const result = await seedEmailTemplates();
            showToast(result.message, 'success');
            await fetchData();
        } catch (error) {
            showToast('Lỗi khi tạo templates mẫu', 'error');
        }
    };

    const handleTestSend = async (code: string) => {
        setTestSending(code);
        try {
            await testSendEmail(code);
            showToast('Email đã được gửi thành công!', 'success');
        } catch (error) {
            showToast('Lỗi gửi email test', 'error');
        } finally {
            setTestSending(null);
        }
    };

    const handlePreview = async () => {
        // Build preview string based on the current visual editor status if loaded
        if (emailEditorRef.current?.editor) {
            emailEditorRef.current.editor.exportHtml(async (data) => {
                const { html, design } = data;
                setFormData(prev => ({ ...prev, htmlBody: html, designJson: design }));

                try {
                    const result = await previewEmailTemplate(formData.subject, html);
                    setPreviewHtml(result.html);
                    setShowPreview(true);
                } catch (error) {
                    showToast('Lỗi tạo preview', 'error');
                }
            });
        } else {
            try {
                const result = await previewEmailTemplate(formData.subject, formData.htmlBody);
                setPreviewHtml(result.html);
                setShowPreview(true);
            } catch (error) {
                showToast('Lỗi tạo preview', 'error');
            }
        }
    };

    const onEditorLoad = () => {
        if (selectedTemplate?.designJson && emailEditorRef.current?.editor) {
            emailEditorRef.current.editor.loadDesign(selectedTemplate.designJson);
        }
    };

    const insertVariable = (key: string) => {
        const variable = `{{${key}}}`;
        setFormData(prev => ({
            ...prev,
            subject: prev.subject + variable,
        }));
    };

    const getTriggerDescription = (template: EmailTemplate) => {
        switch (template.triggerType) {
            case 'inactive_days':
                return `Gửi khi không học ${template.triggerDays} ngày, lúc ${template.triggerHour}h`;
            case 'daily':
                return `Gửi hàng ngày lúc ${template.triggerHour}h`;
            case 'weekly':
                return `Gửi ${daysOfWeek.find(d => d.value === template.triggerDayOfWeek)?.label || 'CN'} lúc ${template.triggerHour}h`;
            case 'manual':
                return 'Gửi thủ công';
            default:
                return '';
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Quản lý Email">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <>
            <AdminLayout
                title="Quản lý Email Templates"
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCreate}
                            className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-colors flex items-center"
                        >
                            <Icon name="add" className="mr-1" /> Tạo mới
                        </button>
                        <button
                            onClick={handleSeed}
                            className="px-4 py-2 bg-surface-highlight text-white rounded-lg font-medium hover:bg-surface-highlight/80 transition-colors flex items-center"
                        >
                            <Icon name="auto_fix_high" className="mr-1" /> Seed Mẫu
                        </button>
                    </div>
                }
            >
                {/* Statistics Cards */}
                {statistics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-surface-dark rounded-xl border border-border-color p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg inline-flex items-center justify-center cursor-pointer">
                                    <Icon name="send" className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{statistics.summary.totalSent}</p>
                                    <p className="text-xs text-text-secondary">Đã gửi</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-surface-dark rounded-xl border border-border-color p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/10 rounded-lg inline-flex items-center justify-center cursor-pointer">
                                    <Icon name="visibility" className="text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{statistics.summary.openRate}%</p>
                                    <p className="text-xs text-text-secondary">Tỷ lệ mở</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-surface-dark rounded-xl border border-border-color p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-lg inline-flex items-center justify-center cursor-pointer">
                                    <Icon name="touch_app" className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{statistics.summary.clickRate}%</p>
                                    <p className="text-xs text-text-secondary">Tỷ lệ click</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-surface-dark rounded-xl border border-border-color p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/10 rounded-lg inline-flex items-center justify-center cursor-pointer">
                                    <Icon name="error" className="text-red-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{statistics.summary.totalFailed}</p>
                                    <p className="text-xs text-text-secondary">Thất bại</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isEditing ? (
                    /* Edit Form */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form */}
                        <div className="lg:col-span-2 bg-surface-dark rounded-xl border border-border-color p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">
                                    {selectedTemplate ? 'Chỉnh sửa Template' : 'Tạo Template mới'}
                                </h2>
                                <button
                                    onClick={() => { setIsEditing(false); setSelectedTemplate(null); }}
                                    className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
                                >
                                    <Icon name="close" className="text-text-secondary" />
                                </button>
                            </div>

                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Code <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full px-4 py-2 bg-background-dark border border-border-color rounded-lg text-white"
                                        placeholder="vd: welcome_email"
                                        disabled={!!selectedTemplate}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Tên tiếng Việt <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nameVi}
                                        onChange={(e) => setFormData({ ...formData, nameVi: e.target.value })}
                                        className="w-full px-4 py-2 bg-background-dark border border-border-color rounded-lg text-white"
                                        placeholder="vd: Email chào mừng"
                                    />
                                </div>
                            </div>

                            {/* Trigger Settings Card */}
                            <div className="bg-background-dark rounded-xl border border-border-color p-4 mb-6">
                                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <Icon name="schedule" className="text-primary" /> Điều kiện gửi
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs text-text-secondary mb-1">Loại trigger</label>
                                        <select
                                            value={formData.triggerType}
                                            onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                                            className="w-full px-3 py-2 bg-surface-dark border border-border-color rounded-lg text-white text-sm"
                                        >
                                            {triggerTypes.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {formData.triggerType === 'inactive_days' && (
                                        <div>
                                            <label className="block text-xs text-text-secondary mb-1">Sau số ngày</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={formData.triggerDays}
                                                onChange={(e) => setFormData({ ...formData, triggerDays: parseInt(e.target.value) || 3 })}
                                                className="w-full px-3 py-2 bg-surface-dark border border-border-color rounded-lg text-white text-sm"
                                            />
                                        </div>
                                    )}

                                    {formData.triggerType === 'weekly' && (
                                        <div>
                                            <label className="block text-xs text-text-secondary mb-1">Ngày gửi</label>
                                            <select
                                                value={formData.triggerDayOfWeek}
                                                onChange={(e) => setFormData({ ...formData, triggerDayOfWeek: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 bg-surface-dark border border-border-color rounded-lg text-white text-sm"
                                            >
                                                {daysOfWeek.map(d => (
                                                    <option key={d.value} value={d.value}>{d.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {formData.triggerType !== 'manual' && (
                                        <div>
                                            <label className="block text-xs text-text-secondary mb-1">Giờ gửi</label>
                                            <select
                                                value={formData.triggerHour}
                                                onChange={(e) => setFormData({ ...formData, triggerHour: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 bg-surface-dark border border-border-color rounded-lg text-white text-sm"
                                            >
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <option key={i} value={i}>{i}:00</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Subject with Variable Chips */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Tiêu đề email <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full px-4 py-2 bg-background-dark border border-border-color rounded-lg text-white mb-2"
                                    placeholder="Chào {{userName}}! Đừng quên học..."
                                />
                                <div className="flex flex-wrap gap-1">
                                    {availableVariables.slice(0, 5).map(v => (
                                        <button
                                            key={v.key}
                                            onClick={() => insertVariable(v.key)}
                                            className="px-2 py-1 text-xs bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
                                        >
                                            +{v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Default HTML Body text box removed, replaced by No-Code Editor */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-text-secondary">
                                        Thiết kế Email (Visual Editor)
                                    </label>
                                    <div className="group relative flex items-center">
                                        <Icon name="help_outline" className="text-primary text-xl cursor-help" />
                                        <div className="absolute top-full right-0 mt-2 w-72 bg-surface-dark border border-primary/20 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 tooltip-triangle">
                                            <p className="text-xs text-text-secondary">
                                                <strong className="text-white block mb-1">Hướng dẫn sử dụng:</strong>
                                                Kéo các khối tử bên phải (Text, Hình ảnh, Nút...) vào vùng thiết kế ở giữa. Bạn có thể sử dụng các biến động (Ví dụ: <code className="text-primary bg-primary/10 px-1 rounded">{{ userName }}</code>) trực tiếp trong các khối văn bản.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg overflow-hidden border border-border-color min-h-[600px] w-full relative email-editor-container">
                                    <style dangerouslySetInnerHTML={{
                                        __html: `
                                        .email-editor-container iframe { border-radius: 8px; }
                                        /* Attempt to hide Unlayer watermark via css injection if possible, though React-Email-Editor isolates it in an iframe. */
                                    ` }} />
                                    <EmailEditor
                                        ref={emailEditorRef}
                                        onLoad={onEditorLoad}
                                        minHeight="600px"
                                        options={{
                                            locale: 'vi-VN',
                                            appearance: {
                                                theme: 'modern_light',
                                            },
                                            customJS: [
                                                `
                                                // Inject CSS to hide Unlayer watermark
                                                const style = document.createElement('style');
                                                style.innerHTML = '.blockbuilder-preferences .unlayer-watermark, a[href*="unlayer.com"] { display: none !important; margin: 0 !important; padding: 0 !important; visibility: hidden !important; }';
                                                document.head.appendChild(style);
                                                `
                                            ]
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center gap-4 mb-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-4 h-4 rounded border-border-color accent-amber-500"
                                    />
                                    <span className="text-sm text-white">Kích hoạt email này</span>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center"
                                >
                                    {saving ? <><Icon name="sync" className="animate-spin mr-2" /> Đang lưu...</> : <><Icon name="save" className="mr-2" /> Lưu</>}
                                </button>
                                <button
                                    onClick={handlePreview}
                                    className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-colors flex items-center"
                                >
                                    <Icon name="visibility" className="mr-2" /> Xem trước
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setSelectedTemplate(null); }}
                                    className="px-6 py-2 bg-surface-highlight text-white rounded-lg font-medium hover:bg-surface-highlight/80 transition-colors"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>

                        {/* Preview Panel */}
                        <div className="bg-surface-dark rounded-xl border border-border-color p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Icon name="mail" className="text-primary" /> Xem trước
                            </h3>
                            {showPreview && previewHtml ? (
                                <div className="bg-white rounded-lg p-4 text-gray-800">
                                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-text-secondary">
                                    <Icon name="preview" className="text-4xl mb-2 opacity-50" />
                                    <p className="text-sm">Nhấn "Xem trước" để xem email</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Templates List */
                    <div className="space-y-4">
                        {templates.length === 0 ? (
                            <div className="bg-surface-dark rounded-xl border border-border-color p-12 text-center">
                                <Icon name="mail" className="text-5xl text-text-secondary/30 mb-4" />
                                <p className="text-text-secondary mb-4">Chưa có email template nào</p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={handleCreate}
                                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-colors"
                                    >
                                        Tạo Template Mới
                                    </button>
                                    <button
                                        onClick={handleSeed}
                                        className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-400 transition-colors"
                                    >
                                        Tạo Templates Mẫu
                                    </button>
                                </div>
                            </div>
                        ) : (
                            templates.map(template => (
                                <div
                                    key={template.id}
                                    className="bg-surface-dark rounded-xl border border-border-color p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl flex items-center justify-center ${template.isActive ? 'bg-amber-500/10' : 'bg-gray-500/10'}`}>
                                                <Icon
                                                    name={template.category === 'reminder' ? 'notifications' : template.category === 'engagement' ? 'favorite' : template.category === 'report' ? 'assessment' : 'mail'}
                                                    className={template.isActive ? 'text-amber-400' : 'text-gray-400'}
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-bold text-white">{template.nameVi}</h3>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-surface-highlight rounded-full text-text-secondary">
                                                        {template.code}
                                                    </span>
                                                    {!template.isActive && (
                                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded-full">
                                                            Tắt
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-text-secondary">{template.subject}</p>
                                                <p className="text-xs text-primary/70 mt-1 flex items-center gap-1">
                                                    <Icon name="schedule" className="text-xs" />
                                                    {getTriggerDescription(template)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleTestSend(template.code)}
                                                disabled={testSending === template.code}
                                                className="p-2 hover:bg-surface-highlight rounded-lg transition-colors flex items-center justify-center"
                                                title="Gửi email test"
                                            >
                                                <Icon name={testSending === template.code ? 'sync' : 'send'} className={`text-primary ${testSending === template.code ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(template)}
                                                className="p-2 hover:bg-surface-highlight rounded-lg transition-colors flex items-center justify-center"
                                                title="Chỉnh sửa"
                                            >
                                                <Icon name="edit" className="text-amber-400" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template.code)}
                                                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center"
                                                title="Xóa"
                                            >
                                                <Icon name="delete" className="text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </AdminLayout>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    );
}
