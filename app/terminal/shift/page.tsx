"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sun,
  Moon,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Printer,
  Receipt,
  IndianRupee,
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

export default function PosShiftPage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [openingFloat, setOpeningFloat] = useState("500");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [shiftStatus, setShiftStatus] = useState<"OPEN" | "CLOSED">("OPEN");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showEndAudit, setShowEndAudit] = useState(false);

  useEffect(() => {
    const token = getPosToken();
    const savedContext = getSavedPosContext();
    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }
    setContext(savedContext);
    void fetchShiftSummary();
  }, [router]);

  async function fetchShiftSummary() {
    try {
      setLoading(true);
      setError("");
      const [shiftData, dayStatus] = await Promise.all([
        apiRequest<ShiftSummary>("/pos-terminal/shift-summary"),
        apiRequest<{ active: boolean; businessDay: any }>("/pos-terminal/day/current").catch(() => ({ active: false, businessDay: null })),
      ]);
      setSummary(shiftData);
      setShiftStatus(dayStatus.active ? "OPEN" : "CLOSED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shift summary");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartDay() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const res = await apiRequest<{ message: string; status: "OPEN" | "CLOSED" }>("/pos-terminal/shift/start", {
        method: "POST",
        body: { openingFloat: Number(openingFloat || 0) },
      });
      setShiftStatus("OPEN");
      setMessage(res.message || "Shift / Day Started Successfully");
      void fetchShiftSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start shift day");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndDay() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const res = await apiRequest<{ message: string; status: "OPEN" | "CLOSED" }>("/pos-terminal/shift/end", {
        method: "POST",
        body: {
          closingNotes: notes,
        },
      });
      setShiftStatus("CLOSED");
      setMessage(res.message || "Day Ended. Z-Report generated.");
      void fetchShiftSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close shift day");
    } finally {
      setLoading(false);
    }
  }

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
            <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Start Day / End Day Register Control</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${shiftStatus === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}
                >
                  Shift {shiftStatus}
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Outlet: {context?.outlet.name} ({context?.outlet.code})
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-semibold flex items-center gap-1.5"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print Z-Report</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto p-4 md:p-6 space-y-6">
        {message && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Clean Minimal Modal for End Day & Bill Print Check */}
        {showEndAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150">
              {(() => {
                const totalSales = Number(summary?.totalSales || 0);
                const printed = Number((summary as any)?.printedSalesAmount || 0);
                const target70 = Math.ceil(totalSales * 0.7);
                const deficit = Math.max(0, target70 - printed);
                const isCompliant = deficit === 0 || (summary as any)?.canCloseDay;

                if (!isCompliant) {
                  return (
                    <div className="p-6 space-y-5 text-center">
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                        <p className="text-base font-bold text-slate-900 leading-snug">
                          <span className="font-mono text-xl text-slate-950 font-extrabold block mb-1">
                            ₹{deficit.toLocaleString("en-IN")}
                          </span>
                          amount of bill printing is left to print.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Link
                          href="/terminal/gst-compliance"
                          className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Go to Print Page</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setShowEndAudit(false)}
                          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-6 space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                      <p className="text-sm font-bold text-emerald-900">
                        All required bills are printed. Ready to close shift.
                      </p>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="block text-xs font-bold text-slate-700">
                        Physical Cash in Drawer (₹)
                      </label>
                      <input
                        type="number"
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm font-mono font-bold text-slate-800 outline-none focus:border-slate-900"
                        placeholder="Enter cash in drawer"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={async () => {
                          await handleEndDay();
                          setShowEndAudit(false);
                        }}
                        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
                      >
                        {loading ? "Closing Shift..." : "Close Shift"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowEndAudit(false)}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start Day Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                <Sun className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900">Start Day Register</h2>
                <p className="text-[11px] text-slate-500">Open register till float for today&apos;s operations</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Opening Float Cash Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs font-bold">₹</span>
                  <input
                    type="number"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    disabled={shiftStatus === "OPEN"}
                    className="w-full h-10 rounded-lg border border-slate-300 pl-7 pr-3 text-sm font-mono font-bold text-slate-800 outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder="500"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loading || shiftStatus === "OPEN"}
                onClick={handleStartDay}
                className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shiftStatus === "OPEN" ? "Day Already Started" : "Confirm Start Day"}
              </button>
            </div>
          </div>

          {/* End Day Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2.5 rounded-xl bg-slate-900 text-white">
                <Moon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900">End Day & Close Shift</h2>
                <p className="text-[11px] text-slate-500">Perform drawer audit and close register shift</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Closing Shift Notes / Discrepancy Reason
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 outline-none focus:border-slate-900"
                  placeholder="Optional shift notes"
                />
              </div>

              <button
                type="button"
                disabled={loading || shiftStatus === "CLOSED"}
                onClick={() => setShowEndAudit(true)}
                className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition disabled:opacity-50"
              >
                {shiftStatus === "CLOSED" ? "Shift is Already Closed" : "End Day & Close Shift"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
