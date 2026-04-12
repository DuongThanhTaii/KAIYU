"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Icon from "@/components/common/Icon";
import ThemedDateRangePicker from "@/components/common/ThemedDateRangePicker";
import {
  getAdminApiBaseUrl,
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

const formatXAxisLabelParts = (raw: string) => {
  const label = String(raw || "").trim().replace(/\s+/g, " ");
  const timeDate = label.match(/^(\d{2}:\d{2})(?::\d{2})?\s+(\d{2})[/-](\d{2})$/);
  if (timeDate) {
    return { top: timeDate[1], bottom: `${timeDate[2]}/${timeDate[3]}` };
  }

  const dateTime = label.match(/^(\d{2})[/-](\d{2})\s+(\d{2}:\d{2})(?::\d{2})?$/);
  if (dateTime) {
    return { top: dateTime[3], bottom: `${dateTime[1]}/${dateTime[2]}` };
  }

  if (label.includes(" ")) {
    const [first, second] = label.split(" ");
    return { top: first, bottom: second };
  }

  return { top: label };
};

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

export default function AdminRealtimeAnalyticsSection() {
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
  const [showRangeFilter, setShowRangeFilter] = useState(false);
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const reconnectRef = useRef<number | null>(null);

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
    abortRef.current?.abort();
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const connect = async () => {
      try {
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
          },
          credentials: "include",
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
    permissions?.defaultStreamIntervalSec,
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
    setShowRangeFilter(false);
  };

  const clearDateRange = () => {
    setFromDateInput("");
    setToDateInput("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setError(null);
    setShowRangeFilter(false);
  };

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

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
      return (maxTimeline * (segments - index)) / segments;
    });
  }, [maxTimeline]);

  const xAxisLabelIndexes = useMemo(() => {
    if (!snapshot?.timeline?.length) return [] as number[];
    const len = snapshot.timeline.length;
    if (len <= 5) {
      return Array.from({ length: len }, (_, i) => i);
    }

    const slots = 5;
    const picked = new Set<number>([0, len - 1]);
    for (let i = 1; i < slots - 1; i += 1) {
      picked.add(Math.round((i * (len - 1)) / (slots - 1)));
    }
    return Array.from(picked).sort((a, b) => a - b);
  }, [snapshot?.timeline]);

  const formatAxisValue = useCallback(
    (value: number) => {
      if (maxTimeline <= 5) {
        return value.toFixed(1).replace(/\.0$/, "");
      }
      if (maxTimeline <= 20) {
        return String(Math.round(value));
      }
      return fmt(Math.round(value));
    },
    [maxTimeline],
  );

  const formatTime = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border-color bg-surface-dark p-6">
        <div className="h-40 flex items-center justify-center">
          <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  if (error || !snapshot) {
    return (
      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
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
      </section>
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
    <div className="space-y-5">
      <section className="rounded-2xl border border-border-color bg-surface-dark shadow-sm overflow-visible">
        <div className="px-4 md:px-6 py-4 border-b border-border-color bg-background-dark/60">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-black text-text-base tracking-tight">
                Phân tích thời gian thực
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

            <div className="relative flex items-center gap-2 flex-wrap">
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

              <button
                type="button"
                onClick={() => setShowRangeFilter((prev) => !prev)}
                className={`size-9 rounded-lg border border-border-color bg-background-dark flex items-center justify-center transition-all ${
                  showRangeFilter || hasCustomRange
                    ? "text-primary border-primary/50"
                    : "text-text-secondary hover:text-text-base"
                }`}
                title="Lọc theo ngày"
              >
                <Icon name="filter_list" size="sm" />
              </button>

              {showRangeFilter && (
                <div className="absolute right-0 top-full z-20 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-border-color bg-surface-dark p-3 shadow-2xl">
                  <ThemedDateRangePicker
                    fromDate={fromDateInput}
                    toDate={toDateInput}
                    onFromDateChange={setFromDateInput}
                    onToDateChange={setToDateInput}
                  />

                  {hasCustomRange ? (
                    <p className="mt-2 text-xs text-primary font-semibold">
                      Đang lọc: {appliedFromDate} {"->"} {appliedToDate}
                    </p>
                  ) : null}

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={clearDateRange}
                      className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-text-base"
                    >
                      Bỏ lọc
                    </button>
                    <button
                      type="button"
                      onClick={applyDateRange}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                  viewBox="0 0 1000 240"
                  preserveAspectRatio="none"
                >
                  {yAxisTicks.map((tick, index) => {
                    const chartLeft = 76;
                    const chartRight = 980;
                    const chartTop = 14;
                    const chartBottom = 188;
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
                          fontSize="12"
                          fontWeight="700"
                          fill="rgba(186, 205, 230, 0.96)"
                        >
                          {formatAxisValue(tick)}
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
                          const chartBottom = 188;
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

                  {xAxisLabelIndexes.map((index) => {
                    const point = snapshot.timeline[index];
                    if (!point) return null;

                    const chartLeft = 76;
                    const chartRight = 980;
                    const x =
                      snapshot.timeline.length === 1
                        ? (chartLeft + chartRight) / 2
                        : chartLeft +
                          (index / (snapshot.timeline.length - 1)) *
                            (chartRight - chartLeft);
                    const label = formatXAxisLabelParts(point.label);

                    return (
                      <g key={`x-label-${point.label}-${index}`}>
                        <line
                          x1={x}
                          y1={190}
                          x2={x}
                          y2={196}
                          stroke="rgba(148, 163, 184, 0.35)"
                          strokeWidth="1"
                        />
                        <text
                          x={x}
                          y={214}
                          textAnchor="middle"
                          fontSize="11"
                          fill="rgba(186, 205, 230, 0.95)"
                          fontWeight="600"
                        >
                          {label.top}
                          {label.bottom ? (
                            <tspan x={x} dy="12" fill="rgba(148, 163, 184, 0.9)">
                              {label.bottom}
                            </tspan>
                          ) : null}
                        </text>
                      </g>
                    );
                  })}
                </svg>
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
  );
}
