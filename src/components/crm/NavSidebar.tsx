import { Link, useRouterState } from "@tanstack/react-router";
import { PAGE_SECTIONS, type SectionRoute } from "@/lib/page-sections";
import {
  BarChart3,
  Flame,
  BookOpen,
  Boxes,
  Brain,
  Building2,
  DatabaseZap,
  FileText,
  Headset,
  HelpCircle,
  Home,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  Menu,
  Network,
  Newspaper,
  MapPin,
  PhoneCall,
  Server,
  ShieldCheck,
  Ticket,
  Trophy,
  History,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useT } from "@/lib/i18n";
import { useMyAccount, useSignOut } from "@/lib/session";
import { LogOut } from "lucide-react";
import logoAsset from "@/assets/winstone-properties-logo.png.asset.json";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BuildBadge } from "@/components/crm/BuildBadge";

type Item = { to: string; label: string };

export const NAV_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/desk": PhoneCall,
  "/coach": Brain,
  "/leadhub": Network,
  "/hq": LayoutDashboard,
  "/contributions": Trophy,
  "/audit-log": History,
  "/live-leads": Network,
  "/booking-review": ShieldCheck,
  "/staff-portal": Users,
  "/runtime-errors": Server,
  "/load-diagnostics": Server,
  "/sync-failures": Server,
  "/inventory": Building2,
  "/unit-board": Building2,
  "/qualify": Flame,
  "/projects": Building2,
  "/sales-intel": Lightbulb,
  "/news": Newspaper,
  "/site-visits": MapPin,
  "/reports": BarChart3,
  "/facebook-ads": BarChart3,
  "/integrations": Network,
  "/meta-control-center": ShieldCheck,
  "/system": Server,
  "/ingest": DatabaseZap,
  "/migration": Boxes,
  "/migration-export": FileText,
  "/security": KeyRound,
  "/docs": BookOpen,
  "/docs-admin": ShieldCheck,
  "/inbox": Inbox,
  "/tickets": Ticket,
  "/customers": Users,
  "/support-admin": Headset,
  "/help": HelpCircle,
  "/walkthrough": BookOpen,
};

const GROUPS: { title: { bn: string; en: string }; routes: string[] }[] = [
  { title: { bn: "প্রধান", en: "Main" }, routes: ["/", "/desk", "/coach"] },
  { title: { bn: "লিড ও বিক্রয়", en: "Leads & sales" }, routes: ["/leadhub", "/live-leads", "/booking-review", "/sales-intel", "/news", "/site-visits", "/projects", "/inventory", "/unit-board", "/qualify", "/reports"] },
  { title: { bn: "ম্যানেজমেন্ট", en: "Management" }, routes: ["/hq", "/contributions", "/audit-log", "/staff-portal", "/facebook-ads", "/meta-control-center"] },
  { title: { bn: "সাপোর্ট", en: "Support" }, routes: ["/inbox", "/tickets", "/customers", "/support-admin"] },
  {
    title: { bn: "আইটি ও নিরাপত্তা", en: "IT & security" },
    routes: ["/integrations", "/system", "/runtime-errors", "/load-diagnostics", "/sync-failures", "/security", "/ingest", "/migration", "/migration-export"],
  },
  { title: { bn: "সহায়তা", en: "Help" }, routes: ["/walkthrough", "/docs", "/docs-admin", "/help"] },
];

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";

/** Arrow keys / Home / End move focus between menu links. */
function onNavKeys(e: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const links = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-nav-link]")];
  if (!links.length) return;
  const i = links.indexOf(document.activeElement as HTMLElement);
  if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? links.length - 1
    : e.key === "ArrowDown" ? (i + 1) % links.length
    : (i - 1 + links.length) % links.length;
  const target = links[next];
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest" });
}

