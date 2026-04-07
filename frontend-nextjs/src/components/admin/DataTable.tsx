import React from 'react';
import { Icon } from '../common';

interface Column<T> {
    key: keyof T | string;
    header: string;
    render?: (item: T) => React.ReactNode;
    sortable?: boolean;
    width?: string;
    hideOnMobile?: boolean;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    loading?: boolean;
    emptyMessage?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    onPageChange?: (page: number) => void;
    onRowClick?: (item: T) => void;
    actions?: (item: T) => React.ReactNode;
    rowClassName?: (item: T) => string;
    rowId?: (item: T) => string;
}

function DataTable<T extends { id: string | number }>({
    data,
    columns,
    loading = false,
    emptyMessage = 'Không có dữ liệu',
    pagination,
    onPageChange,
    onRowClick,
    actions,
    rowClassName,
    rowId,
}: DataTableProps<T>) {
    const getValue = (item: T, key: string): any => {
        const keys = key.split('.');
        let value: any = item;
        for (const k of keys) {
            value = value?.[k];
        }
        return value;
    };

    if (loading) {
        return (
            <div className="bg-surface-dark rounded-xl border border-border-color overflow-hidden">
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface-dark rounded-xl border border-border-color overflow-hidden">
            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-background-dark border-b border-border-color">
                            {columns.map((col) => (
                                <th
                                    key={String(col.key)}
                                    className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary ${col.hideOnMobile ? 'hidden md:table-cell' : ''
                                        }`}
                                    style={{ width: col.width }}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.header}
                                        {col.sortable && (
                                            <Icon name="unfold_more" className="text-sm opacity-50" />
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && (
                                <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-secondary" style={{ width: '160px' }}>
                                    Thao tác
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                        {data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (actions ? 1 : 0)}
                                    className="px-4 py-12 text-center text-text-secondary"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((item) => (
                                <tr
                                    id={rowId ? rowId(item) : undefined}
                                    key={item.id}
                                    className={`hover:bg-surface-highlight transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(item) : ''}`}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={String(col.key)}
                                            className={`px-4 py-4 text-sm text-text-base ${col.hideOnMobile ? 'hidden md:table-cell' : ''
                                                }`}
                                        >
                                            {col.render
                                                ? col.render(item)
                                                : getValue(item, String(col.key))}
                                        </td>
                                    ))}
                                    {actions && (
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {actions(item)}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-border-color flex items-center justify-between bg-background-dark/50">
                    <p className="text-sm text-text-secondary">
                        Hiển thị {(pagination.page - 1) * pagination.limit + 1} -{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} của{' '}
                        {pagination.total} kết quả
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange?.(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="size-10 rounded-full flex items-center justify-center hover:bg-surface-highlight disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Icon name="chevron_left" className="text-xl" />
                        </button>
                        <button
                            onClick={() => onPageChange?.(1)}
                            disabled={pagination.page === 1}
                            className="size-10 rounded-full flex items-center justify-center hover:bg-surface-highlight disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="First page"
                        >
                            <Icon name="first_page" className="text-xl" />
                        </button>
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (pagination.totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                                pageNum = i + 1;
                            } else if (pagination.page >= pagination.totalPages - 2) {
                                pageNum = pagination.totalPages - 4 + i;
                            } else {
                                pageNum = pagination.page - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => onPageChange?.(pageNum)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${pagination.page === pageNum
                                        ? 'bg-primary text-on-primary'
                                        : 'hover:bg-surface-highlight text-text-secondary'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => onPageChange?.(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="size-10 rounded-full flex items-center justify-center hover:bg-surface-highlight disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Icon name="chevron_right" className="text-xl" />
                        </button>
                        <button
                            onClick={() => onPageChange?.(pagination.totalPages)}
                            disabled={pagination.page === pagination.totalPages}
                            className="size-10 rounded-full flex items-center justify-center hover:bg-surface-highlight disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Last page"
                        >
                            <Icon name="last_page" className="text-xl" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DataTable;
