"use client";

import React from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import Icon from "@/components/common/Icon";

export default function AdminSettingsPage() {
  return (
    <AdminLayout title="Cài đặt Website" showLogo={false}>
      <div className="space-y-4 sm:space-y-6">
        {/* General Settings */}
        <div className="bg-surface-dark rounded-xl border border-border-color p-4 sm:p-6 opacity-60 shadow-sm transition-all hover:opacity-100 group">
          <div className="flex items-start gap-4">
            <div className="size-10 sm:size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
              <Icon name="tune" className="text-xl sm:text-2xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-base mb-1">
                Cài đặt chung
              </h2>
              <p className="text-sm text-text-muted">
                Tên website, màu chủ đạo, footer, SEO meta tags... (Sắp có)
              </p>
            </div>
          </div>
        </div>

        {/* Payments Settings */}
        <div className="bg-surface-dark rounded-xl border border-border-color p-4 sm:p-6 opacity-60 shadow-sm transition-all hover:opacity-100 group">
          <div className="flex items-start gap-4">
            <div className="size-10 sm:size-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0 group-hover:bg-green-500 group-hover:text-white transition-all">
              <Icon name="payments" className="text-xl sm:text-2xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-base mb-1">
                Thanh toán & Gói cước
              </h2>
              <p className="text-sm text-text-muted">
                Cấu hình giá Premium, phương thức thanh toán... (Sắp có)
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-surface-dark rounded-xl border border-border-color p-4 sm:p-6 opacity-60 shadow-sm transition-all hover:opacity-100 group">
          <div className="flex items-start gap-4">
            <div className="size-10 sm:size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all">
              <Icon name="notifications" className="text-xl sm:text-2xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-base mb-1">
                Thông báo & Email
              </h2>
              <p className="text-sm text-text-muted">
                Cấu hình nội dung tự động, lịch gửi email... (Sắp có)
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
