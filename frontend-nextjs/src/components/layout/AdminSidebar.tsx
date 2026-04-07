"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Icon from "../common/Icon";

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: "dashboard" },
  { label: "Quản lý Video", path: "/admin/videos", icon: "video_library" },
  { label: "Quản lý Từ vựng", path: "/admin/vocabulary", icon: "translate" },
  { label: "Quản lý Users", path: "/admin/users", icon: "group" },
  { label: "Achievements", path: "/admin/achievements", icon: "emoji_events" },
  { label: "Email Templates", path: "/admin/emails", icon: "mail" },
  { label: "Cài đặt Website", path: "/admin/settings", icon: "settings" },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const displayName = user?.name || "Admin User";
  const displayRole =
    user?.role === "admin" ? "Super Admin" : user?.role || "Admin";
  const initial = displayName.charAt(0).toUpperCase();

  const isActive = (path: string) => {
    if (path === "/admin") return pathname === "/admin";
    return pathname?.startsWith(path);
  };

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  return (
    <>
      <aside
        className={`hidden lg:flex flex-col border-r border-border-color bg-background-dark p-4 justify-between shrink-0 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCollapsed ? "w-20" : "w-72"
        }`}
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
              <div className="size-9 flex items-center justify-center shrink-0">
                <Image
                  src="/images/logo_nentrang.png"
                  alt="KAIYU Logo"
                  width={36}
                  height={36}
                  className="object-contain rounded-full"
                />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-base tracking-widest text-text-base uppercase">
                  KAIYU
                </span>
                <span className="text-[7px] font-semibold tracking-[0.15em] text-text-muted uppercase">
                  ADMIN PANEL
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
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-on-primary shadow-md shadow-amber-500/20"
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
                    maxWidth: isCollapsed ? 0 : 190,
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
            href="/dashboard"
            className="flex items-center px-3 py-3 rounded-xl text-text-secondary hover:bg-surface-highlight hover:text-text-base transition-colors duration-300 overflow-hidden"
            title={isCollapsed ? "Về User Dashboard" : undefined}
          >
            <span className="w-6 min-w-6 flex items-center justify-center">
              <Icon name="arrow_back" />
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
                maxWidth: isCollapsed ? 0 : 190,
                marginLeft: isCollapsed ? 0 : 16,
              }}
            >
              Về User Dashboard
            </span>
          </Link>

          <div
            className="px-4 mt-2 rounded-xl bg-surface-dark border border-border-color shadow-sm overflow-hidden"
            style={{
              transition: "max-height 320ms ease, opacity 220ms ease, padding 320ms ease",
              maxHeight: isCollapsed ? 0 : 120,
              opacity: isCollapsed ? 0 : 1,
              paddingTop: isCollapsed ? 0 : 16,
              paddingBottom: isCollapsed ? 0 : 16,
            }}
            aria-hidden={isCollapsed}
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-on-primary font-bold shadow-md shadow-amber-500/20 overflow-hidden shrink-0">
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={displayName}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-base truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider">
                  {displayRole}
                </p>
              </div>
            </div>
          </div>
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
        className={`lg:hidden fixed top-0 left-0 h-full w-72 flex flex-col border-r border-border-color bg-background-dark p-4 justify-between z-50 transition-transform duration-300 ease-in-out ${
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
              <div className="size-9 flex items-center justify-center shrink-0">
                <Image
                  src="/images/logo_nentrang.png"
                  alt="KAIYU Logo"
                  width={36}
                  height={36}
                  className="object-contain rounded-full"
                />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-base tracking-widest text-text-base uppercase">
                  KAIYU
                </span>
                <span className="text-[7px] font-semibold tracking-[0.15em] text-text-muted uppercase">
                  ADMIN PANEL
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
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-on-primary shadow-md shadow-amber-500/20"
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
            href="/dashboard"
            className="flex items-center gap-4 px-3 py-3 rounded-xl text-text-secondary hover:bg-surface-highlight hover:text-text-base transition-colors"
          >
            <Icon name="arrow_back" />
            <p className="text-sm font-medium">Về User Dashboard</p>
          </Link>
          <div className="px-4 py-4 mt-2 rounded-xl bg-surface-dark border border-border-color shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-on-primary font-bold shadow-md shadow-amber-500/20 overflow-hidden shrink-0">
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={displayName}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-base truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-amber-500 dark:text-amber-400/70 font-medium uppercase tracking-wider">
                  {displayRole}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
