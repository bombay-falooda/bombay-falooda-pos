"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, CheckCircle2, AlertCircle, Clock, Receipt } from "lucide-react";
import { apiRequest } from "@/lib/api";

type UnprintedBill = {
  id: string;
  kotNumber: string;
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

type UnprintedResponse = {
  timeSlots: Record<string, UnprintedBill[]>;
  summary: ShiftSummary;
  nextInvoiceStart: number;
  invoicePrefix: string;
};

export default function BatchBillPrintingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<Record<string, UnprintedBill[]>>({});
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [nextInvoiceStart, setNextInvoiceStart] = useState<number>(1);
  const [invoicePrefix, setInvoicePrefix] = useState<string>("INV-KIRTI-");
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
      const data = await apiRequest<UnprintedResponse>("/pos-terminal/bills/unprinted");
      setTimeSlots(data.timeSlots || {});
      setSummary(data.summary || null);
      setNextInvoiceStart(data.nextInvoiceStart || 1);
      setInvoicePrefix(data.invoicePrefix || "INV-");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unprinted orders");
    } finally {
      setLoading(false);
    }
  }

  const allBills = Object.values(timeSlots).flat();
  const selectedBills = allBills.filter((b) => selectedIds.includes(b.id));
  const selectedTotal = selectedBills.reduce((sum, b) => sum + b.total, 0);

  const totalSales = summary?.totalSales || 0;
  const printedSales = summary?.printedSalesAmount || 0;
  const targetNeeded = Math.ceil(totalSales * 0.7);
  const initialDeficit = Math.max(0, targetNeeded - printedSales);
  const remainingDeficit = Math.max(0, initialDeficit - selectedTotal);

  // Map each selected bill to its sequential projected invoice number
  const projectedInvoiceMap: Record<string, string> = {};
  selectedIds.forEach((id, index) => {
    const invNum = nextInvoiceStart + index;
    projectedInvoiceMap[id] = `${invoicePrefix}${String(invNum).padStart(3, "0")}`;
  });

  function handleToggleBill(billId: string) {
    if (selectedIds.includes(billId)) {
      setSelectedIds(selectedIds.filter((id) => id !== billId));
    } else {
      setSelectedIds([...selectedIds, billId]);
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
        "/pos-terminal/bills/batch-print",
        {
          method: "POST",
          body: { billIds: selectedIds },
        }
      );
      setMessage(data.message || `Successfully printed ${selectedIds.length} bills.`);
      setSelectedIds([]);
      setTimeout(() => {
        router.push("/terminal/shift");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to batch print bills");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans pb-28">
      {/* Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/terminal/shift"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Shift Summary</span>
          </Link>
          <div className="h-5 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-900 text-white">
              <Printer className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-bold text-slate-900">Batch Bill Printing</h1>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {message && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2 shadow-2xs">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Clean Center Bar — Just showing the amount left to print */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Bill Printing Required
            </span>
            <div className="flex items-baseline gap-2 mt-0.5 justify-center sm:justify-start">
              <span className="font-mono text-2xl font-black text-slate-950">
                ₹{initialDeficit.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-500 font-medium">left to print</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Selected</span>
              <span className="font-bold text-slate-900">
                {selectedIds.length} bills (₹{selectedTotal.toLocaleString("en-IN")})
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Remaining</span>
              <span className={`font-bold ${remainingDeficit === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                ₹{remainingDeficit.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Unprinted Bills Categorized by Time Slots */}
        {loading ? (
          <div className="py-20 text-center space-y-3 text-slate-400 text-xs font-medium">
            <div className="h-6 w-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
            <p>Loading available bills...</p>
          </div>
        ) : Object.keys(timeSlots).length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">No unprinted bills available</p>
            <p className="text-xs text-slate-500">All orders are already billed and finalized.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(timeSlots).map(([slotLabel, slotBills]) => {
              const allSlotSelected = slotBills.every((b) => selectedIds.includes(b.id));
              const slotTotal = slotBills.reduce((s, b) => s + b.total, 0);

              return (
                <div key={slotLabel} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  {/* Slot Header */}
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span className="font-bold text-xs text-slate-800">{slotLabel}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        ({slotBills.length} Orders • ₹{slotTotal.toLocaleString("en-IN")})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectSlot(slotBills)}
                      className={`text-xs font-bold px-3 py-1 rounded-lg border transition ${
                        allSlotSelected
                          ? "bg-slate-200 text-slate-800 border-slate-300"
                          : "bg-white text-slate-700 hover:bg-slate-100 border-slate-300"
                      }`}
                    >
                      {allSlotSelected ? "Deselect Slot" : "Select Entire Slot"}
                    </button>
                  </div>

                  {/* Slot Order Cards */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {slotBills.map((bill) => {
                      const isSelected = selectedIds.includes(bill.id);
                      const projectedBillNum = projectedInvoiceMap[bill.id];

                      return (
                        <div
                          key={bill.id}
                          onClick={() => handleToggleBill(bill.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none space-y-2 relative ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
                                isSelected ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {bill.kotNumber}
                            </span>
                            <span className="font-mono font-black text-sm">
                              ₹{bill.total.toLocaleString("en-IN")}
                            </span>
                          </div>

                          <p
                            className={`text-xs font-medium line-clamp-1 ${
                              isSelected ? "text-slate-300" : "text-slate-600"
                            }`}
                          >
                            {bill.itemsSummary || `${bill.itemCount} items`}
                          </p>

                          {/* Projected Bill Number when selected */}
                          {isSelected && projectedBillNum ? (
                            <div className="pt-1.5 border-t border-slate-700 flex items-center justify-between text-[11px] text-amber-300 font-mono font-bold">
                              <span>Assigned Bill:</span>
                              <span>{projectedBillNum}</span>
                            </div>
                          ) : (
                            <div className="pt-1.5 text-[11px] text-slate-400 font-mono">
                              Click to assign bill number
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 z-30 shadow-lg flex items-center justify-between gap-4 max-w-5xl mx-auto">
        <div className="text-xs font-mono">
          <span className="text-slate-500 font-bold uppercase block text-[10px]">Selected for Printing</span>
          <span className="font-bold text-slate-900 text-sm">
            {selectedIds.length} Bills (₹{selectedTotal.toLocaleString("en-IN")})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/terminal/shift"
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition"
          >
            Cancel
          </Link>

          <button
            type="button"
            disabled={printing || selectedIds.length === 0}
            onClick={handleBatchPrint}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>{printing ? "Generating & Printing..." : `Print ${selectedIds.length} Selected Bills 🖨️`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
