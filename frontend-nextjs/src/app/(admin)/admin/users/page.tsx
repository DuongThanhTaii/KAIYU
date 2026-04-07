'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import StatsCard from '@/components/admin/StatsCard';
import Icon from '@/components/common/Icon';
import Badge from '@/components/common/Badge';
import StreakBadge from '@/components/common/StreakBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers, updateUserRole, deleteUser, type AdminUser } from '@/services/adminApi';

export default function AdminUsersPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('');
    const [filterPremium, setFilterPremium] = useState<string>('');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
    });

    // Modal states
    const [showUserDetail, setShowUserDetail] = useState<AdminUser | null>(null);
    const [showRoleModal, setShowRoleModal] = useState<AdminUser | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<AdminUser | null>(null);
    const [newRole, setNewRole] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [serverStats, setServerStats] = useState({
        total: 0,
        premium: 0,
        admins: 0,
        activeToday: 0,
    });

    // Auth check
    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated) router.replace('/login');
            else if (user?.role !== 'admin') router.replace('/dashboard');
        }
    }, [authLoading, isAuthenticated, user, router]);

    // Fetch users (supports server-side `search`)
    const fetchUsers = useCallback(async (page = 1, search?: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await getAllUsers({ page, limit: 20, role: filterRole || undefined, search: search || undefined });
            setUsers(response.data);
            setServerStats(response.stats);
            setPagination({
                page: response.meta.page,
                limit: response.meta.limit,
                total: response.meta.total,
                totalPages: response.meta.totalPages,
            });
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setError('Không thể tải danh sách users');
        } finally {
            setLoading(false);
        }
    }, [filterRole]);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'admin') {
            fetchUsers(1, searchQuery || undefined);
        }
    }, [fetchUsers, isAuthenticated, user]);

    // Debounce search input and trigger server-side search
    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'admin') return;
        const t = setTimeout(() => {
            fetchUsers(1, searchQuery || undefined);
        }, 350);
        return () => clearTimeout(t);
    }, [searchQuery, fetchUsers, isAuthenticated, user]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const handleChangeRole = async () => {
        if (!showRoleModal || !newRole) return;
        setIsSaving(true);
        try {
            await updateUserRole(showRoleModal.id, newRole);
            setUsers(users.map(u =>
                u.id === showRoleModal.id ? { ...u, role: newRole } : u
            ));
            setShowRoleModal(null);
            setNewRole('');
        } catch (err) {
            console.error('Failed to update role:', err);
            setError('Không thể cập nhật vai trò');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!showDeleteConfirm) return;
        setIsSaving(true);
        try {
            await deleteUser(showDeleteConfirm.id);
            setUsers(users.filter(u => u.id !== showDeleteConfirm.id));
            setShowDeleteConfirm(null);
        } catch (err) {
            console.error('Failed to delete user:', err);
            setError('Không thể xóa user');
        } finally {
            setIsSaving(false);
        }
    };

    // Filter users locally only for Premium filter (name/email search is server-side)
    const filteredUsers = users.filter(u => {
        const matchPremium = !filterPremium ||
            (filterPremium === 'true' && u.isPremium) ||
            (filterPremium === 'false' && !u.isPremium);
        return matchPremium;
    });

    // Stats logic removed (now uses serverStats)

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
            key: 'name',
            header: 'Người dùng',
            render: (user: AdminUser) => (
                <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold ${user.role === 'admin'
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                        : user.isPremium
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                            : 'bg-gradient-to-br from-gray-500 to-gray-600'
                        }`}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-text-base flex items-center gap-2">
                            {user.name}
                            {user.isPremium && (
                                <Icon name="verified" className="text-sm text-purple-400" />
                            )}
                        </p>
                        <p className="text-xs text-text-secondary">{user.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'role',
            header: 'Vai trò',
            width: '100px',
            render: (user: AdminUser) => (
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${user.role === 'admin'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-blue-500/20 text-blue-400'
                    }`}>
                    {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
            ),
        },
        {
            key: 'hskLevel',
            header: 'HSK',
            width: '95px',
            hideOnMobile: true,
            render: (user: AdminUser) => (
                <Badge variant="hsk" hskLevel={user.hskLevel} size="md">
                    HSK {user.hskLevel}
                </Badge>
            ),
        },
        {
            key: 'streak',
            header: 'Streak',
            width: '95px',
            hideOnMobile: true,
            render: (user: AdminUser) => (
                <StreakBadge count={user.streak} size="md" className="justify-center min-w-[68px]" />
            ),
        },
        {
            key: '_count.userVocabulary',
            header: 'Từ vựng',
            width: '80px',
            hideOnMobile: true,
            render: (user: AdminUser) => (
                <span className="text-text-secondary">{user._count?.userVocabulary || 0}</span>
            ),
        },
        {
            key: 'isPremium',
            header: 'Premium',
            width: '90px',
            hideOnMobile: true,
            render: (user: AdminUser) => (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.isPremium
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-gray-500/20 text-gray-400'
                    }`}>
                    {user.isPremium ? 'Premium' : 'Free'}
                </span>
            ),
        },
        {
            key: 'createdAt',
            header: 'Ngày tạo',
            width: '100px',
            hideOnMobile: true,
            render: (user: AdminUser) => (
                <span className="text-text-secondary text-sm">{formatDate(user.createdAt)}</span>
            ),
        },
    ];

    const actions = (user: AdminUser) => (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowUserDetail(user);
                }}
                className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Xem chi tiết"
            >
                <Icon name="visibility" className="text-lg" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setNewRole(user.role);
                    setShowRoleModal(user);
                }}
                className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Thay đổi role"
            >
                <Icon name="admin_panel_settings" className="text-lg" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(user);
                }}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Xóa user"
            >
                <Icon name="delete" className="text-lg" />
            </button>
        </>
    );

    return (
        <AdminLayout title="Quản lý Users" showLogo={false}>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                    title="Tổng người dùng"
                    value={serverStats.total}
                    icon="group"
                />
                <StatsCard
                    title="Premium"
                    value={serverStats.premium}
                    icon="workspace_premium"
                />
                <StatsCard
                    title="Admins"
                    value={serverStats.admins}
                    icon="admin_panel_settings"
                />
                <StatsCard
                    title="Hoạt động"
                    value={serverStats.activeToday}
                    icon="person_check"
                />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 mb-6">
                <div className="flex-1 relative">
                    <Icon
                        name="search"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm..."
                        className="w-full pl-12 pr-4 py-2 sm:py-3 bg-surface-dark border border-border-color rounded-xl text-sm sm:text-base text-text-base placeholder-text-secondary focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 bg-surface-dark border border-border-color rounded-xl text-xs sm:text-base text-text-base focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
                    >
                        <option value="">Tất cả vai trò</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                    </select>
                    <select
                        value={filterPremium}
                        onChange={(e) => setFilterPremium(e.target.value)}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 bg-surface-dark border border-border-color rounded-xl text-xs sm:text-base text-text-base focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
                    >
                        <option value="">Tất cả gói</option>
                        <option value="true">Premium</option>
                        <option value="false">Free</option>
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                data={filteredUsers}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page) => fetchUsers(page, searchQuery || undefined)}
                actions={actions}
                emptyMessage="Không tìm thấy user nào"
            />

            {/* User Detail Modal */}
            <Modal
                isOpen={!!showUserDetail}
                onClose={() => setShowUserDetail(null)}
                title="Chi tiết User"
                size="md"
            >
                {showUserDetail && (
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <div className={`size-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${showUserDetail.role === 'admin'
                                ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                                : showUserDetail.isPremium
                                    ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                                    : 'bg-gradient-to-br from-gray-500 to-gray-600'
                                }`}>
                                {showUserDetail.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                                    {showUserDetail.name}
                                    {showUserDetail.isPremium && (
                                        <Icon name="verified" className="text-purple-400" />
                                    )}
                                </h3>
                                <p className="text-text-secondary">{showUserDetail.email}</p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-background-dark rounded-xl text-center border border-border-color/30">
                                <p className="text-2xl font-bold text-primary">HSK {showUserDetail.hskLevel}</p>
                                <p className="text-xs text-text-secondary">Cấp độ</p>
                            </div>
                            <div className="p-4 bg-background-dark rounded-xl text-center border border-border-color/30 flex flex-col items-center justify-center">
                                <StreakBadge count={showUserDetail.streak} size="md" />
                                <p className="text-xs text-text-secondary mt-1">Streak</p>
                            </div>
                            <div className="p-4 bg-background-dark rounded-xl text-center border border-border-color/30">
                                <p className="text-2xl font-bold text-text-base">{showUserDetail._count?.userVocabulary || 0}</p>
                                <p className="text-xs text-text-secondary">Từ vựng</p>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2 border-b border-border-color">
                                <span className="text-text-secondary">Vai trò</span>
                                <span className={`px-2 py-1 text-xs font-bold rounded-full ${showUserDetail.role === 'admin'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {showUserDetail.role === 'admin' ? 'Admin' : 'User'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border-color">
                                <span className="text-text-secondary">Gói dịch vụ</span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${showUserDetail.isPremium
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {showUserDetail.isPremium ? 'Premium' : 'Free'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-text-secondary">Ngày đăng ký</span>
                                <span className="text-text-base font-medium">{formatDate(showUserDetail.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Change Role Modal */}
            <Modal
                isOpen={!!showRoleModal}
                onClose={() => {
                    setShowRoleModal(null);
                    setNewRole('');
                }}
                title="Thay đổi vai trò"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setShowRoleModal(null);
                                setNewRole('');
                            }}
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleChangeRole}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors"
                        >
                            Lưu
                        </button>
                    </>
                }
            >
                {showRoleModal && (
                    <div className="space-y-4">
                        <p className="text-text-secondary text-sm">
                            Thay đổi vai trò cho <span className="text-text-base font-bold">{showRoleModal.name}</span>
                        </p>
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-text-base focus:outline-none focus:border-amber-500 transition-colors"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        {newRole === 'admin' && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <p className="text-sm text-amber-400">
                                    Admin có toàn quyền truy cập và quản lý hệ thống
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(null)}
                title="Xác nhận xóa User"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-4 py-2 text-text-secondary hover:text-text-base transition-colors"
                            disabled={isSaving}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleDeleteUser}
                            disabled={isSaving}
                            className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Đang xóa...' : 'Xóa'}
                        </button>
                    </>
                }
            >
                {showDeleteConfirm && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">
                            Bạn có chắc chắn muốn xóa user <span className="text-text-base font-bold">{showDeleteConfirm.name}</span>?
                        </p>
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-400">
                                Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan (flashcards, tiến độ học, từ vựng đã lưu) sẽ bị xóa.
                            </p>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Error Toast */}
            {error && (
                <div className="fixed bottom-4 right-4 p-4 bg-red-500/90 text-white rounded-lg shadow-lg animate-fade-in">
                    <div className="flex items-center gap-3">
                        <Icon name="error" className="text-xl" />
                        <p>{error}</p>
                        <button onClick={() => setError(null)} className="ml-2 hover:text-red-200">
                            <Icon name="close" />
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
