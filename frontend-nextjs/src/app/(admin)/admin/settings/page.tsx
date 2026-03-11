'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Icon from '@/components/common/Icon';
import { getLogoUrl, uploadLogo, deleteLogo } from '@/services/emailApi';

export default function AdminSettingsPage() {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [imageTimestamp, setImageTimestamp] = useState(Date.now());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchLogo = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getLogoUrl();
            setLogoUrl(data.url);
        } catch (err) {
            console.error('Failed to fetch logo:', err);
            setError('Không thể kết nối backend. Vui lòng restart backend server.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogo();
    }, [fetchLogo]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        try {
            const result = await uploadLogo(file);
            setLogoUrl(result.url);
            setImageTimestamp(Date.now());
            setSuccessMessage('Logo đã được tự động cập nhật và sẵn sàng hiển thị trên trang chủ!');
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            console.error('Failed to upload logo:', err);
            setError('Lỗi upload! Kiểm tra đã install sharp: npm install sharp');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async () => {
        if (!confirm('Bạn có chắc muốn xóa logo?')) return;

        setDeleting(true);
        try {
            await deleteLogo();
            setLogoUrl(null);
            setImageTimestamp(Date.now());
            setSuccessMessage('Đã xóa logo thành công.');
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            console.error('Failed to delete logo:', err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <AdminLayout title="Cài đặt Website">
            <div className="space-y-6">
                {/* Logo Section */}
                <div className="bg-surface-dark rounded-xl border border-border-color p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Icon name="image" className="text-amber-400" />
                        Logo Website
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg animate-in fade-in zoom-in-95">
                            <p className="text-sm text-red-400 flex items-center gap-2">
                                <Icon name="error" />
                                {error}
                            </p>
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg animate-in fade-in zoom-in-95">
                            <p className="text-sm text-green-400 flex items-center gap-2">
                                <Icon name="check_circle" />
                                {successMessage}
                            </p>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Current Logo Preview */}
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                <div className="w-full sm:w-48 h-24 bg-background-dark rounded-lg border border-border-color flex items-center justify-center overflow-hidden shrink-0">
                                    {logoUrl ? (
                                        <img
                                            src={`${process.env.NEXT_PUBLIC_API_URL}${logoUrl}?t=${imageTimestamp}`}
                                            alt="Logo"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : (
                                        <div className="text-text-secondary text-sm flex flex-col items-center gap-1">
                                            <Icon name="hide_image" className="text-3xl opacity-50" />
                                            <span>Chưa có logo</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <p className="text-sm text-text-secondary mb-2">
                                        Logo sẽ tự động scale về kích thước tối đa <span className="text-white font-medium">200x80px</span>
                                    </p>
                                    <p className="text-xs text-text-secondary">
                                        Hỗ trợ: JPG, PNG, GIF, WebP, SVG (tối đa 2MB)
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-3 pt-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleUpload}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Icon name={uploading ? 'sync' : 'upload'} className={uploading ? 'animate-spin' : ''} />
                                    {uploading ? 'Đang upload...' : 'Upload Logo'}
                                </button>

                                {logoUrl && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="px-4 py-2.5 bg-red-500/10 text-red-400 rounded-lg font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Icon name={deleting ? 'sync' : 'delete'} className={deleting ? 'animate-spin' : ''} />
                                        {deleting ? 'Đang xóa...' : 'Xóa Logo'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* More Settings Coming Soon */}
                <div className="bg-surface-dark rounded-xl border border-border-color p-6 opacity-60">
                    <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <Icon name="tune" className="text-text-secondary" />
                        Cài đặt khác
                    </h2>
                    <p className="text-sm text-text-secondary">
                        Tên website, màu chủ đạo, footer, SEO meta tags...
                    </p>
                </div>
            </div>
        </AdminLayout>
    );
}
