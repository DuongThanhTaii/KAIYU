"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Icon from "../common/Icon";
import { useAuth } from "../../contexts/AuthContext";
import { progressApi } from "../../services/progressApi";

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Trang chủ", path: "/dashboard", icon: "home" },
  { label: "Học video", path: "/learn", icon: "school" },
  { label: "Từ vựng", path: "/vocab", icon: "menu_book" },
  { label: "Ôn tập", path: "/review", icon: "history_edu" },
  { label: "Thành tựu", path: "/achievements", icon: "emoji_events" },
  { label: "Tiến độ", path: "/profile", icon: "insights" },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [dailyProgress, setDailyProgress] = useState<number>(0);
  const [minutesStudied, setMinutesStudied] = useState<number>(0);

  const isActive = (path: string) => pathname === path;

  const fetchDailyProgress = useCallback(async () => {
    try {
      const daily = await progressApi.getDailyProgress();
      const dailyGoal = user?.dailyGoalMinutes || 30;
      const minutes = daily.watchTimeMinutes || 0;
      const percent = Math.min(100, Math.round((minutes / dailyGoal) * 100));
      setMinutesStudied(minutes);
      setDailyProgress(percent);
    } catch (err) {
      console.error("Failed to fetch daily progress:", err);
    }
  }, [user?.dailyGoalMinutes]);

  useEffect(() => {
    fetchDailyProgress();
  }, [fetchDailyProgress]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  return (
    <>
      <aside
        className={`hidden lg:flex flex-col border-r border-border-color bg-[var(--color-background-dark)] p-4 justify-between shrink-0 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isCollapsed ? "w-20" : "w-72"}`}
      >
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-2 px-1 min-h-12">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-surface-highlight transition-colors shrink-0 inline-flex items-center justify-center cursor-pointer"
              title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
            >
              <Icon
                name="menu"
                size="md"
                className="text-text-secondary hover:text-text-base"
              />
            </button>

            <div
              className="flex items-center gap-2 overflow-hidden"
              style={{
                transition:
                  "max-width 360ms ease, opacity 240ms ease, transform 240ms ease",
                maxWidth: isCollapsed ? 0 : 240,
                opacity: isCollapsed ? 0 : 1,
                transform: isCollapsed ? "translateX(-6px)" : "translateX(0)",
              }}
              aria-hidden={isCollapsed}
            >
                <div className="size-9 flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-white">
                  <Image
                    src="/images/logo_nentrang.png"
                    alt="KAIYU Logo"
                    width={36}
                    height={36}
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-extrabold text-base tracking-widest text-text-base uppercase">
                    KAIYU
                  </span>
                  <span className="text-[7px] font-semibold tracking-[0.15em] text-text-secondary uppercase">
                    CHINESE LANGUAGE SYSTEM
                  </span>
                </div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center px-3 py-3 rounded-xl transition-colors duration-300 overflow-hidden ${
                  isActive(item.path)
                    ? "bg-primary text-on-primary shadow-md shadow-primary/10"
                    : "text-text-secondary hover:bg-surface-highlight hover:text-text-base"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="w-6 min-w-6 flex items-center justify-center">
                  <Icon name={item.icon} filled={isActive(item.path)} />
                </span>
                <span
                  className={`text-sm ${isActive(item.path) ? "font-bold" : "font-medium"}`}
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition:
                      "max-width 320ms ease, opacity 220ms ease, transform 220ms ease, margin 320ms ease",
                    opacity: isCollapsed ? 0 : 1,
                    transform: isCollapsed ? "translateX(-6px)" : "translateX(0)",
                    maxWidth: isCollapsed ? 0 : 180,
                    marginLeft: isCollapsed ? 0 : 16,
                  }}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/settings"
            className="flex items-center px-3 py-3 rounded-xl text-text-secondary hover:bg-surface-highlight hover:text-text-base transition-colors duration-300 overflow-hidden"
            title={isCollapsed ? "Cài đặt" : undefined}
          >
            <span className="w-6 min-w-6 flex items-center justify-center">
              <Icon name="settings" />
            </span>
            <span
              className="text-sm font-medium"
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition:
                  "max-width 320ms ease, opacity 220ms ease, transform 220ms ease, margin 320ms ease",
                opacity: isCollapsed ? 0 : 1,
                transform: isCollapsed ? "translateX(-6px)" : "translateX(0)",
                maxWidth: isCollapsed ? 0 : 180,
                marginLeft: isCollapsed ? 0 : 16,
              }}
            >
              Cài đặt
            </span>
          </Link>

          {!isCollapsed ? (
            <div className="px-4 py-4 mt-2 rounded-xl bg-surface-dark border border-border-color shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-secondary uppercase">
                  Mục tiêu hôm nay
                </span>
                <span className="text-xs font-bold text-text-base">
                  {dailyProgress}%
                </span>
              </div>
              <div className="h-2 w-full bg-surface-highlight rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${dailyProgress}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-text-secondary text-center">
                {minutesStudied}/{user?.dailyGoalMinutes || 30} phút
              </div>
            </div>
          ) : (
            <div className="flex justify-center mt-2">
              <div
                className="relative w-12 h-12"
                title={`Mục tiêu: ${dailyProgress}%`}
              >
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-border-color"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-primary"
                    strokeDasharray={`${dailyProgress * 1.26} 126`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-text-base">
                  {dailyProgress}%
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div
        className={`lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileOpen(false)}
      />

      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 flex flex-col border-r border-border-color bg-[var(--color-background-dark)] p-4 justify-between z-50 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-2 px-1">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-lg hover:bg-surface-highlight transition-colors inline-flex items-center justify-center cursor-pointer"
            >
              <Icon name="close" size="md" className="text-text-secondary" />
            </button>
            <div className="flex items-center gap-2">
              <div className="size-9 flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-white">
                <Image
                  src="/images/logo_nentrang.png"
                  alt="KAIYU Logo"
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-base tracking-widest text-text-base uppercase">
                  KAIYU
                </span>
                <span className="text-[7px] font-semibold tracking-[0.15em] text-text-secondary uppercase">
                  CHINESE LANGUAGE SYSTEM
                </span>
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all ${
                  isActive(item.path)
                    ? "bg-primary text-on-primary shadow-md shadow-primary/10"
                    : "text-text-secondary hover:bg-surface-highlight hover:text-text-base"
                }`}
              >
                <Icon name={item.icon} filled={isActive(item.path)} />
                <p
                  className={`text-sm ${isActive(item.path) ? "font-bold" : "font-medium"}`}
                >
                  {item.label}
                </p>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/settings"
            className="flex items-center gap-4 px-3 py-3 rounded-xl text-text-secondary hover:bg-surface-highlight hover:text-text-base transition-colors"
          >
            <Icon name="settings" />
            <p className="text-sm font-medium">Cài đặt</p>
          </Link>
          <div className="px-4 py-4 mt-2 rounded-xl bg-surface-dark border border-border-color shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-secondary uppercase">
                Mục tiêu hôm nay
              </span>
              <span className="text-xs font-bold text-text-base">
                {dailyProgress}%
              </span>
            </div>
            <div className="h-2 w-full bg-surface-highlight rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${dailyProgress}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-text-secondary text-center">
              {minutesStudied}/{user?.dailyGoalMinutes || 30} phút
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
