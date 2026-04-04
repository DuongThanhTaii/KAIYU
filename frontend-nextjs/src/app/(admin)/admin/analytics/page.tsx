"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import Icon from "@/components/common/Icon";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAdminApiBaseUrl,
  getAdminAuthToken,
  getAnalyticsPermissions,
  getRealtimeAnalytics,
  type AnalyticsPermissions,
  type AnalyticsSnapshot,
  type AnalyticsWindow,
} from "@/services/adminApi";

const WINDOW_OPTIONS: Array<{ value: AnalyticsWindow; label: string }> = [
  { value: "1h", label: "1 giờ qua" },
  { value: "6h", label: "6 giờ qua" },
  { value: "24h", label: "24 giờ qua" },
  { value: "7d", label: "7 ngày qua" },
];

const fmt = (value: number) =>
  new Intl.NumberFormat("en-US").format(Number(value || 0));

const getModeLabel = (mode: AnalyticsSnapshot["mode"]) => {
  if (mode === "cloudflare") return "Cloudflare";
  if (mode === "nginx") return "Nginx";
  return "Nội bộ";
};

function MetricCard({
  title,
  value,
  sub,
  icon,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border-color bg-surface-dark p-4 md:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            {title}
          </p>
          <p className="mt-2 text-2xl md:text-3xl font-black text-text-base">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
        </div>
        <div
          className={`size-11 rounded-xl ${accent} flex items-center justify-center shrink-0`}
        >
          <Icon name={icon} className="text-text-base" />
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const initialFrom =
    (searchParams.get("from") || "").match(/^\d{4}-\d{2}-\d{2}$/)?.[0] || "";
  const initialTo =
    (searchParams.get("to") || "").match(/^\d{4}-\d{2}-\d{2}$/)?.[0] || "";

  const [permissions, setPermissions] = useState<AnalyticsPermissions | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [windowSize, setWindowSize] = useState<AnalyticsWindow>("1h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeListTab, setActiveListTab] = useState<
    "countries" | "ips" | "requests"
  >("countries");
  const [activeMainTab, setActiveMainTab] = useState<
    "analytics" | "access" | "error5xx" | "error4xx"
  >("analytics");
  const [fromDateInput, setFromDateInput] = useState(initialFrom);
  const [toDateInput, setToDateInput] = useState(initialTo);
  const [appliedFromDate, setAppliedFromDate] = useState(initialFrom);
  const [appliedToDate, setAppliedToDate] = useState(initialTo);

  const abortRef = useRef<AbortController | null>(null);
  const reconnectRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.replace("/login");
      else if (user?.role !== "admin") router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perm, initial] = await Promise.all([
        getAnalyticsPermissions(),
        getRealtimeAnalytics(windowSize, appliedFromDate, appliedToDate),
      ]);
      setPermissions(perm);
      setSnapshot(initial);
      if (initial.topCountries.length === 0 && initial.topIps.length > 0) {
        setActiveListTab("ips");
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError("Không thể tải dữ liệu phân tích thời gian thực");
    } finally {
      setLoading(false);
    }
  }, [windowSize, appliedFromDate, appliedToDate]);

  const startStream = useCallback(() => {
    if (!isAuthenticated || user?.role !== "admin") return;

    abortRef.current?.abort();
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const connect = async () => {
      try {
        const token = getAdminAuthToken();
        if (!token) {
          setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          return;
        }

        const intervalSec = permissions?.defaultStreamIntervalSec || 5;
        const streamQuery = new URLSearchParams({
          window: windowSize,
          intervalSec: String(intervalSec),
        });
        if (appliedFromDate) streamQuery.set("from", appliedFromDate);
        if (appliedToDate) streamQuery.set("to", appliedToDate);
        const url = `${getAdminApiBaseUrl()}/admin/analytics/stream?${streamQuery.toString()}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE failed (${response.status})`);
        }

        setIsStreaming(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            const line = block
              .split("\n")
              .find((raw) => raw.startsWith("data:"));
            if (!line) continue;

            const rawData = line.replace(/^data:\s*/, "");
            if (!rawData) continue;

            const parsed = JSON.parse(rawData) as
              | AnalyticsSnapshot
              | { message?: string };
            if ("overview" in parsed) {
              setSnapshot(parsed);
              setError(null);
            }
          }
        }
      } catch (streamError) {
        if (controller.signal.aborted) return;
        console.error("Analytics stream disconnected:", streamError);
        setIsStreaming(false);
        reconnectRef.current = window.setTimeout(connect, 3000);
      }
    };

    void connect();
  }, [
    appliedFromDate,
    appliedToDate,
    isAuthenticated,
    permissions?.defaultStreamIntervalSec,
    user?.role,
    windowSize,
  ]);

  const hasCustomRange = Boolean(appliedFromDate && appliedToDate);

  const applyDateRange = () => {
    if (!fromDateInput || !toDateInput) {
      setError("Vui lòng chọn đầy đủ Từ ngày và Đến ngày.");
      return;
    }
    if (fromDateInput > toDateInput) {
      setError(
        "Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.",
      );
      return;
    }
    setAppliedFromDate(fromDateInput);
    setAppliedToDate(toDateInput);
    setError(null);
  };

  const clearDateRange = () => {
    setFromDateInput("");
    setToDateInput("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setError(null);
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      void fetchInitial();
    }
  }, [fetchInitial, isAuthenticated, user?.role]);

  useEffect(() => {
    if (!loading && !error) {
      startStream();
    }

    return () => {
      abortRef.current?.abort();
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [loading, error, startStream]);

  const maxTimeline = useMemo(() => {
    if (!snapshot?.timeline?.length) return 1;
    return Math.max(...snapshot.timeline.map((x) => x.requests), 1);
  }, [snapshot?.timeline]);

  const yAxisTicks = useMemo(() => {
    const segments = 4;
    return Array.from({ length: segments + 1 }, (_, index) => {
      const value = (maxTimeline * (segments - index)) / segments;
      return Math.round(value);
    });
  }, [maxTimeline]);

  const formatTime = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, []);

  if (authLoading || !isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <AdminLayout title="Phân tích thời gian thực">
        <div className="h-[60vh] flex items-center justify-center">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !snapshot) {
    return (
      <AdminLayout title="Phân tích thời gian thực">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <Icon name="error" className="text-red-400 text-3xl" />
          <p className="mt-2 text-red-300">
            {error || "Không có dữ liệu phân tích"}
          </p>
          <button
            onClick={() => void fetchInitial()}
            className="mt-4 rounded-xl bg-red-500 px-4 py-2 text-white font-semibold hover:bg-red-600 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </AdminLayout>
    );
  }

  const listData =
    activeListTab === "countries"
      ? snapshot.topCountries.map((x) => ({
          label: x.country,
          requests: x.requests,
        }))
      : activeListTab === "ips"
        ? snapshot.topIps.map((x) => ({ label: x.ip, requests: x.requests }))
        : snapshot.topRequests.map((x) => ({
            label: x.request,
            requests: x.requests,
          }));

  const tableRows =
    activeMainTab === "access"
      ? snapshot.accessLogs
      : activeMainTab === "error5xx"
        ? snapshot.error5xxLogs
        : activeMainTab === "error4xx"
          ? snapshot.error4xxLogs
          : [];

  return (
    <AdminLayout title="Phân tích thời gian thực" showLogo={false}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-border-color bg-surface-dark shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-border-color bg-background-dark/60">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-black text-text-base tracking-tight">
                  Phân tích
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xl md:text-2xl font-black text-text-base">
                    {snapshot.domain}
                  </p>
                  <Icon
                    name="open_in_new"
                    size="sm"
                    className="text-text-secondary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {WINDOW_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setWindowSize(item.value);
                      clearDateRange();
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      windowSize === item.value
                        ? "bg-primary text-on-primary shadow-md shadow-primary/20"
                        : "bg-background-dark text-text-secondary hover:text-text-base hover:bg-surface-highlight"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-text-secondary">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={fromDateInput}
                  onChange={(e) => setFromDateInput(e.target.value)}
                  className="rounded-lg border border-border-color bg-background-dark px-2.5 py-1.5 text-xs text-text-base"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-text-secondary">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={toDateInput}
                  onChange={(e) => setToDateInput(e.target.value)}
                  className="rounded-lg border border-border-color bg-background-dark px-2.5 py-1.5 text-xs text-text-base"
                />
              </div>
              <button
                type="button"
                onClick={applyDateRange}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90"
              >
                Áp dụng
              </button>
              <button
                type="button"
                onClick={clearDateRange}
                className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-text-base"
              >
                Bỏ lọc
              </button>
              {hasCustomRange && (
                <span className="text-xs text-primary font-semibold">
                  Đang lọc: {appliedFromDate} {"->"} {appliedToDate}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4">
            <MetricCard
              title="Tổng lượt truy cập"
              value={fmt(snapshot.overview.totalRequests)}
              icon="network_check"
              accent="bg-primary/20"
            />
            <MetricCard
              title="Băng thông"
              value={`${snapshot.overview.bandwidthMB.toFixed(2)} MB`}
              icon="database"
              accent="bg-blue-500/20"
            />
            <MetricCard
              title="4xx"
              value={fmt(snapshot.overview.error4xx)}
              icon="warning"
              accent="bg-amber-500/20"
            />
            <MetricCard
              title="5xx"
              value={fmt(snapshot.overview.error5xx)}
              icon="error"
              accent="bg-red-500/20"
            />
            <MetricCard
              title="Học viên hoạt động (5p)"
              value={fmt(snapshot.overview.activeLearners5m)}
              icon="school"
              accent="bg-emerald-500/20"
              sub={isStreaming ? "Đã kết nối realtime" : "Đang kết nối lại..."}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 rounded-2xl border border-border-color bg-surface-dark p-4 md:p-5 shadow-sm">
            <div className="flex items-center gap-2 bg-background-dark rounded-xl p-1 mb-4 overflow-auto">
              <button
                onClick={() => setActiveMainTab("analytics")}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeMainTab === "analytics"
                    ? "bg-surface-highlight text-text-base"
                    : "text-text-secondary hover:text-text-base"
                }`}
              >
                Phân tích
              </button>
              <button
                onClick={() => setActiveMainTab("access")}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeMainTab === "access"
                    ? "bg-surface-highlight text-text-base"
                    : "text-text-secondary hover:text-text-base"
                }`}
              >
                Nhật ký truy cập
              </button>
              <button
                onClick={() => setActiveMainTab("error5xx")}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeMainTab === "error5xx"
                    ? "bg-surface-highlight text-text-base"
                    : "text-text-secondary hover:text-text-base"
                }`}
              >
                Lỗi 5xx
              </button>
              <button
                onClick={() => setActiveMainTab("error4xx")}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeMainTab === "error4xx"
                    ? "bg-surface-highlight text-text-base"
                    : "text-text-secondary hover:text-text-base"
                }`}
              >
                Lỗi 4xx
              </button>
            </div>

            {activeMainTab === "analytics" ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base md:text-lg font-black text-text-base">
                    Tổng lượt truy cập
                  </h3>
                  <span className="text-xs text-text-secondary">
                    {snapshot.window.toUpperCase()}
                  </span>
                </div>

                <div className="h-56 rounded-xl bg-background-dark/50 border border-border-color p-3">
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 1000 220"
                    preserveAspectRatio="none"
                  >
                    {yAxisTicks.map((tick, index) => {
                      const chartLeft = 76;
                      const chartRight = 980;
                      const chartTop = 14;
                      const chartBottom = 210;
                      const y =
                        chartTop +
                        ((chartBottom - chartTop) * index) /
                          Math.max(yAxisTicks.length - 1, 1);

                      return (
                        <g key={`tick-${tick}-${index}`}>
                          <line
                            x1={chartLeft}
                            y1={y}
                            x2={chartRight}
                            y2={y}
                            stroke="rgba(148, 163, 184, 0.22)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={64}
                            y={y + 3}
                            textAnchor="end"
                            fontSize="11"
                            fill="rgba(148, 163, 184, 0.92)"
                          >
                            {fmt(tick)}
                          </text>
                        </g>
                      );
                    })}

                    {snapshot.timeline.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="3"
                        points={snapshot.timeline
                          .map((point, index) => {
                            const chartLeft = 76;
                            const chartRight = 980;
                            const chartTop = 14;
                            const chartBottom = 210;
                            const x =
                              chartLeft +
                              (index / (snapshot.timeline.length - 1)) *
                                (chartRight - chartLeft);
                            const y =
                              chartBottom -
                              (point.requests / maxTimeline) *
                                (chartBottom - chartTop);
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    )}
                  </svg>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] sm:text-xs text-text-secondary">
                  {snapshot.timeline.slice(-4).map((point, idx) => (
                    <div
                      key={`${point.label}-${idx}`}
                      className="rounded-lg bg-background-dark/50 border border-border-color p-2 text-center"
                    >
                      <p className="font-semibold text-text-base">
                        {fmt(point.requests)}
                      </p>
                      <p>{point.label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-border-color bg-background-dark/40 overflow-hidden">
                <div className="grid grid-cols-12 px-3 py-2 text-[11px] font-bold text-text-secondary border-b border-border-color/50">
                  <div className="col-span-2">Time</div>
                  <div className="col-span-1">Code</div>
                  <div className="col-span-2">IP</div>
                  <div className="col-span-7">Request</div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {tableRows.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-text-secondary">
                      Không có log trong khung thời gian đã chọn
                    </div>
                  ) : (
                    tableRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-12 px-3 py-2 text-xs border-b border-border-color/30 last:border-0"
                      >
                        <div className="col-span-2 text-text-secondary">
                          {formatTime(row.ts)}
                        </div>
                        <div className="col-span-1 font-bold text-text-base">
                          {row.status}
                        </div>
                        <div className="col-span-2 text-text-secondary truncate">
                          {row.ip}
                        </div>
                        <div className="col-span-7 text-text-base truncate">
                          {row.method} {row.path}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border-color bg-surface-dark shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b border-border-color">
              <div className="flex items-center gap-2 bg-background-dark rounded-xl p-1">
                <button
                  onClick={() => setActiveListTab("countries")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                    activeListTab === "countries"
                      ? "bg-surface-highlight text-text-base"
                      : "text-text-secondary hover:text-text-base"
                  }`}
                >
                  Quốc gia
                </button>
                <button
                  onClick={() => setActiveListTab("ips")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                    activeListTab === "ips"
                      ? "bg-surface-highlight text-text-base"
                      : "text-text-secondary hover:text-text-base"
                  }`}
                >
                  Địa chỉ IP
                </button>
                <button
                  onClick={() => setActiveListTab("requests")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                    activeListTab === "requests"
                      ? "bg-surface-highlight text-text-base"
                      : "text-text-secondary hover:text-text-base"
                  }`}
                >
                  Yêu cầu
                </button>
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto">
              {listData.length === 0 ? (
                <div className="rounded-xl border border-border-color bg-background-dark/40 p-4 text-center text-sm text-text-secondary">
                  Chưa có dữ liệu cho tab này
                </div>
              ) : (
                listData.map((item, idx) => (
                  <div
                    key={`${activeListTab}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-border-color bg-background-dark/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-text-secondary w-4">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-text-base truncate">
                        {item.label}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-text-base">
                      {fmt(item.requests)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Lượt xem video / phút"
            value={fmt(snapshot.product.videoViewsPerMin)}
            icon="play_circle"
            accent="bg-indigo-500/20"
          />
          <MetricCard
            title="Lượt ôn từ / phút"
            value={fmt(snapshot.product.flashcardsPerMin)}
            icon="style"
            accent="bg-fuchsia-500/20"
          />
          <MetricCard
            title="Nguồn dữ liệu"
            value={getModeLabel(snapshot.mode)}
            icon="bolt"
            accent="bg-emerald-500/20"
            sub={
              permissions?.canViewInfrastructure
                ? "Đã bật phân tích hạ tầng"
                : "Bị giới hạn bởi quyền"
            }
          />
        </section>
      </div>
    </AdminLayout>
  );
}
