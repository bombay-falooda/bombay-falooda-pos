"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { apiRequest } from "@/lib/api";
import { clearPosSession, getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";

type ShiftSummary = {
  totalSales: number;
  finalizedBills: number;
  heldBills: number;
  kotTickets: number;
};

const navItems = [
  { href: "/terminal", label: "Dashboard", short: "Dash" },
  { href: "/kots", label: "KOT", short: "KOT" },
  { href: "/bills", label: "Bills", short: "Bills" },
  { href: "/digital-orders", label: "Digital Orders", short: "Orders" },
];

export function PosShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [context, setContext] = useState<PosContext | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);

  useEffect(() => {
    const token = getPosToken();
    const savedContext = getSavedPosContext();

    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }

    setContext(savedContext);
    apiRequest<ShiftSummary>("/pos-terminal/shift-summary")
      .then(setSummary)
      .catch(() => undefined);
  }, [router]);

  function logout() {
    clearPosSession();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen lg:h-screen lg:overflow-hidden p-2 text-[#17110f]">
      {/* Mobile Header Navigation (< lg screens) */}
      <header className="no-print pos-panel flex flex-col gap-2 rounded-[22px] p-3 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/bombay-logo.png"
              width={42}
              height={42}
              alt="Bombay Falooda"
              className="object-contain"
            />
            <div>
              <span className="block font-display text-base font-bold leading-tight">Bombay Falooda</span>
              <span className="text-[10px] font-bold text-[#7d6b62]">
                {context?.outlet.code || "POS Terminal"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold">
              <span className="rounded-lg border border-[#eadbd1] bg-white/80 px-2 py-1">
                Sales: {shortMoney(summary?.totalSales ?? 0)}
              </span>
              <span className="rounded-lg border border-[#eadbd1] bg-white/80 px-2 py-1">
                Bills: {summary?.finalizedBills ?? 0}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-[#eadbd1] bg-white px-3 py-1.5 text-xs font-bold text-[#7d6b62]"
            >
              Logout
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 min-w-[75px] rounded-[12px] border px-2 py-2 text-center text-xs font-black transition ${
                  active
                    ? "border-[#c2415d] bg-[#c2415d] text-white shadow-md"
                    : "border-[#eadbd1] bg-white/80 text-[#5f4f47]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <section className="flex flex-col lg:grid lg:h-full lg:grid-cols-[116px_minmax(0,1fr)] gap-2 mt-2 lg:mt-0">
        {/* Desktop Sidebar (>= lg screens) */}
        <aside className="no-print pos-panel hidden lg:flex h-full flex-col justify-between rounded-[22px] px-2 py-3">
          <div>
            <Image
              src="/bombay-logo.png"
              width={62}
              height={62}
              alt="Bombay Falooda"
              className="mx-auto object-contain"
            />
            <nav className="mt-5 space-y-2">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-[14px] border px-2.5 py-3 text-center transition ${
                      active
                        ? "border-[#c2415d] bg-[#c2415d] text-white shadow-[0_14px_30px_rgba(194,65,93,0.22)]"
                        : "border-[#eadbd1] bg-white/78 text-[#5f4f47] hover:border-[#c2415d]/50"
                    }`}
                    title={item.label}
                  >
                    <span className="block text-[11px] font-black">{item.short}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-5 space-y-2">
              <SidebarStat label="Bills" value={`${summary?.finalizedBills ?? 0}/${summary?.heldBills ?? 0}`} />
              <SidebarStat label="KOT" value={String(summary?.kotTickets ?? 0)} />
              <SidebarStat label="Sales" value={shortMoney(summary?.totalSales ?? 0)} />
            </div>
          </div>
          <div>
            <p className="px-1 text-center text-[10px] font-bold text-[#7d6b62]">
              {context?.outlet.code || "POS"}
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-2 h-10 w-full rounded-xl border border-[#eadbd1] bg-white text-[10px] font-bold text-[#7d6b62]"
            >
              Logout
            </button>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-[22px] scrollbar-none">
          {children}
        </section>
      </section>
    </main>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#eadbd1] bg-white/72 px-2 py-2 text-center">
      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-[#9a887d]">{label}</span>
      <span className="font-display mt-1 block text-base font-bold text-[#17110f]">{value}</span>
    </div>
  );
}

function shortMoney(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}
