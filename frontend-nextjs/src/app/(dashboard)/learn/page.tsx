"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/common/Card";
import Icon from "@/components/common/Icon";
import Button from "@/components/common/Button";
import {
  videoApi,
  type Video,
  type Category,
  type RecommendationsResponse,
  type RecommendationItem,
} from "@/services/videoApi";
import { progressApi, type VideoProgress } from "@/services/progressApi";

export default function VideoLibraryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [continueWatching, setContinueWatching] =
    useState<VideoProgress | null>(null);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] =
    useState<RecommendationsResponse | null>(null);
  const [isRecoLoading, setIsRecoLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeHskFilter, setActiveHskFilter] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const hskLevels = [1, 2, 3, 4, 5, 6];

  const formatRecoReason = (item?: RecommendationItem | null) => {
    if (!item) return "Chưa đủ dữ liệu, bắt đầu với video phù hợp nhất";
    return (
      item.reasons?.slice(0, 2).join(" • ") ||
      `~${item.estimatedNewWords} từ mới`
    );
  };

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await videoApi.getAll({
        page: currentPage,
        limit: 12,
        hskLevel: activeHskFilter || undefined,
        category: activeCategory || undefined,
        search: searchQuery || undefined,
      });
      setVideos(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load videos";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, activeHskFilter, activeCategory, searchQuery]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const cats = await videoApi.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsRecoLoading(true);
      try {
        const data = await videoApi.getRecommendations("learn", 4);
        setRecommendations(data);
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
        setRecommendations(null);
      } finally {
        setIsRecoLoading(false);
      }
    };
    fetchRecommendations();
  }, []);

  // Fetch continue watching
  useEffect(() => {
    const fetchContinueWatching = async () => {
      const progress = await progressApi.getContinueWatching();
      setContinueWatching(progress);
    };
    fetchContinueWatching();
  }, []);

  // Fetch saved video ids
  useEffect(() => {
    const fetchSavedIds = async () => {
      const ids = await videoApi.getSavedVideoIds();
      setSavedVideoIds(new Set(ids));
    };
    fetchSavedIds();
  }, []);

  // Handle save/unsave video
  const handleToggleSave = async (e: React.MouseEvent, videoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isSaved = savedVideoIds.has(videoId);
    try {
      const newSavedState = await videoApi.toggleSaveVideo(videoId, isSaved);
      setSavedVideoIds((prev) => {
        const newSet = new Set(prev);
        if (newSavedState) {
          newSet.add(videoId);
        } else {
          newSet.delete(videoId);
        }
        return newSet;
      });
    } catch (err) {
      console.error("Failed to toggle save:", err);
    }
  };

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchVideos();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Helper to get thumbnail
  const getThumbnail = (video: Video): string => {
    if (video.thumbnailUrl) return video.thumbnailUrl;
    if (videoApi.isYouTubeUrl(video.videoUrl)) {
      return (
        videoApi.getYouTubeThumbnail(video.videoUrl) || "/placeholder-video.jpg"
      );
    }
    return "/placeholder-video.jpg";
  };

  const getRecommendationThumbnail = (
    video: RecommendationItem["video"],
  ): string => {
    if (video?.thumbnailUrl) return video.thumbnailUrl;
    if (video?.videoUrl && videoApi.isYouTubeUrl(video.videoUrl)) {
      return (
        videoApi.getYouTubeThumbnail(video.videoUrl) || "/placeholder-video.jpg"
      );
    }
    return "/placeholder-video.jpg";
  };

  // Get HSK badge color class
  const getHskBadgeColor = (level: number): string => {
    const colors: Record<number, string> = {
      1: "bg-blue-600",
      2: "bg-emerald-600",
      3: "bg-amber-600",
      4: "bg-orange-600",
      5: "bg-purple-600",
      6: "bg-red-600",
    };
    return colors[level] || "bg-gray-600";
  };

  // Reset all filters
  // Reset all filters
  const resetFilters = () => {
    setActiveHskFilter(null);
    setActiveCategory(null);
    setSearchQuery("");
    setCurrentPage(1);
  };

  // HSK Level color map for chips
  const hskColorMap: Record<number, { active: string; inactive: string }> = {
    1: {
      active:
        "bg-[var(--color-hsk1)] text-white border-[var(--color-hsk1)] shadow-[0_0_15px_rgba(59,130,246,0.4)]",
      inactive:
        "border-[var(--color-hsk1)]/30 text-[var(--color-hsk1)] bg-[var(--color-hsk1)]/5 hover:bg-[var(--color-hsk1)]/10",
    },
    2: {
      active:
        "bg-[var(--color-hsk2)] text-white border-[var(--color-hsk2)] shadow-[0_0_15px_rgba(16,185,129,0.4)]",
      inactive:
        "border-[var(--color-hsk2)]/30 text-[var(--color-hsk2)] bg-[var(--color-hsk2)]/5 hover:bg-[var(--color-hsk2)]/10",
    },
    3: {
      active:
        "bg-[var(--color-hsk3)] text-white border-[var(--color-hsk3)] shadow-[0_0_15px_rgba(245,158,11,0.4)]",
      inactive:
        "border-[var(--color-hsk3)]/30 text-[var(--color-hsk3)] bg-[var(--color-hsk3)]/5 hover:bg-[var(--color-hsk3)]/10",
    },
    4: {
      active:
        "bg-[var(--color-hsk4)] text-white border-[var(--color-hsk4)] shadow-[0_0_15px_rgba(249,115,22,0.4)]",
      inactive:
        "border-[var(--color-hsk4)]/30 text-[var(--color-hsk4)] bg-[var(--color-hsk4)]/5 hover:bg-[var(--color-hsk4)]/10",
    },
    5: {
      active:
        "bg-[var(--color-hsk5)] text-white border-[var(--color-hsk5)] shadow-[0_0_15px_rgba(139,92,246,0.4)]",
      inactive:
        "border-[var(--color-hsk5)]/30 text-[var(--color-hsk5)] bg-[var(--color-hsk5)]/5 hover:bg-[var(--color-hsk5)]/10",
    },
    6: {
      active:
        "bg-[var(--color-hsk6)] text-white border-[var(--color-hsk6)] shadow-[0_0_15px_rgba(239,68,68,0.4)]",
      inactive:
        "border-[var(--color-hsk6)]/30 text-[var(--color-hsk6)] bg-[var(--color-hsk6)]/5 hover:bg-[var(--color-hsk6)]/10",
    },
  };

  const renderRecommendationLanes = () => (
    <>
      {/* Recommendation Lanes */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-surface-dark/40 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider font-black text-primary">
              Học tiếp theo
            </p>
            {recommendations?.nextUp && (
              <span className="text-[11px] font-bold text-text-secondary">
                Match {recommendations.nextUp.score}%
              </span>
            )}
          </div>
          {isRecoLoading ? (
            <div className="h-36 rounded-2xl bg-surface-highlight animate-pulse" />
          ) : recommendations?.nextUp ? (
            <Link
              href={`/learn/${recommendations.nextUp.video.id}`}
              className="block group"
            >
              <div className="rounded-xl border border-white/10 bg-background-dark/35 p-3 hover:border-primary/40 transition-colors">
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-center">
                  <div
                    className="rounded-lg bg-cover bg-center min-h-[96px] sm:min-h-[84px]"
                    style={{
                      backgroundImage: `url(${getRecommendationThumbnail(recommendations.nextUp.video)})`,
                    }}
                  />
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-text-base line-clamp-1">
                      {recommendations.nextUp.video.title}
                    </h3>
                    <p className="mt-1 text-sm text-text-secondary line-clamp-1">
                      {formatRecoReason(recommendations.nextUp)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-text-secondary line-clamp-1">
                        Ước tính hiểu{" "}
                        {recommendations.nextUp.estimatedComprehension}% • ~
                        {recommendations.nextUp.estimatedNewWords} từ mới
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary text-sm font-semibold shrink-0">
                        Học ngay <Icon name="arrow_forward" size="sm" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-white/20 bg-background-dark/20 p-4 text-sm text-text-secondary">
              Chưa đủ dữ liệu đề xuất. Hãy xem 1-2 video HSK phù hợp để hệ thống
              cá nhân hóa.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface-dark/40 p-4 md:p-5">
          <p className="text-xs uppercase tracking-wider font-black text-text-secondary mb-3">
            Cần ôn hôm nay
          </p>
          {isRecoLoading ? (
            <div className="space-y-2">
              <div className="h-12 rounded-xl bg-surface-highlight animate-pulse" />
              <div className="h-12 rounded-xl bg-surface-highlight animate-pulse" />
            </div>
          ) : (recommendations?.review?.length || 0) > 0 ? (
            <div className="space-y-2">
              {recommendations!.review.slice(0, 3).map((item) => (
                <Link
                  key={item.video.id}
                  href={`/learn/${item.video.id}`}
                  className="block rounded-lg border border-white/10 bg-background-dark/30 p-2.5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="size-11 rounded-md bg-cover bg-center shrink-0"
                      style={{
                        backgroundImage: `url(${getRecommendationThumbnail(item.video)})`,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-base line-clamp-1">
                        {item.video.title}
                      </p>
                      <p className="text-xs text-text-secondary line-clamp-1">
                        {formatRecoReason(item)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Bạn chưa có video cần ôn.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-surface-dark/40 p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider font-black text-text-secondary">
            Vừa sức với bạn
          </p>
          {(recommendations?.suited?.length || 0) > 0 && (
            <span className="text-[11px] text-text-secondary"></span>
          )}
        </div>
        {isRecoLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="h-20 rounded-lg bg-surface-highlight animate-pulse" />
            <div className="h-20 rounded-lg bg-surface-highlight animate-pulse" />
            <div className="h-20 rounded-lg bg-surface-highlight animate-pulse" />
          </div>
        ) : (recommendations?.suited?.length || 0) > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendations!.suited.slice(0, 3).map((item) => (
              <Link
                key={item.video.id}
                href={`/learn/${item.video.id}`}
                className="rounded-xl border border-white/10 bg-background-dark/30 p-2.5 hover:border-primary/40 transition-colors"
              >
                <div
                  className="w-full h-24 rounded-lg bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${getRecommendationThumbnail(item.video)})`,
                  }}
                />
                <p className="text-sm font-semibold text-text-base line-clamp-2 mt-2">
                  {item.video.title}
                </p>
                <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                  {formatRecoReason(item)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/20 bg-background-dark/20 p-4">
            <p className="text-sm text-text-secondary">
              Chưa đủ dữ liệu đề xuất. Hãy học 1-2 video để mở lộ trình phù hợp.
            </p>
          </div>
        )}
      </section>
    </>
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 pb-10">
        {/* Hero Section: Continue Watching */}
        {continueWatching && (
          <Link href={`/learn/${continueWatching.videoId}`}>
            <div className="relative w-full h-[280px] md:h-[320px] rounded-2xl overflow-hidden group cursor-pointer">
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage: `url(${continueWatching.video.thumbnailUrl || "/placeholder-video.jpg"})`,
                }}
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background-dark)] via-[var(--color-background-dark)]/40 to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex flex-col gap-3 max-w-2xl">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-primary/90 backdrop-blur-sm text-on-primary text-xs font-black uppercase tracking-wide rounded-full">
                      Tiếp tục học
                    </span>
                    <span className="text-primary text-sm font-black flex items-center gap-1">
                      <Icon name="schedule" size="sm" />
                      {progressApi.formatRemainingTime(continueWatching)}
                    </span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-black text-text-base leading-tight">
                    {continueWatching.video.title}
                  </h1>
                  <p className="text-text-secondary text-sm md:text-base font-bold">
                    HSK {continueWatching.video.hskLevel} •{" "}
                    <span className="text-primary">Tiếp tục từ lần trước</span>
                  </p>
                  {/* Progress Bar */}
                  <div className="w-full max-w-md h-2 bg-border-color rounded-full mt-2 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-primary rounded-full transition-all shadow-[0_0_10px_rgba(76,223,32,0.3)]"
                      style={{ width: `${continueWatching.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-text-secondary text-xs font-bold">
                    {Math.round(continueWatching.progressPercent)}% hoàn thành
                  </span>
                </div>
                {/* Play Button */}
                <div className="size-14 md:size-16 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_25px_rgba(76,223,32,0.4)]">
                  <Icon name="play_arrow" size="lg" filled className="ml-1" />
                </div>
              </div>
            </div>
          </Link>
        )}

        {!continueWatching && (
          <section className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 md:p-5">
            <p className="text-sm text-text-secondary">
              Bạn chưa có mục xem tiếp. Hệ thống sẽ gợi ý bài bắt đầu phù hợp
              ngay bên dưới.
            </p>
          </section>
        )}

        {renderRecommendationLanes()}

        {/* Filters Section: Pro Toolbar Style */}
        <div className="bg-surface-highlight/30 p-3 md:p-4 rounded-2xl border border-white/5 flex flex-col gap-3 shadow-lg">
          {/* Top Row: Search & Reset */}
          <div className="flex items-center gap-3">
            <div className="relative group flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Icon
                  name="search"
                  size="sm"
                  className="text-text-secondary group-focus-within:text-primary transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm video hoặc nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-4 rounded-xl bg-surface-dark border border-border-color text-text-base text-sm placeholder-text-secondary focus:outline-none focus:border-primary/40 w-full transition-all shadow-inner font-bold"
              />
            </div>

            <button
              onClick={resetFilters}
              className="h-10 px-4 rounded-xl bg-surface-dark border border-border-color hover:border-text-secondary text-text-secondary hover:text-text-base transition-all font-bold text-xs flex items-center gap-2 shrink-0 shadow-sm"
              title="Đặt lại bộ lọc"
            >
              <Icon name="restart_alt" size="sm" />
              <span className="whitespace-nowrap">Đặt lại</span>
            </button>
          </div>

          {/* Bottom Section: Combined Scroll for HSK & Categories */}
          <div className="flex flex-col gap-3">
            {/* HSK Rows */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide mask-fade-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 whitespace-nowrap">
                HSK:
              </span>
              <button
                onClick={() => setActiveHskFilter(null)}
                className={`h-8 px-3.5 rounded-lg text-[11px] font-black transition-all shadow-sm border ${
                  !activeHskFilter
                    ? "bg-primary text-on-primary border-primary scale-105 shadow-lg shadow-primary/20"
                    : "bg-surface-dark hover:bg-surface-highlight text-text-base border-border-color"
                }`}
              >
                Tất cả
              </button>
              {hskLevels.map((level) => {
                const style = hskColorMap[level];
                const isActive = activeHskFilter === level;
                return (
                  <button
                    key={level}
                    onClick={() => setActiveHskFilter(isActive ? null : level)}
                    className={`h-8 px-3.5 rounded-lg text-[11px] font-black transition-all shadow-sm border shrink-0 ${
                      isActive
                        ? `${style.active} scale-105`
                        : `${style.inactive}`
                    }`}
                  >
                    HSK {level}
                  </button>
                );
              })}
            </div>

            {/* Category Row */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide mask-fade-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 whitespace-nowrap">
                Chủ đề:
              </span>
              <div className="flex gap-2 shrink-0">
                {categories
                  .filter((c) => c.category && c.category.trim())
                  .map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() =>
                        setActiveCategory(
                          activeCategory === cat.category ? null : cat.category,
                        )
                      }
                      className={`flex items-center gap-2 h-8 px-3 rounded-lg shrink-0 transition-all font-bold border ${
                        activeCategory === cat.category
                          ? "bg-primary text-on-primary border-primary shadow-md scale-105"
                          : "bg-surface-dark border-border-color hover:border-text-secondary text-text-secondary hover:text-text-base hover:bg-surface-highlight"
                      }`}
                    >
                      <span className="text-[11px] whitespace-nowrap">
                        {cat.category}
                      </span>
                      {cat.count > 0 && (
                        <span
                          className={`text-[9px] px-1 py-0.5 rounded-md ${
                            activeCategory === cat.category
                              ? "bg-white/20"
                              : "bg-white/5 text-text-secondary/50"
                          }`}
                        >
                          {cat.count}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchVideos}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && videos.length === 0 && (
          <div className="text-center py-16">
            <Icon
              name="video_library"
              size="xl"
              className="text-text-secondary mb-4"
            />
            <h3 className="text-xl font-bold text-text-base mb-2">
              Không tìm thấy video
            </h3>
            <p className="text-text-secondary mb-6">
              Thử điều chỉnh bộ lọc để tìm nội dung khác.
            </p>
            <Button variant="secondary" onClick={resetFilters}>
              Xóa bộ lọc
            </Button>
          </div>
        )}

        {/* Bento Grid */}
        {!isLoading && videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {videos.map((video, index) => (
              <Link
                key={video.id}
                href={`/detail/${video.id}`}
                className={index === 0 ? "sm:col-span-2" : ""}
              >
                <Card
                  variant="default"
                  padding="none"
                  className={`overflow-hidden group h-full flex flex-col hover:shadow-lg hover:shadow-black/20 transition-all ${
                    index === 0 ? "min-h-[280px]" : ""
                  }`}
                >
                  {/* Thumbnail */}
                  <div
                    className={`relative overflow-hidden ${index === 0 ? "aspect-[2/1]" : "aspect-video"}`}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                      style={{ backgroundImage: `url(${getThumbnail(video)})` }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Icon
                        name="play_circle"
                        size="xl"
                        className="text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all drop-shadow-lg text-5xl"
                      />
                    </div>

                    {/* Duration Badge */}
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-bold text-white">
                      {videoApi.formatDuration(video.durationSeconds)}
                    </span>

                    {/* HSK Badge */}
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm ${getHskBadgeColor(video.hskLevel)}`}
                    >
                      HSK {video.hskLevel}
                    </span>

                    {/* Featured Badge for first item */}
                    {index === 0 && (
                      <span className="absolute top-2 right-2 px-2.5 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-lg text-white text-xs font-bold uppercase">
                        Nổi bật
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="text-text-base font-black text-lg leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                        {video.title}
                      </h4>
                      <p className="text-text-secondary text-xs font-bold">
                        {video.category} •{" "}
                        {video.hskLevel <= 2
                          ? "Sơ cấp"
                          : video.hskLevel <= 4
                            ? "Trung cấp"
                            : "Cao cấp"}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between border-t border-border-color pt-3">
                      <div className="flex items-center gap-1">
                        <Icon
                          name="visibility"
                          size="sm"
                          className="text-text-secondary"
                        />
                        <span className="text-text-secondary text-xs">
                          {video.viewCount >= 1000
                            ? `${(video.viewCount / 1000).toFixed(1)}k`
                            : video.viewCount}{" "}
                          views
                        </span>
                      </div>
                      <button
                        className={`transition-colors ${savedVideoIds.has(video.id) ? "text-primary" : "text-text-base hover:text-primary"}`}
                        onClick={(e) => handleToggleSave(e, video.id)}
                      >
                        <Icon
                          name={
                            savedVideoIds.has(video.id)
                              ? "bookmark"
                              : "bookmark_add"
                          }
                          size="md"
                          filled={savedVideoIds.has(video.id)}
                        />
                      </button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex justify-center py-4">
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-base hover:bg-surface-highlight border border-transparent hover:border-border-color transition-all disabled:opacity-30"
              >
                <Icon name="chevron_left" size="md" />
              </button>

              {Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => i + 1,
              ).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`size-9 rounded-full font-medium text-sm transition-colors ${
                    currentPage === page
                      ? "bg-primary text-on-primary font-bold"
                      : "text-text-secondary hover:bg-surface-highlight hover:text-text-base"
                  }`}
                >
                  {page}
                </button>
              ))}

              {totalPages > 5 && (
                <span className="text-text-secondary text-sm">...</span>
              )}

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="size-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-base hover:bg-surface-highlight border border-transparent hover:border-border-color transition-all disabled:opacity-30"
              >
                <Icon name="chevron_right" size="md" />
              </button>
            </nav>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
