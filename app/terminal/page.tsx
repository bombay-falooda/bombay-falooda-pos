"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { PosShell } from "@/components/pos-shell";
import { BillDetail, OrderCard, ThermalBillReceipt, money, pillClass } from "@/components/pos-ui";
import {
  apiRequest,
  type AcceptedDigitalOrder,
  type Bill,
  type DigitalOrder,
  type MenuAddon,
  type MenuCategory,
  type MenuItem,
} from "@/lib/api";

type CartLine = {
  localId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  addons: Array<{ addonId: string; name: string; price: number }>;
};

type ShiftSummary = {
  totalSales: number;
  finalizedBills: number;
  heldBills: number;
  kotTickets: number;
};

const orderTypes = ["DINE_IN", "TAKEAWAY", "DELIVERY"] as const;
const paymentMethods = ["CASH", "UPI", "CARD", "ONLINE", "OTHER"] as const;

export default function PosTerminalPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [heldBills, setHeldBills] = useState<Bill[]>([]);
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [orderType, setOrderType] = useState<(typeof orderTypes)[number]>("TAKEAWAY");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("UPI");
  const [discount, setDiscount] = useState("0");
  const [billNote, setBillNote] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadTerminal();
  }, []);

  async function loadTerminal() {
    try {
      const [menu, held, digitalOrders, shift] = await Promise.all([
        apiRequest<MenuCategory[]>("/pos-terminal/menu"),
        apiRequest<Bill[]>("/pos-terminal/bills/held"),
        apiRequest<DigitalOrder[]>("/pos-terminal/orders"),
        apiRequest<ShiftSummary>("/pos-terminal/shift-summary"),
      ]);
      setCategories(menu);
      setHeldBills(held);
      setOrders(digitalOrders);
      setSummary(shift);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load POS dashboard");
    }
  }

  const visibleItems = useMemo(() => {
    const items = categories.flatMap((category) => category.items);
    return selectedCategory === "all"
      ? items
      : items.filter((item) => item.categoryId === selectedCategory);
  }, [categories, selectedCategory]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { WEBSITE: 0, ZOMATO: 0, SWIGGY: 0, EZCATER: 0 };
    for (const order of orders) {
      counts[order.source] = (counts[order.source] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const activeTotal = activeBill ? Number(activeBill.total) : cartSubtotal;
  const payableTotal = Math.max(activeTotal - Number(discount || 0), 0);

  function addItem(item: MenuItem, addons: MenuAddon[]) {
    const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
    setCart((current) => [
      ...current,
      {
        localId: `${item.id}-${Date.now()}-${current.length}`,
        itemId: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: item.price + addonTotal,
        addons: addons.map((addon) => ({ addonId: addon.id, name: addon.name, price: addon.price })),
      },
    ]);
  }

  function updateQuantity(localId: string, quantity: number) {
    setCart((current) =>
      current
        .map((item) => (item.localId === localId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function createOrAddBill() {
    if (!cart.length) {
      setError("Add at least one item");
      return;
    }

    await runAction(async () => {
      const body = {
        items: cart.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          addons: item.addons,
        })),
      };
      const bill = activeBill
        ? await apiRequest<Bill>(`/pos-terminal/bills/${activeBill.id}/items`, { method: "PATCH", body })
        : await apiRequest<Bill>("/pos-terminal/bills", {
            method: "POST",
            body: { ...body, type: orderType, customerPhone, notes: billNote, notePrintEnabled: true },
          });
      setActiveBill(bill);
      setCart([]);
      await loadTerminal();
      setMessage(activeBill ? "Items added. Create a new KOT for kitchen." : "Bill held. Create KOT when ready.");
    });
  }

  async function createKot() {
    if (!activeBill) {
      setError("Select or create a bill first");
      return;
    }

    await runAction(async () => {
      await apiRequest(`/pos-terminal/bills/${activeBill.id}/kot`, {
        method: "POST",
        body: { notes: billNote },
      });
      const held = await apiRequest<Bill[]>("/pos-terminal/bills/held");
      setHeldBills(held);
      setActiveBill(held.find((bill) => bill.id === activeBill.id) || activeBill);
      setMessage("KOT created and linked to this bill.");
    });
  }

  async function finalizeBill() {
    if (!activeBill) {
      setError("Select a bill first");
      return;
    }

    await runAction(async () => {
      const bill = await apiRequest<Bill>(`/pos-terminal/bills/${activeBill.id}/finalize`, {
        method: "PATCH",
        body: {
          discount: Number(discount || 0),
          payments: [{ method: paymentMethod, amount: payableTotal }],
        },
      });
      setActiveBill(bill);
      setDiscount("0");
      await loadTerminal();
      setMessage(`Final bill ${bill.billNumber} completed.`);
    });
  }

  async function acceptDigitalOrder(orderId: string) {
    await runAction(async () => {
      const result = await apiRequest<AcceptedDigitalOrder>(`/pos-terminal/orders/${orderId}/accept`, { method: "POST" });
      setActiveBill(result.bill);
      await loadTerminal();
      setMessage(result.message);
    });
  }

  async function updateOrderStatus(orderId: string, status: string) {
    await runAction(async () => {
      await apiRequest(`/pos-terminal/orders/${orderId}/status`, { method: "PATCH", body: { status } });
      await loadTerminal();
      setMessage("Digital order updated.");
    });
  }

  const currentThermalBill: Bill | null = activeBill || (cart.length ? {
    id: "draft",
    billNumber: "COUNTER-BILL",
    status: "HELD",
    subtotal: activeTotal,
    discount: Number(discount || 0),
    total: payableTotal,
    customerName: "Walk-in Customer",
    customerPhone: customerPhone || undefined,
    paymentMethod: paymentMethod,
    orderType: "TAKEAWAY",
    createdAt: new Date().toISOString(),
    items: cart.map((c, i) => ({
      id: String(i),
      name: c.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      total: c.unitPrice * c.quantity,
      addons: c.addons.map((a) => ({ addonId: a.addonId, name: a.name, price: a.price })),
    })),
    kotTickets: [],
    payments: [],
  } : null);

  return (
    <PosShell>
      {currentThermalBill ? <ThermalBillReceipt bill={currentThermalBill} /> : null}
      {(message || error) && (
        <div className="no-print fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-2xl border border-[#eadbd1] bg-white px-6 py-3 text-center text-sm font-bold shadow-2xl">
          <p className={error ? "text-red-600" : "text-[#0f766e]"}>{error || message}</p>
          <button onClick={() => { setError(""); setMessage(""); }} className="mt-1 text-xs text-[#7d6b62]">Dismiss</button>
        </div>
      )}

      <div className="grid min-h-full grid-cols-[minmax(0,1fr)_380px] gap-2 max-xl:grid-cols-1">
        <section className="min-h-0 space-y-2">
          <header className="pos-panel sticky top-0 z-20 rounded-[22px] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-bold">Counter Dashboard</p>
                <p className="text-xs font-semibold text-[#7d6b62]">Menu, add-ons, digital orders, KOT and final billing.</p>
              </div>
              <button onClick={() => void loadTerminal()} className="rounded-xl border border-[#eadbd1] bg-white px-3 py-2 text-xs font-bold">Refresh</button>
            </div>
          </header>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Sales Today" value={money(summary?.totalSales ?? 0)} />
            <Metric label="Bills" value={`${summary?.finalizedBills ?? 0} final / ${summary?.heldBills ?? 0} held`} />
            <Metric label="KOTs" value={String(summary?.kotTickets ?? 0)} />
            <Metric label="Digital Queue" value={`${orders.length} live`} />
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["WEBSITE", "ZOMATO", "SWIGGY", "EZCATER"].map((source) => (
              <div key={source} className="rounded-[18px] border border-[#eadbd1] bg-white/72 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7d6b62]">{source}</p>
                <p className="font-display mt-2 text-xl font-bold">{sourceCounts[source] || 0}</p>
              </div>
            ))}
          </section>

          <section className="pos-panel rounded-[22px] p-3">
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setSelectedCategory("all")} className={pillClass(selectedCategory === "all")}>All Menu</button>
              {categories.map((category) => (
                <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={pillClass(selectedCategory === category.id)}>
                  {category.name}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
              {visibleItems.map((item) => <MenuTile key={item.id} item={item} onAdd={addItem} />)}
              {!visibleItems.length ? <p className="col-span-full rounded-2xl border border-dashed border-[#eadbd1] p-8 text-center text-sm font-semibold text-[#7d6b62]">No active menu items.</p> : null}
            </div>
          </section>

          <section className="grid gap-2 xl:grid-cols-2">
            <QueuePanel title="Held Bills">
              {heldBills.map((bill) => (
                <button key={bill.id} onClick={() => setActiveBill(bill)} className={`w-full rounded-xl border p-3 text-left ${activeBill?.id === bill.id ? "border-[#c2415d] bg-[#c2415d]/8" : "border-[#eadbd1] bg-white/76"}`}>
                  <span className="text-sm font-bold">{bill.billNumber}</span>
                  <span className="float-right font-display font-bold">{money(Number(bill.total))}</span>
                  <span className="mt-1 block text-xs text-[#7d6b62]">{bill.items.length} items, {bill.kotTickets.length} KOTs linked</span>
                </button>
              ))}
              {!heldBills.length ? <p className="text-sm font-semibold text-[#7d6b62]">No held bills.</p> : null}
            </QueuePanel>
            <QueuePanel title="Digital Orders Routed Here">
              {orders.slice(0, 4).map((order) => <OrderCard key={order.id} order={order} onAccept={acceptDigitalOrder} onStatus={updateOrderStatus} />)}
              {!orders.length ? <p className="text-sm font-semibold text-[#7d6b62]">No digital orders waiting.</p> : null}
            </QueuePanel>
          </section>
        </section>

        <aside className="pos-panel sticky top-2 h-[calc(100vh-16px)] overflow-y-auto rounded-[22px] p-3 scrollbar-none max-xl:static max-xl:h-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Current Bill</h2>
              <p className="text-xs font-semibold text-[#7d6b62]">{activeBill?.billNumber || "New bill"}</p>
            </div>
            <button onClick={() => { setActiveBill(null); setCart([]); }} className="rounded-xl border border-[#eadbd1] bg-white px-3 py-1.5 text-xs font-bold">Clear</button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {orderTypes.map((item) => <button key={item} onClick={() => setOrderType(item)} className={pillClass(orderType === item)}>{item.replace("_", " ")}</button>)}
          </div>
          <input className="pos-input mt-3" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Customer phone optional" />

          <div className="mt-3 space-y-2">
            {activeBill ? <BillDetail bill={activeBill} /> : null}
            {cart.map((item) => (
              <div key={item.localId} className="rounded-xl border border-[#eadbd1] bg-white/78 p-3">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    {item.addons.length ? <p className="text-xs text-[#7d6b62]">{item.addons.map((addon) => addon.name).join(", ")}</p> : null}
                  </div>
                  <p className="font-display font-bold">{money(item.unitPrice * item.quantity)}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="h-7 w-7 rounded-lg bg-[#17110f] text-white" onClick={() => updateQuantity(item.localId, item.quantity - 1)}>-</button>
                  <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                  <button className="h-7 w-7 rounded-lg bg-[#17110f] text-white" onClick={() => updateQuantity(item.localId, item.quantity + 1)}>+</button>
                </div>
              </div>
            ))}
            {!activeBill && !cart.length ? <p className="rounded-2xl border border-dashed border-[#eadbd1] p-6 text-center text-sm font-semibold text-[#7d6b62]">Tap menu items to begin.</p> : null}
          </div>

          <textarea className="mt-3 min-h-16 w-full rounded-xl border border-[#eadbd1] bg-white/82 p-3 text-xs outline-none" value={billNote} onChange={(event) => setBillNote(event.target.value)} placeholder="KOT / bill note" />
          <div className="mt-3 rounded-2xl bg-[#17110f] p-4 text-white">
            <div className="flex justify-between text-xs"><span>Subtotal</span><span>{money(activeTotal)}</span></div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs">Discount</span>
              <input className="h-8 w-24 rounded-lg border border-white/10 bg-white/10 px-2 text-right text-xs outline-none" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-white/12 pt-4">
              <span className="text-xs text-white/70">Payable</span>
              <span className="font-display text-2xl font-bold">{money(payableTotal)}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {paymentMethods.map((item) => <button key={item} onClick={() => setPaymentMethod(item)} className={pillClass(paymentMethod === item)}>{item}</button>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button disabled={busy} onClick={() => void createOrAddBill()} className="rounded-xl bg-[#c2415d] px-3 py-3 text-xs font-bold text-white disabled:opacity-60">{activeBill ? "Add Items" : "Hold Bill"}</button>
            <button disabled={busy} onClick={() => void createKot()} className="rounded-xl bg-[#f3b33d] px-3 py-3 text-xs font-bold text-[#17110f] disabled:opacity-60">Create KOT</button>
            <button disabled={busy} onClick={() => void finalizeBill()} className="rounded-xl bg-[#0f766e] px-3 py-3 text-xs font-bold text-white disabled:opacity-60">Final Bill</button>
            <button disabled={!customerPhone && !activeBill?.customerPhone} onClick={() => { const phone = customerPhone || activeBill?.customerPhone; if (phone) window.location.href = `tel:${phone}`; }} className="rounded-xl bg-[#17110f] px-3 py-3 text-xs font-bold text-white disabled:opacity-50">Call</button>
          </div>
        </aside>
      </div>
    </PosShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="pos-panel rounded-[18px] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7d6b62]">{label}</p>
      <p className="font-display mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function QueuePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pos-panel rounded-[22px] p-3">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function MenuTile({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem, addons: MenuAddon[]) => void }) {
  const allAddons = item.addonGroups.flatMap((group) => group.addons);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const selectedAddons = allAddons.filter((addon) => selectedAddonIds.includes(addon.id));

  return (
    <article className="rounded-2xl border border-[#eadbd1] bg-white/78 p-3 shadow-sm">
      <p className="font-display text-base font-bold">{item.name}</p>
      <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#7d6b62]">{item.description || "Bombay Falooda menu item"}</p>
      <p className="mt-2 font-display text-xl font-bold">{money(item.price)}</p>
      {item.addonGroups.length ? (
        <div className="mt-3 space-y-2">
          {item.addonGroups.map((group) => (
            <div key={group.id}>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#7d6b62]">{group.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.addons.map((addon) => (
                  <button
                    key={addon.id}
                    onClick={() => setSelectedAddonIds((current) => current.includes(addon.id) ? current.filter((id) => id !== addon.id) : [...current, addon.id])}
                    className={pillClass(selectedAddonIds.includes(addon.id))}
                  >
                    {addon.name} +{money(addon.price)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <button onClick={() => onAdd(item, selectedAddons)} className="mt-3 h-9 w-full rounded-xl bg-[#17110f] text-xs font-bold text-white">Add to bill</button>
    </article>
  );
}
