"use client";

import { useEffect, useMemo, useState } from "react";

import { PosShell } from "@/components/pos-shell";
import { OrderCard } from "@/components/pos-ui";
import { apiRequest, type AcceptedDigitalOrder, type DigitalOrder } from "@/lib/api";

export default function DigitalOrdersPage() {
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [source, setSource] = useState("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setOrders(await apiRequest<DigitalOrder[]>("/pos-terminal/orders"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load digital orders");
    }
  }

  const counts = useMemo(() => {
    const rows: Record<string, number> = { WEBSITE: 0, ZOMATO: 0, SWIGGY: 0, EZCATER: 0 };
    for (const order of orders) rows[order.source] = (rows[order.source] || 0) + 1;
    return rows;
  }, [orders]);
  const filtered = source === "ALL" ? orders : orders.filter((order) => order.source === source);

  async function acceptOrder(id: string) {
    try {
      const result = await apiRequest<AcceptedDigitalOrder>(`/pos-terminal/orders/${id}/accept`, { method: "POST" });
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept order");
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiRequest(`/pos-terminal/orders/${id}/status`, { method: "PATCH", body: { status } });
      setMessage("Digital order updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order");
    }
  }

  return (
    <PosShell>
      {(message || error) ? (
        <div className="mb-2 rounded-2xl border border-[#eadbd1] bg-white px-4 py-3 text-sm font-bold">
          <p className={error ? "text-red-600" : "text-[#0f766e]"}>{error || message}</p>
        </div>
      ) : null}
      <header className="pos-panel rounded-[22px] px-4 py-3">
        <h1 className="font-display text-2xl font-bold">Digital Orders</h1>
        <p className="text-xs font-semibold text-[#7d6b62]">
          Website, Zomato, Swiggy and Easy Cater orders routed to this POS by franchise order routing.
        </p>
      </header>
      <section className="mt-2 grid grid-cols-5 gap-2 max-xl:grid-cols-3">
        {["ALL", "WEBSITE", "ZOMATO", "SWIGGY", "EZCATER"].map((item) => (
          <button
            key={item}
            onClick={() => setSource(item)}
            className={`rounded-[18px] border p-3 text-left ${source === item ? "border-[#c2415d] bg-[#c2415d]/8" : "border-[#eadbd1] bg-white/72"}`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7d6b62]">{item}</p>
            <p className="font-display mt-2 text-2xl font-bold">{item === "ALL" ? orders.length : counts[item] || 0}</p>
          </button>
        ))}
      </section>
      <section className="mt-2 grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((order) => <OrderCard key={order.id} order={order} onAccept={acceptOrder} onStatus={updateStatus} />)}
        {!filtered.length ? <p className="rounded-2xl border border-dashed border-[#eadbd1] p-8 text-center text-sm font-semibold text-[#7d6b62]">No digital orders for this filter.</p> : null}
      </section>
    </PosShell>
  );
}
