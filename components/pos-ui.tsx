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
    <div id="print-ticket-root" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
      <div style={{ textAlign: "center", lineHeight: "1.25" }}>
        <div style={{ fontWeight: "900", fontSize: "16px", textTransform: "none", marginBottom: "2px" }}>
          {bill.outlet?.name || "Bombay Falooda"}
        </div>
        <div style={{ fontSize: "10px", fontWeight: "normal", padding: "0 2px" }}>
          {bill.outlet?.address || "Opp Sayaji vihar club, near khanderav market, raj mahal road vadodara."}
        </div>
        <div style={{ fontSize: "10px", fontWeight: "normal", marginTop: "1px" }}>
          M. {(bill.outlet as any)?.phone || "9574754173"}
        </div>
      </div>

      <div style={{ fontSize: "11px", marginTop: "8px", lineHeight: "1.3" }}>
        {bill.customerName && (
          <div style={{ fontWeight: "bold" }}>Name: {bill.customerName}</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Date: {formatDate(bill.createdAt).split(",")[0] || new Date().toLocaleDateString("en-GB")}</span>
          <span>{formatDate(bill.createdAt).split(",")[1] || new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}</span>
          <span style={{ fontWeight: "bold" }}>
            {bill.orderType === "DINE_IN" ? "Dine In" : bill.orderType === "DELIVERY" ? "Delivery" : "Pick Up"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Cashier: {bill.posDevice?.name || "biller"}</span>
          <span style={{ fontWeight: "bold" }}>
            Bill No.: {bill.billNumber ? bill.billNumber.replace("BILL-", "") : "1"}
          </span>
        </div>
        <div style={{ fontWeight: "bold" }}>
          Token No.: {bill.kotTickets?.[0]?.kotNumber ? bill.kotTickets[0].kotNumber.replace("KOT-", "") : "1"}
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px 0" }} />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1px dashed #000" }}>
            <th style={{ textAlign: "left", paddingBottom: "4px", fontWeight: "bold" }}>No.Item</th>
            <th style={{ textAlign: "center", paddingBottom: "4px", width: "12%", fontWeight: "bold" }}>Qty.</th>
            <th style={{ textAlign: "right", paddingBottom: "4px", width: "18%", fontWeight: "bold" }}>Price</th>
            <th style={{ textAlign: "right", paddingBottom: "4px", width: "22%", fontWeight: "bold" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, idx) => (
            <tr key={item.id} style={{ verticalAlign: "top" }}>
              <td style={{ textAlign: "left", paddingTop: "4px", fontWeight: "bold", paddingRight: "4px" }}>
                {idx + 1} {item.name}
                {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                  <div style={{ fontSize: "10px", fontWeight: "normal", color: "#333" }}>
                    ({item.addons.map((a: any) => a.name).join(", ")})
                  </div>
                )}
              </td>
              <td style={{ textAlign: "center", paddingTop: "4px", fontWeight: "normal" }}>{item.quantity}</td>
              <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "normal" }}>{Number(item.unitPrice).toFixed(2)}</td>
              <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "bold" }}>{Number(item.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000", marginTop: "6px", paddingTop: "4px", fontSize: "11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>Total Qty: {bill.items.reduce((sum, i) => sum + i.quantity, 0)}</span>
          <span>Sub Total  {Number(bill.subtotal).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", margin: "6px 0", padding: "6px 0", display: "flex", justifyContent: "space-between", fontWeight: "900", fontSize: "15px" }}>
        <span>Grand Total</span>
        <span>₹ {Number(bill.total).toFixed(2)}</span>
      </div>

      <div style={{ textAlign: "center", paddingTop: "4px", fontSize: "11px", fontWeight: "bold", lineHeight: "1.4" }}>
        <div>Thank You Visit Again</div>
        <div style={{ fontSize: "10px", marginTop: "2px", fontWeight: "bold" }}>"Please wait for 10 minutes after ordering."</div>
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
