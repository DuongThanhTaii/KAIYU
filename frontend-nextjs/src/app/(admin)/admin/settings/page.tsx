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
