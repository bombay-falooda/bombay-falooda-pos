"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Receipt, Printer, CheckCircle2, Clock } from "lucide-react";
import { apiRequest, type Bill } from "@/lib/api";
import { getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";

export default function TodayOrdersPage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FINALIZED" | "HELD" | "CANCELLED">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getPosToken();
    const saved = getSavedPosContext();
    if (!token || !saved) {
      router.replace("/login");
      return;
    }
    setContext(saved);
    void fetchOrders();
  }, [router]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const data = await apiRequest<Bill[]>("/pos-terminal/bills");
      setBills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  const filtered = bills.filter((b) => {
    const matchesSearch =
      b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
      (b.customerName && b.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (b.customerPhone && b.customerPhone.includes(search));
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col font-sans antialiased">
      {/* Header */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-5 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="p-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-100/80 transition-colors flex items-center gap-1.5 text-xs font-bold text-slate-700 shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Terminal</span>
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Receipt className="h-4.5 w-4.5" />
            </div>
            <h1 className="font-bold text-sm text-slate-900 tracking-tight">Total Today Orders</h1>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/80">
          {context?.outlet.name} ({context?.outlet.code})
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 md:p-6 w-full mx-auto space-y-4">
        {/* Filters Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by Bill No, Customer Name, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9.5 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-medium focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 outline-none transition"
            />
          </div>

          <div className="flex gap-1.5 w-full sm:w-auto bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(["ALL", "FINALIZED", "HELD", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === st
                    ? "bg-[#b82e46] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <div className="col-span-3">Bill Number</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-2 text-center">Type</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-right">Total Amount</div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-400">Loading today&apos;s bills...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-400">No orders found matching criteria.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((b) => (
                <div key={b.id} className="grid grid-cols-12 px-5 py-3.5 items-center text-xs hover:bg-slate-50/80 transition-colors">
                  <div className="col-span-3 font-mono font-bold text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">{b.billNumber}</span>
                  </div>

                  <div className="col-span-3">
                    <div className="font-bold text-slate-800">{b.customerName || "Walk-in Customer"}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{b.customerPhone || "No Phone"}</div>
                  </div>

                  <div className="col-span-2 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {b.orderType}
                    </span>
                  </div>

                  <div className="col-span-2 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${b.status === "FINALIZED"
                          ? "bg-emerald-100/90 text-emerald-800 border border-emerald-200"
                          : b.status === "HELD"
                            ? "bg-amber-100/90 text-amber-800 border border-amber-200"
                            : "bg-rose-100/90 text-rose-800 border border-rose-200"
                        }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="col-span-2 text-right font-mono font-bold text-slate-900 text-sm">
                    ₹{Number(b.total).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
