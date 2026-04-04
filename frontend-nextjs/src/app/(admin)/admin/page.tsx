"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/layout/AdminLayout";
import StatsCard from "@/components/admin/StatsCard";
import AdminRealtimeAnalyticsSection from "@/components/admin/AdminRealtimeAnalyticsSection";
import Icon from "@/components/common/Icon";
import ThemedDateRangePicker from "@/components/common/ThemedDateRangePicker";
import {
  getOverviewStats,
  getActivityStats,
  type OverviewStats,
  type ActivityData,
} from "@/services/adminApi";

export default function AdminDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [chartData, setChartData] = useState<ActivityData[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [showActivityFilter, setShowActivityFilter] = useState(false);
  const [activityFromDate, setActivityFromDate] = useState("");
  const [activityToDate, setActivityToDate] = useState("");
  const [appliedActivityFromDate, setAppliedActivityFromDate] = useState("");
  const [appliedActivityToDate, setAppliedActivityToDate] = useState("");
  const [activityFilterError, setActivityFilterError] = useState("");

  // Fetch activity stats for chart
  const fetchActivityData = useCallback(async (days: number) => {
    setChartLoading(true);
    try {
      const data = await getActivityStats(days);
      setChartData(data);
    } catch (err) {
      console.error("Failed to fetch activity stats:", err);
    } finally {
      setChartLoading(false);
    }
  }, []);

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOverviewStats();
        console.log("Dashboard stats:", data);
        setStats(data);
        setChartData(data.dailyActivity || []);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setError("Không thể tải dữ liệu thống kê");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Handle days selection change
  const handleDaysChange = (days: number) => {
    setSelectedDays(days);
    fetchActivityData(days);
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activityDataForView =
    appliedActivityFromDate && appliedActivityToDate
      ? chartData.filter(
          (day) =>
            day.date >= appliedActivityFromDate &&
            day.date <= appliedActivityToDate,
        )
      : chartData;

  const applyActivityRange = () => {
    if (!activityFromDate || !activityToDate) {
      setActivityFilterError("Vui lòng chọn đủ Từ ngày và Đến ngày.");
      return;
    }
    if (activityFromDate > activityToDate) {
      setActivityFilterError("Khoảng ngày không hợp lệ.");
      return;
    }

    setAppliedActivityFromDate(activityFromDate);
    setAppliedActivityToDate(activityToDate);
    setActivityFilterError("");
    setShowActivityFilter(false);
  };

  const clearActivityRange = () => {
    setActivityFromDate("");
    setActivityToDate("");
    setAppliedActivityFromDate("");
    setAppliedActivityToDate("");
    setActivityFilterError("");
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Dashboard">
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
          <Icon name="error" className="text-4xl text-red-400 mb-2" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-400"
          >
            Thử lại
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Tổng người dùng"
          value={stats.users}
          icon="group"
          trend={stats.userTrend}
        />
        <StatsCard
          title="Tổng video"
          value={stats.videos}
          icon="video_library"
          subtitle={`${stats.publishedVideos} đã xuất bản`}
        />
        <StatsCard
          title="Từ vựng"
          value={stats.vocabulary}
          icon="translate"
          trend={stats.vocabTrend}
        />
        <StatsCard
          title="Lượt học hôm nay"
          value={stats.todayLearningCount}
          icon="school"
          subtitle="Flashcard reviews"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-dark rounded-xl border border-border-color p-4 sm:p-6 shadow-sm transition-colors overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-base sm:text-lg font-bold text-text-base">
              Thống kê hoạt động
            </h3>
            <div className="relative flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-background-dark rounded-xl p-1">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => handleDaysChange(days)}
                    className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                      selectedDays === days
                        ? "bg-primary text-on-primary shadow-lg shadow-primary/20 scale-105"
                        : "text-text-secondary hover:text-text-base hover:bg-surface-highlight"
                    }`}
                  >
                    {days} ngày
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowActivityFilter((prev) => !prev)}
                className={`size-9 rounded-lg border border-border-color bg-background-dark flex items-center justify-center transition-all ${
                  showActivityFilter ||
                  (appliedActivityFromDate && appliedActivityToDate)
                    ? "text-primary border-primary/50"
                    : "text-text-secondary hover:text-text-base"
                }`}
                title="Lọc theo ngày"
              >
                <Icon name="filter_list" size="sm" />
              </button>

              {showActivityFilter && (
                <div className="absolute right-0 top-full z-20 mt-2 w-[320px] rounded-xl border border-border-color bg-surface-dark p-3 shadow-2xl">
                  <ThemedDateRangePicker
                    fromDate={activityFromDate}
                    toDate={activityToDate}
                    onFromDateChange={setActivityFromDate}
                    onToDateChange={setActivityToDate}
                    error={activityFilterError}
                  />

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={clearActivityRange}
                      className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-text-base"
                    >
                      Bỏ lọc
                    </button>
                    <button
                      type="button"
                      onClick={applyActivityRange}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart/Calendar Display */}
          {chartLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          ) : selectedDays === 7 ? (
            /* Bar Chart for 7 days with axes */
            <div className="h-52">
              {activityDataForView.length > 0 ? (
                (() => {
                  const maxValue = Math.max(
                    ...activityDataForView.map((d) =>
                      Math.max(d.newUsers, d.videoViews),
                    ),
                    1,
                  );
                  const chartHeight = 176; // h-44 = 11rem = 176px
                  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

                  return (
                    <div className="flex h-full">
                      {/* Y-axis */}
                      <div
                        className="flex flex-col justify-between items-end pr-2 text-[10px] text-text-secondary"
                        style={{ height: `${chartHeight}px` }}
                      >
                        <span>{maxValue}</span>
                        <span>{Math.round(maxValue / 2)}</span>
                        <span>0</span>
                      </div>

                      {/* Chart area */}
                      <div className="flex-1 flex flex-col min-w-0">
                        {/* Grid lines and bars */}
                        <div
                          className="relative border-l border-b border-border-color overflow-hidden"
                          style={{ height: `${chartHeight}px` }}
                        >
                          {/* Horizontal grid lines */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            <div className="border-t border-border-color/30 w-full" />
                            <div className="border-t border-border-color/30 w-full" />
                            <div className="border-t border-border-color/30 w-full" />
                          </div>

                          {/* Bars */}
                          <div className="absolute inset-0 flex items-end">
                            {activityDataForView.map((day, index) => {
                              const userHeightPx =
                                (day.newUsers / maxValue) * chartHeight;
                              const videoHeightPx =
                                (day.videoViews / maxValue) * chartHeight;
                              const isToday = day.date === today;
                              return (
                                <div
                                  key={index}
                                  className="flex-1 flex items-end justify-center"
                                >
                                  <div
                                    className={`flex items-end gap-1 group ${isToday ? "relative z-10" : ""}`}
                                  >
                                    {/* Today indicator */}
                                    {isToday && (
                                      <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-14 h-full bg-amber-500/10 rounded-t-lg -z-10" />
                                    )}
                                    {/* User bar */}
                                    <div className="relative flex flex-col items-center">
                                      <span className="text-[9px] text-amber-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {day.newUsers > 0 ? day.newUsers : ""}
                                      </span>
                                      <div
                                        className={`w-5 bg-gradient-to-t rounded-t-sm transition-all hover:from-amber-400 hover:to-amber-300 ${isToday ? "from-amber-400 to-amber-300 ring-2 ring-amber-400/50" : "from-amber-500 to-amber-400"}`}
                                        style={{
                                          height: `${userHeightPx}px`,
                                          minHeight:
                                            day.newUsers > 0 ? "4px" : "0",
                                        }}
                                      />
                                    </div>
                                    {/* Video bar */}
                                    <div className="relative flex flex-col items-center">
                                      <span className="text-[9px] text-primary mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {day.videoViews > 0
                                          ? day.videoViews
                                          : ""}
                                      </span>
                                      <div
                                        className={`w-5 bg-gradient-to-t rounded-t-sm transition-all hover:opacity-80 ${isToday ? "from-primary to-primary/60 ring-2 ring-primary/50" : "from-primary to-primary/80"}`}
                                        style={{
                                          height: `${videoHeightPx}px`,
                                          minHeight:
                                            day.videoViews > 0 ? "4px" : "0",
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* X-axis labels - border-l transparent matches bars container */}
                        <div className="flex pt-2 text-[10px] sm:text-xs text-text-secondary border-l border-transparent overflow-hidden">
                          {activityDataForView.map((day, index) => {
                            const isToday = day.date === today;
                            return (
                              <div
                                key={index}
                                className="flex-1 flex justify-center"
                              >
                                <span
                                  className={
                                    isToday ? "text-amber-400 font-bold" : ""
                                  }
                                >
                                  {isToday ? "Hôm nay" : day.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary text-sm">
                  Chưa có dữ liệu hoạt động
                </div>
              )}
            </div>
          ) : (
            /* Calendar/Table view for 30/90 days - grouped by month */
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              {(() => {
                // Group data by month
                const monthNames = [
                  "Tháng 1",
                  "Tháng 2",
                  "Tháng 3",
                  "Tháng 4",
                  "Tháng 5",
                  "Tháng 6",
                  "Tháng 7",
                  "Tháng 8",
                  "Tháng 9",
                  "Tháng 10",
                  "Tháng 11",
                  "Tháng 12",
                ];

                const groupedByMonth: {
                  [key: string]: typeof activityDataForView;
                } = {};
                activityDataForView.forEach((day) => {
                  const [year, month] = day.date.split("-");
                  const monthKey = `${monthNames[parseInt(month) - 1]}/${year}`;
                  if (!groupedByMonth[monthKey]) {
                    groupedByMonth[monthKey] = [];
                  }
                  groupedByMonth[monthKey].push(day);
                });

                return Object.entries(groupedByMonth).map(
                  ([monthLabel, days]) => (
                    <div key={monthLabel} className="mb-4 last:mb-0">
                      {/* Month Header */}
                      <h4 className="text-sm font-bold text-text-base mb-2 px-1 flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        {monthLabel}
                      </h4>

                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border-color">
                            {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map(
                              (d) => (
                                <th
                                  key={d}
                                  className="p-1.5 text-center text-text-base font-bold w-[14.28%]"
                                >
                                  {d}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Build a real month calendar grid (CN..T7) instead of slicing every 7 rows.
                            const sortedDays = [...days].sort((a, b) =>
                              a.date.localeCompare(b.date),
                            );
                            if (sortedDays.length === 0) {
                              return null;
                            }

                            const [yearStr, monthStr] =
                              sortedDays[0].date.split("-");
                            const year = Number(yearStr);
                            const month = Number(monthStr); // 1-12
                            const firstDayOfMonth = new Date(
                              year,
                              month - 1,
                              1,
                            ).getDay();
                            const daysInMonth = new Date(
                              year,
                              month,
                              0,
                            ).getDate();

                            const byDay = new Map<number, ActivityData>();
                            sortedDays.forEach((item) => {
                              const dayNum = Number(item.date.split("-")[2]);
                              byDay.set(dayNum, item);
                            });

                            const rows: Array<Array<number | null>> = [];
                            let currentRow: Array<number | null> = [];

                            for (let i = 0; i < firstDayOfMonth; i += 1) {
                              currentRow.push(null);
                            }

                            for (
                              let dayNum = 1;
                              dayNum <= daysInMonth;
                              dayNum += 1
                            ) {
                              currentRow.push(dayNum);
                              if (currentRow.length === 7) {
                                rows.push(currentRow);
                                currentRow = [];
                              }
                            }

                            if (currentRow.length > 0) {
                              while (currentRow.length < 7) {
                                currentRow.push(null);
                              }
                              rows.push(currentRow);
                            }

                            return rows.map((week, weekIndex) => (
                              <tr
                                key={weekIndex}
                                className="border-b border-border-color/20"
                              >
                                {week.map((dayNum, dayIndex) => (
                                  <td
                                    key={dayIndex}
                                    className="p-1.5 text-center"
                                  >
                                    {dayNum ? (
                                      (() => {
                                        const dayData = byDay.get(dayNum);
                                        return (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-text-base font-bold text-[11px]">
                                              {dayNum}
                                            </span>
                                            <div className="flex gap-0.5 justify-center">
                                              {(dayData?.newUsers || 0) > 0 && (
                                                <span
                                                  className="px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px]"
                                                  title="Người dùng mới"
                                                >
                                                  {dayData?.newUsers}
                                                </span>
                                              )}
                                              {(dayData?.videoViews || 0) >
                                                0 && (
                                                <span
                                                  className="px-1 py-0.5 bg-primary/20 text-primary rounded text-[9px]"
                                                  title="Lượt xem"
                                                >
                                                  {dayData?.videoViews}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <span className="text-text-secondary/20">
                                        -
                                      </span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ),
                );
              })()}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-xs text-text-secondary">
                Người dùng mới
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-xs text-text-secondary">
                Lượt xem video
              </span>
            </div>
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-surface-dark rounded-xl border border-border-color p-4 sm:p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-base">Người dùng mới</h3>
            <Link
              href="/admin/users"
              className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              Xem tất cả
              <Icon name="arrow_forward" className="text-sm" />
            </Link>
          </div>

          <div className="space-y-4">
            {stats.recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-2 sm:p-3 rounded-xl hover:bg-surface-highlight transition-colors"
              >
                <div className="size-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-base truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {user.email}
                  </p>
                </div>
                <p className="text-xs text-text-secondary whitespace-nowrap">
                  {formatDate(user.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AdminRealtimeAnalyticsSection />
      </div>
    </AdminLayout>
  );
}
