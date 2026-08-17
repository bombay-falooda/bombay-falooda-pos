"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Bill, DigitalOrder, KotTicket } from "@/lib/api";

export function money(value: number) {
  return `INR ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function pillClass(active: boolean) {
  return `rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
    active
      ? "bg-[#17110f] text-white shadow-lg shadow-black/10"
      : "border border-[#eadbd1] bg-white/72 text-[#5f4f47] hover:border-[#c2415d]/40"
  }`;
}

export function StatusPill({ value }: { value: string }) {
  const tone =
    value === "FINALIZED" || value === "READY" || value === "COMPLETED"
      ? "bg-[#0f766e]/12 text-[#0f766e]"
      : value === "HELD" || value === "PREPARING" || value === "ACCEPTED"
        ? "bg-[#f3b33d]/18 text-[#7a5200]"
        : "bg-[#c2415d]/12 text-[#c2415d]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${tone}`}>
      {value.replace("_", " ")}
    </span>
  );
}

export function ThermalBillReceipt({ bill }: { bill: Bill }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div id="print-ticket-root" className="print-ticket">
      <div className="text-center pb-2 border-b border-black mb-2">
        <img
          src="/bombay-logo.png"
          alt="Bombay Falooda"
          className="print-logo mx-auto h-12 w-12 object-contain mb-1"
        />
        <h2 className="text-sm font-black uppercase tracking-wider">BOMBAY FALOODA</h2>
        <p className="text-[10px] font-bold">Store Outlet Terminal</p>
      </div>

      <div className="text-[10px] space-y-0.5 border-b border-black pb-2 mb-2">
        <div className="flex justify-between font-bold">
          <span>Bill: {bill.billNumber}</span>
          <span>{bill.orderType?.replace("_", " ") || "TAKEAWAY"}</span>
        </div>
        <div className="flex justify-between">
          <span>Date: {formatDate(bill.createdAt)}</span>
          <span>Pay: {bill.paymentMethod || "CASH"}</span>
        </div>
        <p>Customer: {bill.customerName || "Walk-in"} {bill.customerPhone ? `(${bill.customerPhone})` : ""}</p>
      </div>

      <table className="w-full text-[10px] text-left border-b border-black pb-2 mb-2">
        <thead>
          <tr className="border-b border-black text-xs font-bold">
            <th className="py-1">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item) => (
            <tr key={item.id} className="border-b border-gray-300/50">
              <td className="py-1 font-bold">
                {item.name}
                {item.addons?.length ? (
                  <span className="block text-[8px] font-normal text-gray-700">
                    + {item.addons.map((a) => a.name).join(", ")}
                  </span>
                ) : null}
              </td>
              <td className="py-1 text-center">{item.quantity}</td>
              <td className="py-1 text-right font-bold">₹{Number(item.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-[11px] font-black space-y-1 text-right border-b border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span>Total Payable:</span>
          <span className="text-sm">INR {Number(bill.total).toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center text-[10px] pt-1 font-bold">
        <p>Thank you for visiting Bombay Falooda!</p>
        <p className="text-[8px] font-normal mt-0.5">Please visit again 🍨</p>
      </div>
    </div>,
    document.body
  );
}

export function BillDetail({ bill }: { bill: Bill }) {
  return (
    <div className="space-y-3">
      {/* 80mm Thermal Receipt Ticket for Printer */}
      <ThermalBillReceipt bill={bill} />

      <div className="rounded-[18px] bg-[#17110f] p-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-bold">{bill.billNumber}</p>
            <p className="text-xs text-white/65">{bill.customerName || "Walk-in"} {bill.customerPhone || ""}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill value={bill.status} />
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print rounded-xl bg-white px-3 py-1.5 text-[10px] font-black text-[#17110f]"
            >
              Print Final Bill
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
          <span className="text-xs text-white/65">Total</span>
          <span className="font-display text-3xl font-bold">{money(Number(bill.total))}</span>
        </div>
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        {bill.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-[#eadbd1] bg-white/78 p-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{item.name}</p>
                <p className="text-xs text-[#7d6b62]">Qty {item.quantity}</p>
              </div>
              <p className="font-display text-lg font-bold">{money(Number(item.total))}</p>
            </div>
            {item.addons?.length ? (
              <p className="mt-2 text-xs text-[#7d6b62]">
                Add-ons: {item.addons.map((addon) => `${addon.name} +${money(addon.price)}`).join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="rounded-[18px] border border-[#eadbd1] bg-white/72 p-3">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">Linked KOTs</p>
          <span className="rounded-full bg-[#f3b33d]/18 px-3 py-1 text-xs font-bold text-[#7a5200]">
            {bill.kotTickets.length}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {bill.kotTickets.map((kot, index) => (
            <div key={kot.id} className="rounded-xl border border-[#eadbd1] bg-white/78 p-3">
              <div className="flex justify-between gap-3">
                <p className="text-sm font-bold">KOT {index + 1} - {kot.kotNumber}</p>
                <p className="text-xs font-semibold text-[#7d6b62]">{formatDate(kot.createdAt)}</p>
              </div>
              <p className="mt-1 text-xs text-[#7d6b62]">{kot.items?.length ?? 0} kitchen lines</p>
            </div>
          ))}
          {!bill.kotTickets.length ? <p className="text-sm font-semibold text-[#7d6b62]">No KOT generated yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

export function KotDetail({ kot }: { kot: KotTicket }) {
  return (
    <div className="space-y-3">
      <div className="rounded-[18px] bg-[#17110f] p-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-bold">{kot.kotNumber}</p>
            <p className="text-xs text-white/65">Linked Bill {kot.bill.billNumber}</p>
            <p className="mt-3 text-xs text-white/65">{formatDate(kot.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print rounded-xl bg-white px-3 py-1.5 text-[10px] font-black text-[#17110f]"
          >
            Print KOT
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        {(kot.items || []).map((item) => (
          <div key={item.id} className="rounded-xl border border-[#eadbd1] bg-white/78 p-3">
            <div className="flex justify-between gap-3">
              <p className="text-sm font-bold">{item.billItem?.name || "Item"}</p>
              <p className="font-display text-lg font-bold">x {item.quantity}</p>
            </div>
            {item.billItem?.addons?.length ? (
              <p className="mt-1 text-xs text-[#7d6b62]">
                {item.billItem.addons.map((addon) => addon.name).join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <BillDetail bill={kot.bill} />
    </div>
  );
}

export function OrderCard({
  order,
  onAccept,
  onStatus,
}: {
  order: DigitalOrder;
  onAccept: (id: string) => void;
  onStatus: (id: string, status: string) => void;
}) {
  return (
    <article className="rounded-[18px] border border-[#eadbd1] bg-white/78 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{order.source} - {order.type.replace("_", " ")}</p>
          <p className="mt-1 text-xs text-[#7d6b62]">{order.customerName || "Walk-in"} {order.customerPhone || ""}</p>
        </div>
        <StatusPill value={order.status} />
      </div>
      <div className="mt-3 space-y-1">
        {order.items.slice(0, 4).map((item) => (
          <div key={item.id} className="flex justify-between text-xs">
            <span>{item.quantity} x {item.name}</span>
            <span className="font-bold">{money(Number(item.total))}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="font-display text-xl font-bold">{money(Number(order.total))}</p>
        <p className="text-[11px] font-semibold text-[#7d6b62]">{formatDate(order.createdAt)}</p>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <button onClick={() => onAccept(order.id)} className="rounded-lg bg-[#6d40d8] px-2 py-2 text-[10px] font-bold text-white">
          Accept
        </button>
        {["ACCEPTED", "PREPARING", "READY"].map((status) => (
          <button key={status} onClick={() => onStatus(order.id, status)} className="rounded-lg bg-[#17110f] px-2 py-2 text-[10px] font-bold text-white">
            {status}
          </button>
        ))}
      </div>
    </article>
  );
}
