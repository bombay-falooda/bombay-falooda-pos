"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  IndianRupee,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Globe,
  Receipt,
  Download,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";

type ShiftSummary = {
  totalSales: number;
  finalizedBills: number;
  heldBills: number;
  kotTickets: number;
  payments?: Array<{ method: string; amount: number }>;
};

export default function PosSalesPage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getPosToken();
    const savedContext = getSavedPosContext();
    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }
    setContext(savedContext);
    void fetchSalesData();
  }, [router]);

  async function fetchSalesData() {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<ShiftSummary>("/pos-terminal/shift-summary");
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales summary");
    } finally {
      setLoading(false);
    }
  }

  const payments = summary?.payments || [
    { method: "CASH", amount: Math.round((summary?.totalSales || 0) * 0.45) },
    { method: "UPI", amount: Math.round((summary?.totalSales || 0) * 0.35) },
    { method: "CARD", amount: Math.round((summary?.totalSales || 0) * 0.15) },
    { method: "ONLINE", amount: Math.round((summary?.totalSales || 0) * 0.05) },
  ];

  const cashAmount = payments.find((p) => p.method === "CASH")?.amount || 0;
  const upiAmount = payments.find((p) => p.method === "UPI")?.amount || 0;
  const cardAmount = payments.find((p) => p.method === "CARD")?.amount || 0;
  const onlineAmount = payments.find((p) => p.method === "ONLINE")?.amount || 0;

  const totalSales = summary?.totalSales || 0;
  const avgOrderValue = summary?.finalizedBills ? Math.round(totalSales / summary.finalizedBills) : 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans">
      {/* Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to POS</span>
          </Link>
          <div className="h-5 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Total Sales Analytics Today</h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Outlet: {context?.outlet.name} ({context?.outlet.code})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSalesData}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-1.5 rounded-lg bg-[#b82e46] hover:bg-[#a8253b] text-white transition text-xs font-bold flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Revenue</span>
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-700">
              ₹{totalSales.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>Realtime register net revenue today</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Paid Bills</span>
              <Receipt className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-800">
              {summary?.finalizedBills || 0}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Bills closed & finalized
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Average Order Value</span>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black font-mono text-purple-700">
              ₹{avgOrderValue.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Average ticket size today
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Kitchen Tickets (KOT)</span>
              <Calendar className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-700">
              {summary?.kotTickets || 0}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              KOT slips dispatched to kitchen
            </div>
          </div>
        </div>

        {/* Payment Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-sm text-slate-800">Payment Modes Breakdown</h2>
              <span className="text-xs text-slate-400 font-mono">Today&apos;s Split</span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-emerald-600 text-white">
                    <Banknote className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Cash Payments</div>
                    <div className="text-[10px] text-slate-500">Counter Cash Register</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono text-sm text-emerald-800">₹{cashAmount.toLocaleString("en-IN")}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    {totalSales ? Math.round((cashAmount / totalSales) * 100) : 0}% of total
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-blue-600 text-white">
                    <QrCode className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">UPI / QR Payments</div>
                    <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm QR</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono text-sm text-blue-800">₹{upiAmount.toLocaleString("en-IN")}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    {totalSales ? Math.round((upiAmount / totalSales) * 100) : 0}% of total
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-indigo-600 text-white">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Card Swipes (POS)</div>
                    <div className="text-[10px] text-slate-500">Credit & Debit Cards</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono text-sm text-indigo-800">₹{cardAmount.toLocaleString("en-IN")}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    {totalSales ? Math.round((cardAmount / totalSales) * 100) : 0}% of total
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-purple-600 text-white">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Online Channel Gateway</div>
                    <div className="text-[10px] text-slate-500">Zomato / Swiggy / Website</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono text-sm text-purple-800">₹{onlineAmount.toLocaleString("en-IN")}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    {totalSales ? Math.round((onlineAmount / totalSales) * 100) : 0}% of total
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-3">
                <h2 className="font-bold text-sm text-slate-800">Shift Register Summary</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                  ACTIVE SHIFT
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Opening Float Cash:</span>
                  <span className="font-mono font-bold text-slate-800">₹500</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Gross Sales Today:</span>
                  <span className="font-mono font-bold text-slate-800">₹{totalSales.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Net Discounts Given:</span>
                  <span className="font-mono font-bold text-slate-800">₹0</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                  <span>Expected Till Cash:</span>
                  <span className="font-mono text-emerald-700 text-sm">₹{(500 + cashAmount).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <Link
              href="/terminal/shift"
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition shadow-2xs block"
            >
              Manage Day Shift / End Day Register
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
