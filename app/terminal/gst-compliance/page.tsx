"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

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
      const data = await apiRequest<{ timeSlots: Record<string, UnprintedBill[]>; summary: ShiftSummary }>(
        "/pos-terminal/gst-compliance/unprinted-bills"
      );
      setTimeSlots(data.timeSlots || {});
      setSummary(data.summary || null);
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
      const data = await apiRequest<{ message: string; printedCount: number }>(
        "/pos-terminal/gst-compliance/batch-print",
        {
          method: "POST",
          body: { billIds: selectedIds },
        }
      );

      setMessage(`✓ ${data.message} Marked ${data.printedCount} bills as printed.`);
      setSelectedIds([]);
      await fetchUnprintedBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to batch print bills");
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
      <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex items-center justify-center font-sans p-6">
        <div className="flex items-center gap-3 bg-white border border-slate-200 px-6 py-4 rounded-2xl shadow-lg">
          <span className="h-5 w-5 rounded-full border-2 border-[#b82e46] border-t-transparent animate-spin" />
          <span className="text-sm font-bold text-slate-700 tracking-wide">Loading GST Compliance Manager...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 font-sans p-6 mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 font-black text-xl flex items-center justify-center border border-amber-200 shadow-2xs">
            📜
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Bill Printing Compliance</h1>
            <p className="text-xs text-slate-500 font-medium">POS Sales Audit & Sequential Bill Finalizer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/terminal/shift"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition flex items-center gap-1.5"
          >
            ← Back to Shift Summary
          </Link>
        </div>
      </header>

      {/* Alert Banners */}
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-2xs">
          <span className="text-emerald-600 font-black">✓</span>
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-2xs">
          <span className="text-rose-600 font-black">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Compliance Metrics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Shift Total Sales</span>
          <div className="text-2xl font-black text-slate-900 font-mono">₹{summary?.totalSales.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 block font-medium">{summary?.totalOrdersCount} Total Orders</span>
        </div>

        <div className="p-4.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Printed Bill Sales</span>
          <div className="text-2xl font-black text-emerald-700 font-mono">₹{summary?.printedSalesAmount.toLocaleString('en-IN')}</div>
          <span className="text-xs font-bold text-emerald-700 block">{summary?.printComplianceRatio}% Ratio</span>
        </div>

        <div className="p-4.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">70% Target Requirement</span>
          <div className="text-2xl font-black text-amber-700 font-mono">₹{summary?.target70PercentAmount.toLocaleString('en-IN')}</div>
          <span className="text-xs text-amber-700 block font-medium">Min. Required to Close Day</span>
        </div>

        <div className={`p-4.5 rounded-2xl border shadow-xs space-y-1 ${summary?.canCloseDay ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">Shift Status</span>
          <div className="text-base font-black uppercase tracking-wide">
            {summary?.canCloseDay ? "COMPLIANT ✓" : "NON-COMPLIANT ⚠️"}
          </div>
          <span className="text-xs font-medium block">
            {summary?.canCloseDay ? "Day Closing Unlocked" : "Must Print Bills to Reach 70%"}
          </span>
        </div>
      </div>

      {/* Progress & Selection Control Bar */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-700">
            Selected for Batch Printing: <span className="font-mono font-bold text-emerald-700">{selectedIds.length} Bills</span> (₹{selectedTotal.toLocaleString('en-IN')})
          </span>
          <span className="text-slate-500">
            Projected Compliance Ratio: <span className="font-mono font-bold text-[#b82e46]">{projectRatio}%</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
          <div
            className="h-full bg-[#b82e46] transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, projectRatio)}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
            style={{ left: "70%" }}
            title="70% GST Target Line"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>0%</span>
          <span className="text-amber-700 font-bold">▲ 70% Target Threshold</span>
          <span>100%</span>
        </div>
      </div>

      {/* Unprinted Bills by Time Slot */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Unprinted Bills by Chronological Time Slot</h2>
          <span className="text-xs text-slate-500 font-mono font-bold bg-slate-200/60 px-2.5 py-1 rounded-lg border border-slate-300/50">Total Unprinted: {allBills.length}</span>
        </div>

        {Object.keys(timeSlots).length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 space-y-2 shadow-xs">
            <span className="text-3xl block">🎉</span>
            <h3 className="font-bold text-slate-900 text-base">All Bills Are 100% Printed!</h3>
            <p className="text-xs text-slate-500">No unprinted bills remain for this shift. Day close is fully unlocked.</p>
          </div>
        ) : (
          Object.entries(timeSlots).map(([slotLabel, slotBills]) => {
            const allSlotSelected = slotBills.every((b) => selectedIds.includes(b.id));

            return (
              <div key={slotLabel} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 font-mono font-bold text-xs">🕒 {slotLabel}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200">
                      {slotBills.length} Bills
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectSlot(slotBills)}
                    className="text-xs text-[#b82e46] font-bold hover:underline"
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
                          ? "bg-emerald-50/80 border-2 border-emerald-500 text-slate-900 shadow-xs"
                          : "bg-slate-50/70 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-white"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => { }}
                            className="h-4 w-4 rounded border-slate-300 text-[#b82e46] focus:ring-0 cursor-pointer accent-[#b82e46]"
                          />
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-900 block">{bill.billNumber}</span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">{bill.itemsSummary}</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-emerald-700">₹{bill.total}</span>
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
        <div className="sticky bottom-6 bg-white/95 backdrop-blur-md border border-slate-300 p-4.5 rounded-2xl shadow-xl flex items-center justify-between z-30">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Selected for Sequential Batch Printing:</span>
            <span className="text-base font-black text-slate-900 font-mono">
              {selectedIds.length} Bills (₹{selectedTotal.toLocaleString('en-IN')})
            </span>
          </div>

          <button
            type="button"
            disabled={printing}
            onClick={() => void handleBatchPrint()}
            className="px-6 py-3 rounded-xl bg-[#b82e46] hover:bg-[#9d2439] text-white font-bold text-xs transition shadow-md shadow-[#b82e46]/20 flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            {printing ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
