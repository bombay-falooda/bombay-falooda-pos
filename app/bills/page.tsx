"use client";

import { useEffect, useState } from "react";

import { PosShell } from "@/components/pos-shell";
import { BillDetail, StatusPill, formatDate, money } from "@/components/pos-ui";
import { apiRequest, type Bill } from "@/lib/api";

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selected, setSelected] = useState<Bill | null>(null);
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<Bill[]>("/pos-terminal/bills")
      .then((rows) => {
        setBills(rows);
        setSelected(rows[0] || null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load bills"));
  }, []);

  const filtered = status === "ALL" ? bills : bills.filter((bill) => bill.status === status);

  return (
    <PosShell>
      <section className="grid min-h-full grid-cols-[390px_minmax(0,1fr)] gap-2 max-xl:grid-cols-1">
        <aside className="pos-panel rounded-[22px] p-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">Bills</h1>
              <p className="text-xs font-semibold text-[#7d6b62]">Held, finalized and cancelled bills for today.</p>
            </div>
            <span className="rounded-full bg-[#0f766e]/12 px-3 py-1 text-xs font-bold text-[#0f766e]">{filtered.length}</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {["ALL", "HELD", "FINALIZED", "CANCELLED"].map((item) => (
              <button key={item} onClick={() => setStatus(item)} className={`rounded-xl px-2 py-2 text-[10px] font-black ${status === item ? "bg-[#17110f] text-white" : "border border-[#eadbd1] bg-white/72 text-[#7d6b62]"}`}>
                {item}
              </button>
            ))}
          </div>
          {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p> : null}
          <div className="mt-4 space-y-2">
            {filtered.map((bill) => (
              <button
                key={bill.id}
                onClick={() => setSelected(bill)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.id === bill.id ? "border-[#c2415d] bg-[#c2415d]/8" : "border-[#eadbd1] bg-white/76"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{bill.billNumber}</p>
                    <p className="mt-1 text-xs text-[#7d6b62]">{bill.items.length} items, {bill.kotTickets.length} KOTs</p>
                  </div>
                  <StatusPill value={bill.status} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-semibold text-[#7d6b62]">
                  <span>{money(Number(bill.total))}</span>
                  <span>{formatDate(bill.kotTickets[0]?.createdAt)}</span>
                </div>
              </button>
            ))}
            {!filtered.length ? <p className="rounded-xl border border-dashed border-[#eadbd1] p-5 text-center text-sm font-semibold text-[#7d6b62]">No bills found.</p> : null}
          </div>
        </aside>
        <main className="pos-panel rounded-[22px] p-3">
          {selected ? <BillDetail bill={selected} /> : <Empty title="Select a bill" />}
        </main>
      </section>
    </PosShell>
  );
}

function Empty({ title }: { title: string }) {
  return <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-[#eadbd1] text-sm font-bold text-[#7d6b62]">{title}</div>;
}