function NavContent({
  items,
  onNavigate,
  collapsed = false,
}: {
  items: readonly Item[];
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const t = useT();
  const byRoute = new Map(items.map((i) => [i.to, i]));
  const path = useRouterState({ select: (st) => st.location.pathname });
  const activeS = useRouterState({ select: (st) => String((st.location.search as Record<string, unknown>)["s"] ?? "") });
  const visibleGroups = GROUPS.map((group) => ({
    group,
    list: group.routes.map((r) => byRoute.get(r)).filter(Boolean) as Item[],
  })).filter((g) => g.list.length > 0);
  const showGroupLabels = visibleGroups.length > 1;
  return (
    <>
      {visibleGroups.map(({ group, list }) => {
        return (
          <div key={group.title.en} className={showGroupLabels ? "mb-5" : "mb-0.5"}>
            {showGroupLabels && (
            <p hidden={collapsed} className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">
              {t(group.title)}
            </p>
            )}
            <nav className="flex flex-col gap-0.5">
              {list.map((item) => {
                const Icon = NAV_ICONS[item.to] ?? LifeBuoy;
                const subs = PAGE_SECTIONS[item.to as SectionRoute];
                return (
                  <div key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: item.to === "/" }}
                    onClick={onNavigate}
                    data-nav-link
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`${FOCUS} group flex items-center gap-2.5 ${collapsed ? "justify-center" : ""} relative min-h-10 rounded-lg border border-transparent px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent data-[status=active]:border-gold/50 data-[status=active]:bg-accent data-[status=active]:font-semibold data-[status=active]:text-foreground`}
                  >
                    <Icon className="size-4 shrink-0 text-gold" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                  {!collapsed && subs && path === item.to && (
                    <div className="ml-5 mt-1.5 flex flex-col gap-0.5 border-l-2 border-primary/25 pl-2.5">
                      {subs.map((sub, i) => {
                        const on = activeS === sub.key || (!subs.some((x) => x.key === activeS) && i === 0);
                        return (
                          <Link
                            key={sub.key}
                            to={item.to}
                            search={{ s: sub.key } as never}
                            onClick={onNavigate}
                            data-nav-link
                            className={`${FOCUS} rounded-md px-2 py-1.5 text-[12px] transition-colors ${on ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
                          >
                            {t({ bn: sub.label, en: (sub as { en?: string }).en ?? sub.label })}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  </div>
                );
              })}
            </nav>
          </div>
        );
      })}
    </>
  );
}

/** Grouped left navigator for desktop; always open and fixed (never collapses), navy like the logo. */
export function NavSidebar({ items }: { items: readonly Item[] }) {
  const t = useT();
  const collapsed = false;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      // Alt+M jumps keyboard focus into the menu.
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m" && window.innerWidth >= 1024) {
        e.preventDefault();
        (ref.current?.querySelector<HTMLElement>('[data-nav-link][aria-current="page"]') ?? ref.current?.querySelector<HTMLElement>('[data-nav-link][data-status="active"]') ?? ref.current?.querySelector<HTMLElement>("[data-nav-link]"))?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <aside
      ref={ref}
      aria-label={t({ bn: "প্রধান নেভিগেশন", en: "Main navigation" })}
      aria-keyshortcuts="Alt+M"
      onKeyDown={onNavKeys}
      className="nav-navy sticky top-[var(--shell-header-height,3.5rem)] hidden h-[calc(100dvh-var(--shell-header-height,3.5rem))] w-60 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-3 lg:flex"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavContent items={items} collapsed={collapsed} />
      </div>
      <SidebarAccount collapsed={collapsed} />
      <div className="mt-2 px-1">
        <BuildBadge compact={collapsed} />
      </div>
    </aside>
  );
}

function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const { account, scope } = useMyAccount();
  const signOut = useSignOut();
  const t = useT();
  if (scope === "none" || !account?.profile) return null;
  const name = account.profile.name ?? "";
  return (
    <div className={`mt-3 flex items-center gap-2 border-t border-border pt-3 ${collapsed ? "flex-col" : ""}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary" aria-hidden>
        {name.slice(0, 2)}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold">{name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">{account.profile.employee_id ?? ""}</span>
        </span>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label={t({ bn: "সাইন আউট", en: "Sign out" })}
        title={t({ bn: "সাইন আউট", en: "Sign out" })}
        className={`${FOCUS} grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground`}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

/** Left-side navigation drawer for tablet and mobile widths. */
export function MobileNavDrawer({ items }: { items: readonly Item[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const keyboardOpen = useRef(false);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m" && window.innerWidth < 1024) {
        e.preventDefault();
        keyboardOpen.current = true;
        if (open) contentRef.current?.querySelector<HTMLElement>("[data-nav-link]")?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t({ bn: "নেভিগেশন মেনু খুলুন (Alt+M)", en: "Open navigation menu (Alt+M)" })}
          aria-keyshortcuts="Alt+M"
          className={`${FOCUS} inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-all duration-200 hover:bg-accent/60 lg:hidden`}
        >
          <Menu className="size-4.5" />
        </button>
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        onOpenAutoFocus={(event) => {
          if (!keyboardOpen.current) return;
          keyboardOpen.current = false;
          const target = contentRef.current?.querySelector<HTMLElement>('[data-nav-link][aria-current="page"]') ?? contentRef.current?.querySelector<HTMLElement>('[data-nav-link][data-status="active"]') ?? contentRef.current?.querySelector<HTMLElement>("[data-nav-link]");
          if (target) { event.preventDefault(); target.focus(); }
        }}
        side="bottom"
        className="nav-navy max-h-[85dvh] w-full overflow-y-auto bg-sidebar p-0"
      >
        <SheetHeader className="m-0 border-b border-border px-4 py-4 text-left">
          <SheetTitle asChild>
            <span className="flex items-center gap-2.5">
              <img
                src={logoAsset.url}
                alt="Winstone Properties Ltd. logo"
                className="size-8 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold tracking-tight">
                  Winstone Pulse
                </span>
                <span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
Premium Real Estate CRM
                </span>
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="px-3 py-4" onKeyDown={onNavKeys}>
          <NavContent items={items} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-border px-1 pt-3">
            <BuildBadge />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
