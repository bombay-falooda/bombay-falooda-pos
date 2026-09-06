"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UnprintedBill = {
  id: string;
  billNumber: string;
  createdAt: string;
  total: number;
  customerName: string;
  itemCount: number;
  itemsSummary: string;
};

type ShiftSummary = {
  totalSales: number;
  totalOrdersCount: number;
  printedSalesAmount: number;
  target70PercentAmount: number;
  printComplianceRatio: number;
  isComplianceThresholdActive: boolean;
  canCloseDay: boolean;
};

export default function GstCompliancePage() {
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<Record<string, UnprintedBill[]>>({});
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchUnprintedBills();
  }, []);

  async function fetchUnprintedBills() {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("pos_token") || "pos-dev-token";
      const res = await fetch("http://localhost:4000/api/pos-terminal/gst-compliance/unprinted-bills", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTimeSlots(data.timeSlots || {});
        setSummary(data.summary || null);
      } else {
        setError(data.message || "Failed to load GST compliance data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error loading GST compliance");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleBill(bill: UnprintedBill) {
    if (selectedIds.includes(bill.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== bill.id));
    } else {
      // Calculate current selected total
      const allBills = Object.values(timeSlots).flat();
      const currentSelectedTotal = allBills
        .filter((b) => selectedIds.includes(b.id))
        .reduce((sum, b) => sum + b.total, 0);

      const targetNeeded = (summary?.target70PercentAmount || 0) - (summary?.printedSalesAmount || 0);

      if (currentSelectedTotal >= targetNeeded && targetNeeded > 0) {
        setMessage(`Required 70% target (₹${summary?.target70PercentAmount}) already met by selected bills!`);
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      setSelectedIds([...selectedIds, bill.id]);
    }
  }

  function handleSelectSlot(slotBills: UnprintedBill[]) {
    const slotIds = slotBills.map((b) => b.id);
    const allSelected = slotIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !slotIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedIds, ...slotIds]));
      setSelectedIds(combined);
    }
  }

  async function handleBatchPrint() {
    if (!selectedIds.length) {
      setError("Please select at least one bill to print");
      return;
    }

    try {
      setPrinting(true);
      setError("");
      setMessage("");
      const token = localStorage.getItem("pos_token") || "pos-dev-token";
      const res = await fetch("http://localhost:4000/api/pos-terminal/gst-compliance/batch-print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ billIds: selectedIds }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✓ ${data.message} Marked ${data.printedCount} bills as printed.`);
        setSelectedIds([]);
        await fetchUnprintedBills();
      } else {
        setError(data.message || "Failed to batch print bills");
      }
    } catch {
      setError("Network error while batch printing bills");
    } finally {
      setPrinting(false);
    }
  }

  const allBills = Object.values(timeSlots).flat();
  const selectedBills = allBills.filter((b) => selectedIds.includes(b.id));
  const selectedTotal = selectedBills.reduce((sum, b) => sum + b.total, 0);
  const currentPrintedTotal = summary?.printedSalesAmount || 0;
  const projectTotal = currentPrintedTotal + selectedTotal;
  const projectRatio = summary?.totalSales ? Number(((projectTotal / summary.totalSales) * 100).toFixed(1)) : 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans p-6">
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl shadow-2xl">
          <span className="h-5 w-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          <span className="text-sm font-bold tracking-wide">Loading GST Compliance Manager...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            📜
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-tight">Bill Printing Compliance</h1>
            <p className="text-xs text-slate-400">POS Sales Audit & Sequential Bill Finalizer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/terminal/shift"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
          >
            ← Back to Shift Summary
          </Link>
        </div>
      </header>

      {/* Alert Banners */}
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <span>✓</span>
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Compliance Metrics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Shift Total Sales</span>
          <div className="text-2xl font-black text-white font-mono">₹{summary?.totalSales.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-slate-500 block">{summary?.totalOrdersCount} Total Orders</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Printed Bill Sales</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">₹{summary?.printedSalesAmount.toLocaleString('en-IN')}</div>
          <span className="text-[11px] font-bold text-emerald-400 block">{summary?.printComplianceRatio}% Ratio</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">70% Target Requirement</span>
          <div className="text-2xl font-black text-amber-400 font-mono">₹{summary?.target70PercentAmount.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-slate-400 block">Min. Required to Close Day</span>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1 ${summary?.canCloseDay ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-80">Shift Status</span>
          <div className="text-base font-black uppercase tracking-wide">
            {summary?.canCloseDay ? "COMPLIANT ✓" : "NON-COMPLIANT ⚠️"}
          </div>
          <span className="text-[11px] font-medium block">
            {summary?.canCloseDay ? "Day Closing Unlocked" : "Must Print Bills to Reach 70%"}
          </span>
        </div>
      </div>

      {/* Progress & Selection Control Bar */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-300">
            Selected for Batch Printing: <span className="font-mono text-emerald-400">{selectedIds.length} Bills</span> (₹{selectedTotal.toLocaleString('en-IN')})
          </span>
          <span className="text-slate-400">
            Projected Compliance Ratio: <span className="font-mono text-amber-400">{projectRatio}%</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${Math.min(100, projectRatio)}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
            style={{ left: "70%" }}
            title="70% GST Target Line"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>0%</span>
          <span className="text-amber-400 font-bold">▲ 70% Target Threshold</span>
          <span>100%</span>
        </div>
      </div>

      {/* Unprinted Bills by Time Slot */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Unprinted Bills by Chronological Time Slot</h2>
          <span className="text-xs text-slate-400 font-mono">Total Unprinted: {allBills.length}</span>
        </div>

        {Object.keys(timeSlots).length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 space-y-2">
            <span className="text-3xl block">🎉</span>
            <h3 className="font-bold text-white text-base">All Bills Are 100% Printed!</h3>
            <p className="text-xs text-slate-400">No unprinted bills remain for this shift. Day close is fully unlocked.</p>
          </div>
        ) : (
          Object.entries(timeSlots).map(([slotLabel, slotBills]) => {
            const allSlotSelected = slotBills.every((b) => selectedIds.includes(b.id));

            return (
              <div key={slotLabel} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-mono font-bold text-xs">🕒 {slotLabel}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                      {slotBills.length} Bills
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectSlot(slotBills)}
                    className="text-xs text-emerald-400 font-bold hover:underline"
                  >
                    {allSlotSelected ? "Deselect Slot" : "Select Entire Slot"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {slotBills.map((bill) => {
                    const isSelected = selectedIds.includes(bill.id);
                    return (
                      <div
                        key={bill.id}
                        onClick={() => handleToggleBill(bill)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${isSelected
                            ? "bg-emerald-950/40 border-emerald-500/60 text-white"
                            : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => { }}
                            className="h-4 w-4 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <span className="font-mono text-xs font-bold text-white block">{bill.billNumber}</span>
                            <span className="text-[11px] text-slate-400 block">{bill.itemsSummary}</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-emerald-400">₹{bill.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Footer */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-6 bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl flex items-center justify-between z-30">
          <div>
            <span className="text-xs text-slate-400 block">Selected for Sequential Batch Printing:</span>
            <span className="text-base font-black text-white font-mono">
              {selectedIds.length} Bills (₹{selectedTotal.toLocaleString('en-IN')})
            </span>
          </div>

          <button
            type="button"
            disabled={printing}
            onClick={() => void handleBatchPrint()}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            {printing ? (
              <>
                <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Printing Sequential Bills...</span>
              </>
            ) : (
              <span>🖨️ Batch Finalize & Print Selected Bills ✓</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
