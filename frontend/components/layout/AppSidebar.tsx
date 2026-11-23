"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import type { SessionUser, UserRole } from "@/lib/auth-server";

type NavItem = {
  label: string;
  href: string;
  /** Roles allowed to see this item; omitted means everyone. */
  roles?: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Clientes", href: "/clientes", roles: ["ADMIN", "PLANNING"] },
  { label: "Orçamentos", href: "/orcamentos", roles: ["ADMIN", "PLANNING"] },
  { label: "Serviços", href: "/servicos", roles: ["ADMIN", "PLANNING"] },
  { label: "Visitas", href: "/visitas" },
  { label: "Garantias", href: "/garantias", roles: ["ADMIN", "PLANNING"] },
  { label: "Revisões", href: "/revisoes", roles: ["ADMIN", "PLANNING"] },
  { label: "Usuários", href: "/usuarios", roles: ["ADMIN"] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  PLANNING: "Orçamento / Planejamento",
  TECHNICIAN: "Técnico",
};

export function AppSidebar({
  user,
  mobileOpen,
  onCloseMobile,
}: {
  user: SessionUser;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    if (desktop.matches) return;
    const handleBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) onCloseMobile();
    };
    desktop.addEventListener("change", handleBreakpoint);
    const sidebar = sidebarRef.current;
    const previousFocus = document.activeElement;
    const focusable = () => Array.from(sidebar?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (desktop.matches) return;
      if (event.key === "Escape") onCloseMobile();
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", handleBreakpoint);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [mobileOpen, onCloseMobile]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );

  return (
    <>
      {/* Mobile overlay — visible only when the sidebar is open on small screens. */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-tp-navy-900 text-white transition-transform motion-reduce:transition-none lg:visible lg:static lg:translate-x-0 ${
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        {/* Brand area */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="text-lg font-bold tracking-tight">TechPro</span>
          <span className="text-xs font-medium text-tp-green-400">
            Sistema Interno
          </span>
        </div>

        <button
          type="button"
          onClick={onCloseMobile}
          className="mx-3 mt-3 rounded-tp-sm px-3 py-3 text-left text-sm font-medium hover:bg-white/10 lg:hidden"
          aria-label="Fechar menu"
        >
          Fechar menu
        </button>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto py-4"
          aria-label="Navegação principal"
        >
          <ul className="flex flex-col gap-1 px-3">
            {visibleItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onCloseMobile}
                    className={`block rounded-tp-sm px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-tp-green-500 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User info at the bottom */}
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-white/50">
            {ROLE_LABELS[user.role] ?? user.role}
          </p>
        </div>
      </aside>
    </>
  );
}