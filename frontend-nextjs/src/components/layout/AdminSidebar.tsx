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
  { label: "Realtime Analytics", path: "/admin/analytics", icon: "analytics" },
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
    if (path === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(path);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-border-color bg-background-dark p-4 justify-between shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-72"
        }`}
      >
        <div className="flex flex-col gap-8">
          {/* Header: Hamburger LEFT + Brand */}
          <div className="flex items-center gap-2 px-1">
            {/* Menu Toggle - LEFT of logo */}
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

            {/* Brand - Hidden entirely when collapsed */}
            {!isCollapsed && (
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
            )}
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all ${
                  isCollapsed ? "justify-center" : ""
                } ${
                  isActive(item.path)
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-on-primary shadow-md shadow-amber-500/20"
                    : "text-text-secondary hover:bg-surface-highlight hover:text-text-base"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon name={item.icon} filled={isActive(item.path)} />
                {!isCollapsed && (
                  <p
                    className={`text-sm ${isActive(item.path) ? "font-bold" : "font-medium"}`}
                  >
                    {item.label}
                  </p>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className={`flex items-center gap-4 px-3 py-3 rounded-xl text-text-secondary hover:bg-surface-highlight hover:text-text-base transition-colors ${
              isCollapsed ? "justify-center" : ""
            }`}
            title={isCollapsed ? "Về User Dashboard" : undefined}
          >
            <Icon name="arrow_back" />
            {!isCollapsed && (
              <p className="text-sm font-medium">Về User Dashboard</p>
            )}
          </Link>

          {/* Admin Info - Only show when expanded */}
          {!isCollapsed && (
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
                  <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider">
                    {displayRole}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile/Tablet Overlay - Always rendered, animated with opacity */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Mobile/Tablet Sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 flex flex-col border-r border-border-color bg-background-dark p-4 justify-between z-50 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-8">
          {/* Header */}
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

          {/* Navigation */}
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

        {/* Bottom */}
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
