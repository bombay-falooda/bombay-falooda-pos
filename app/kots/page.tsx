"use client";

import { useEffect, useState } from "react";

import { PosShell } from "@/components/pos-shell";
import { KotDetail, StatusPill, formatDate } from "@/components/pos-ui";
import { apiRequest, type KotTicket } from "@/lib/api";

export default function KotsPage() {
  const [kots, setKots] = useState<KotTicket[]>([]);
  const [selected, setSelected] = useState<KotTicket | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<KotTicket[]>("/pos-terminal/kots")
      .then((rows) => {
        setKots(rows);
        setSelected(rows[0] || null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load KOTs"));
  }, []);

  return (
    <PosShell>
      <section className="grid min-h-full grid-cols-[380px_minmax(0,1fr)] gap-2 max-xl:grid-cols-1">
        <aside className="pos-panel rounded-[22px] p-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">All KOTs</h1>
              <p className="text-xs font-semibold text-[#7d6b62]">Today&apos;s kitchen tickets linked to bills.</p>
            </div>
            <span className="rounded-full bg-[#f3b33d]/18 px-3 py-1 text-xs font-bold text-[#7a5200]">{kots.length}</span>
          </div>
          {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p> : null}
          <div className="mt-4 space-y-2">
            {kots.map((kot) => (
              <button
                key={kot.id}
                onClick={() => setSelected(kot)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.id === kot.id ? "border-[#c2415d] bg-[#c2415d]/8" : "border-[#eadbd1] bg-white/76"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{kot.kotNumber}</p>
                    <p className="mt-1 text-xs text-[#7d6b62]">{kot.bill.billNumber}</p>
                  </div>
                  <StatusPill value={kot.bill.status} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-semibold text-[#7d6b62]">
                  <span>{kot.items?.length ?? 0} lines</span>
                  <span>{formatDate(kot.createdAt)}</span>
                </div>
              </button>
            ))}
            {!kots.length ? <p className="rounded-xl border border-dashed border-[#eadbd1] p-5 text-center text-sm font-semibold text-[#7d6b62]">No KOTs today.</p> : null}
          </div>
        </aside>
        <main className="pos-panel rounded-[22px] p-3">
          {selected ? <KotDetail kot={selected} /> : <Empty title="Select a KOT" />}
        </main>
      </section>
    </PosShell>
  );
}

function Empty({ title }: { title: string }) {
  return <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-[#eadbd1] text-sm font-bold text-[#7d6b62]">{title}</div>;
}
