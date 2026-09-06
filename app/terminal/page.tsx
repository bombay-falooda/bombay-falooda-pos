"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  Store,
  ClipboardList,
  PauseCircle,
  LogOut,
  HelpCircle,
  UtensilsCrossed,
  Utensils,
  Bike,
  ShoppingBag,
  User,
  MessageSquare,
  Search,
  Plus,
  Minus,
  X,
  Check,
  CreditCard,
  Banknote,
  QrCode,
  Menu,
  Receipt,
  IndianRupee,
  Users,
  Sun,
  ShieldCheck,
  Printer,
  Radio,
  Settings,
} from "lucide-react";

import { ThermalBillReceipt, money } from "@/components/pos-ui";
import { apiRequest, type AcceptedDigitalOrder, type Bill, type DigitalOrder, type MenuAddon, type MenuCategory, type MenuItem } from "@/lib/api";
import { clearPosSession, getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";

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
  payments?: Array<{ method: string; amount: number }>;
};

const orderTypes = [
  { id: "DINE_IN", label: "Dine In", icon: Utensils },
  { id: "TAKEAWAY", label: "Takeaway", icon: ShoppingBag },
  { id: "DELIVERY", label: "Delivery", icon: Bike },
] as const;

export default function PosTerminalPage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [heldBills, setHeldBills] = useState<Bill[]>([]);
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  
  // Controls & Inputs
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("TAKEAWAY");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD" | "ONLINE">("CASH");
  const [itemSearch, setItemSearch] = useState("");
  const [shortCodeSearch, setShortCodeSearch] = useState("");
  const [billNoSearch, setBillNoSearch] = useState("");
  const [kotNoSearch, setKotNoSearch] = useState("");
  const [discount, setDiscount] = useState("0");
  const [billNote, setBillNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  // Sidebar Drawers State
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [showTodayOrdersDrawer, setShowTodayOrdersDrawer] = useState(false);
  const [showTodaySalesDrawer, setShowTodaySalesDrawer] = useState(false);
  const [showLiveOrdersDrawer, setShowLiveOrdersDrawer] = useState(false);
  const [showTeamMembersDrawer, setShowTeamMembersDrawer] = useState(false);
  const [showShiftDayDrawer, setShowShiftDayDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  // Shift Day State
  const [openingFloat, setOpeningFloat] = useState("500");
  const [shiftStatus, setShiftStatus] = useState<"OPEN" | "CLOSED">("OPEN");

  // Settings State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [printerName, setPrinterName] = useState("Thermal Receipt Printer (80mm)");
  const [printerIp, setPrinterIp] = useState("192.168.1.100");
  const [paperWidth, setPaperWidth] = useState("80mm");
  const [autoCut, setAutoCut] = useState(true);

  // Team Members State
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; fullName: string; email?: string; phone?: string; role: string; status: string; checkInTime: string }>>([
    { id: "tm-1", fullName: "Sahir Qureshi", email: "sahir@zynteq.com", phone: "9876543210", role: "POS_USER", status: "PRESENT", checkInTime: "09:00 AM" },
    { id: "tm-2", fullName: "Zahid Qureshi", email: "zahid@zynteq.com", phone: "9876543211", role: "STAFF", status: "PRESENT", checkInTime: "09:15 AM" },
  ]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = getPosToken();
    const savedContext = getSavedPosContext();
    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }
    setContext(savedContext);
    void loadTerminal();
  }, [router]);

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
      if (menu.length > 0 && selectedCategory === "all") {
        setSelectedCategory(menu[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load PetPooja POS data");
    }
  }

  function handleNewOrder() {
    setActiveBill(null);
    setCart([]);
    setDiscount("0");
    setBillNote("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setMessage("New Order started.");
  }

  // Filtered Menu Items
  const visibleItems = useMemo(() => {
    let items = categories.flatMap((cat) => cat.items);
    if (selectedCategory !== "all") {
      items = items.filter((item) => item.categoryId === selectedCategory);
    }
    if (itemSearch.trim()) {
      const query = itemSearch.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query))
      );
    }
    return items;
  }, [categories, selectedCategory, itemSearch]);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const activeTotal = activeBill ? Number(activeBill.total) : cartSubtotal;
  const payableTotal = Math.max(activeTotal - Number(discount || 0), 0);

  function addItemDirectly(item: MenuItem, addons: MenuAddon[] = []) {
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

  function handleItemClick(item: MenuItem) {
    addItemDirectly(item, []);
  }

  function updateQuantity(localId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.localId === localId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartLine => item !== null)
    );
  }

  function removeCartItem(localId: string) {
    setCart((current) => current.filter((item) => item.localId !== localId));
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

  async function createOrAddBill(shouldPrint = false) {
    if (!cart.length && !activeBill) {
      setError("Please select at least one item from left menu");
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
            body: {
              ...body,
              type: orderType,
              customerName: customerName || undefined,
              customerPhone: customerPhone || undefined,
              notes: billNote,
              notePrintEnabled: true,
            },
          });

      setActiveBill(bill);
      setCart([]);
      await loadTerminal();
      setMessage(activeBill ? "Bill updated." : `Bill ${bill.billNumber} saved & held.`);
      if (shouldPrint) {
        setTimeout(() => window.print(), 300);
      }
    });
  }

  async function createKot(shouldPrint = false) {
    if (!activeBill && cart.length > 0) {
      await createOrAddBill(false);
    }
    if (!activeBill) {
      setError("Select or create a bill first");
      return;
    }

    await runAction(async () => {
      await apiRequest(`/pos-terminal/bills/${activeBill.id}/kot`, {
        method: "POST",
        body: { notes: billNote },
      });
      await loadTerminal();
      setMessage(`KOT created & linked to Bill ${activeBill.billNumber}.`);
      if (shouldPrint) {
        setTimeout(() => window.print(), 300);
      }
    });
  }

  async function finalizeBill(shouldPrint = false) {
    if (!activeBill && cart.length > 0) {
      await createOrAddBill(false);
    }
    if (!activeBill) {
      setError("No active bill selected to finalize");
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
      setMessage(`Bill ${bill.billNumber} finalized & paid.`);
      if (shouldPrint) {
        setTimeout(() => window.print(), 300);
      }
    });
  }

  async function acceptDigitalOrder(orderId: string) {
    await runAction(async () => {
      const result = await apiRequest<AcceptedDigitalOrder>(`/pos-terminal/orders/${orderId}/accept`, {
        method: "POST",
      });
      setActiveBill(result.bill);
      await loadTerminal();
      setMessage(result.message);
    });
  }

  function logout() {
    clearPosSession();
    router.replace("/login");
  }

  const currentThermalBill: Bill | null =
    activeBill ||
    (cart.length
      ? {
          id: "draft",
          billNumber: "COUNTER-BILL",
          status: "HELD",
          subtotal: activeTotal,
          discount: Number(discount || 0),
          total: payableTotal,
          customerName: customerName || "Walk-in Customer",
          customerPhone: customerPhone || undefined,
          paymentMethod: paymentMethod,
          orderType: orderType,
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
        }
      : null);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#eef2f6] text-[#1e293b] overflow-hidden select-none font-sans">
      {currentThermalBill ? <ThermalBillReceipt bill={currentThermalBill} /> : null}

      {/* TOP HEADER BAR (Exact Match to PetPooja POS Header in Photo) */}
      <header className="no-print h-12 bg-white text-[#1e293b] flex items-center justify-between px-3 shrink-0 border-b border-[#cbd5e1] shadow-2xs z-30">
        {/* Left Brand & Action Bar */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNavDrawer(true)}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-700 transition"
            title="Sidebar Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo Badge */}
          <div className="flex items-center gap-1.5">
            <div className="h-7 px-2 rounded-md bg-[#b82e46] text-white font-black text-xs flex items-center justify-center tracking-tight shadow-2xs">
              POSS
            </div>
            <span className="text-xs font-bold text-slate-800 hidden sm:inline">
              Bombay Falooda <span className="text-[11px] font-mono text-slate-500">({context?.outlet.code || "R403993"})</span>
            </span>
          </div>

          {/* New Order Button */}
          <button
            type="button"
            onClick={handleNewOrder}
            className="bg-[#b82e46] hover:bg-[#a8253b] text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-2xs transition"
          >
            New Order
          </button>

          {/* Quick Header Inputs */}
          <div className="hidden xl:flex items-center gap-2 ml-1">
            <input
              type="text"
              placeholder="Q Search Item"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="h-7 w-36 rounded border border-slate-300 bg-[#f8fafc] px-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#b82e46]"
            />
            <input
              type="text"
              placeholder="Q Bill No"
              value={billNoSearch}
              onChange={(e) => setBillNoSearch(e.target.value)}
              className="h-7 w-24 rounded border border-slate-300 bg-[#f8fafc] px-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#b82e46]"
            />
            <input
              type="text"
              placeholder="Q KOT No"
              value={kotNoSearch}
              onChange={(e) => setKotNoSearch(e.target.value)}
              className="h-7 w-24 rounded border border-slate-300 bg-[#f8fafc] px-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#b82e46]"
            />
          </div>
        </div>

        {/* Right Utility Icons (PetPooja POS Strip) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
            <Link
              href="/terminal/item-toggle"
              className="flex items-center gap-1.5 hover:text-[#b82e46] transition"
              title="Item On/Off"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-600 hover:text-[#b82e46]" />
              <span className="hidden md:inline text-[11px]">Item On/Off</span>
            </Link>

            <Link
              href="/terminal/live-orders"
              className="flex items-center gap-1.5 hover:text-purple-600 transition"
              title="Live Orders"
            >
              <Radio className="h-4 w-4 text-purple-600 animate-pulse" />
              <span className="hidden md:inline text-[11px] font-bold text-purple-700">Live Orders</span>
            </Link>

            <Link href="/terminal" className="flex items-center gap-1.5 hover:text-[#b82e46] transition" title="Store">
              <Store className="h-4 w-4 text-slate-600 hover:text-[#b82e46]" />
              <span className="hidden md:inline text-[11px]">Store</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowOrdersModal(true)}
              className="flex items-center gap-1.5 hover:text-[#b82e46] transition relative"
              title="Orders"
            >
              <ClipboardList className="h-4 w-4 text-slate-600 hover:text-[#b82e46]" />
              <span className="hidden md:inline text-[11px]">Orders</span>
              {orders.length > 0 && (
                <span className="h-4 w-4 rounded-full bg-[#b82e46] text-white text-[10px] font-bold flex items-center justify-center">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowHoldModal(true)}
              className="flex items-center gap-1.5 hover:text-[#b82e46] transition relative"
              title="Hold"
            >
              <PauseCircle className="h-4 w-4 text-slate-600 hover:text-[#b82e46]" />
              <span className="hidden md:inline text-[11px]">Hold</span>
              {heldBills.length > 0 && (
                <span className="h-4 w-4 rounded-full bg-[#b82e46] text-white text-[10px] font-bold flex items-center justify-center">
                  {heldBills.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 hover:text-red-600 transition"
              title="Logout"
            >
              <LogOut className="h-4 w-4 text-slate-600 hover:text-red-600" />
              <span className="hidden md:inline text-[11px]">Logout</span>
            </button>
          </div>

          <div className="hidden lg:block border-l border-slate-300 pl-3 text-right">
            <span className="text-[10px] text-slate-400 block leading-tight">Need Help?</span>
            <span className="text-xs font-mono font-bold text-blue-600 block">07969 223344</span>
          </div>
        </div>
      </header>

      {/* TOAST / ALERT NOTIFICATION */}
      {(message || error) && (
        <div className="no-print fixed top-14 right-5 z-50 rounded-md bg-slate-900 text-white border border-slate-700 px-3.5 py-2 text-xs font-semibold shadow-xl flex items-center gap-3">
          <span className={error ? "text-red-400" : "text-emerald-400"}>
            {error || message}
          </span>
          <button
            type="button"
            onClick={() => { setError(""); setMessage(""); }}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* MAIN 3-PANEL WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANE 1: LEFT CATEGORY NAVIGATION BAR (Width ~190px - PetPooja Theme) */}
        <aside className="w-48 bg-[#eaeaef] border-r border-[#cbd5e1] flex flex-col shrink-0 overflow-y-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold transition border-b border-[#d8d8e2] ${
              selectedCategory === "all"
                ? "bg-white text-[#10201f] border-l-4 border-[#b82e46] font-bold shadow-2xs"
                : "text-[#475569] hover:bg-white/50"
            }`}
          >
            All Categories
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-3.5 py-2.5 text-xs transition border-b border-[#d8d8e2] leading-tight ${
                  isSelected
                    ? "bg-white text-[#10201f] border-l-4 border-[#b82e46] font-bold shadow-2xs"
                    : "text-[#475569] hover:bg-white/50"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </aside>

        {/* PANE 2: CENTER ITEMS GRID & SEARCH AREA */}
        <section className="flex-1 flex flex-col bg-[#f1f5f9] min-w-0 overflow-hidden">
          {/* Sub Header Search */}
          <div className="p-2 bg-white border-b border-[#cbd5e1] flex gap-2 shrink-0">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Q Search Item"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full h-8 rounded border border-slate-300 bg-[#f8fafc] px-2.5 text-xs text-slate-800 outline-none focus:border-[#b82e46]"
              />
            </div>
            <input
              type="text"
              placeholder="Short Code"
              value={shortCodeSearch}
              onChange={(e) => setShortCodeSearch(e.target.value)}
              className="w-32 h-8 rounded border border-slate-300 bg-[#f8fafc] px-2.5 text-xs text-slate-800 outline-none focus:border-[#b82e46]"
            />
          </div>

          {/* Items Grid */}
          <div className="flex-1 p-2.5 overflow-y-auto scrollbar-none">
            {visibleItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">
                No active items found.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                {visibleItems.map((item) => {
                  const inCartCount = cart
                    .filter((c) => c.itemId === item.id)
                    .reduce((sum, c) => sum + c.quantity, 0);

                  const uniqueAddons = Array.from(
                    new Map(
                      (item.addonGroups || [])
                        .flatMap((g) => g.addons)
                        .map((a) => [a.id, a])
                    ).values()
                  );

                  return (
                    <div
                      key={item.id}
                      className={`relative min-h-[95px] p-2.5 rounded-lg bg-white border text-left flex flex-col justify-between transition shadow-2xs hover:shadow-sm border-l-4 border-l-emerald-600 ${
                        inCartCount > 0
                          ? "border-2 border-blue-600 bg-blue-50/60"
                          : "border-slate-300 hover:border-blue-400"
                      }`}
                    >
                      {/* Top Title Bar: Click to order Base Item without add-ons */}
                      <div
                        onClick={() => handleItemClick(item)}
                        className="cursor-pointer group flex items-start justify-between gap-1 pb-1"
                        title="Click to order base item without add-ons"
                      >
                        <span className="font-bold text-xs text-slate-800 leading-tight group-hover:text-blue-600 transition">
                          {item.name}
                        </span>
                        {uniqueAddons.length > 0 && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 shrink-0">
                            +Addons
                          </span>
                        )}
                      </div>

                      {/* Stacked Vertical Add-ons List (One below the other in small text) */}
                      {uniqueAddons.length > 0 && (
                        <div
                          className="my-1 p-1 rounded bg-slate-50 border border-slate-200 space-y-1 max-h-32 overflow-y-auto scrollbar-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
                            Addons:
                          </div>
                          {uniqueAddons.map((addon) => (
                            <button
                              key={addon.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addItemDirectly(item, [addon]);
                              }}
                              className="w-full text-left px-1.5 py-1 rounded text-[10px] bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-200 transition font-medium flex items-center justify-between gap-1 shadow-2xs group"
                              title={`Add ${item.name} + ${addon.name}`}
                            >
                              <span className="truncate">+ {addon.name}</span>
                              <span className="font-mono text-[9px] shrink-0 font-bold text-slate-500 group-hover:text-white">
                                (+₹{addon.price})
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Bottom Price Footer: Click to order Base Item without add-ons */}
                      <div
                        onClick={() => handleItemClick(item)}
                        className="cursor-pointer pt-1 border-t border-slate-100 flex items-center justify-between shrink-0 group"
                        title="Click to order base item without add-ons"
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[11px] font-bold text-slate-700 group-hover:text-blue-600 transition">
                            ₹{Number(item.price).toFixed(0)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold">(Base)</span>
                        </div>

                        {inCartCount > 0 && (
                          <span className="h-4 px-1.5 rounded bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">
                            x{inCartCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* PANE 3: RIGHT CART & BILLING RECEIPT PANEL */}
        <aside className="w-[450px] bg-white border-l border-[#cbd5e1] flex flex-col shrink-0 shadow-md">
          {/* Customer / Note Row */}
          <div className="p-1.5 border-b border-[#cbd5e1] flex items-center justify-between gap-2 bg-[#f8fafc]">
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="h-8 w-9 flex items-center justify-center rounded border border-slate-300 bg-white text-[#b82e46] hover:bg-slate-50 transition shrink-0 shadow-2xs"
              title={customerName || customerPhone ? `${customerName || "Customer"} (${customerPhone})` : "Add Customer"}
            >
              <User className="h-4 w-4 text-[#b82e46]" />
            </button>

            <div className="flex-1 h-8 rounded border border-slate-300 bg-white px-2 flex items-center gap-1 focus-within:border-[#b82e46]">
              <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Note / Table"
                value={billNote}
                onChange={(e) => setBillNote(e.target.value)}
                className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Cart Items Table Header */}
          <div className="grid grid-cols-12 px-3 py-1.5 bg-[#f1f5f9] border-b border-[#cbd5e1] text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <div className="col-span-5">ITEMS</div>
            <div className="col-span-3 text-center">CHECK ITEMS</div>
            <div className="col-span-2 text-center">QTY</div>
            <div className="col-span-2 text-right">PRICE</div>
          </div>

          {/* Cart Body (Expanded Height Area) */}
          <div className="flex-1 overflow-y-auto scrollbar-none min-h-[220px]">
            {activeBill ? (
              <div className="p-2.5 space-y-2">
                <div className="p-2 rounded bg-purple-50 border border-purple-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-purple-700">
                    <span>Bill: {activeBill.billNumber}</span>
                    <span className="uppercase">{activeBill.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Customer: {activeBill.customerName || "Walk-in"} ({activeBill.customerPhone || "No Phone"})
                  </div>
                </div>

                {activeBill.items.map((item) => (
                  <div key={item.id} className="p-2 rounded border border-slate-200 bg-white text-xs space-y-0.5">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{item.name}</span>
                      <span className="font-mono">₹{Number(item.total).toFixed(0)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Qty: {item.quantity} x ₹{Number(item.unitPrice).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : cart.length === 0 ? (
              /* EMPTY CART WATERMARK */
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <div className="h-16 w-16 rounded-full border-2 border-slate-200 flex items-center justify-center mb-2 text-slate-400 bg-slate-50">
                  <UtensilsCrossed className="h-8 w-8 text-slate-400 stroke-[1.75]" />
                </div>
                <h4 className="font-bold text-xs text-slate-600">No Item Selected</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px] leading-tight">
                  Please Select Item from Left Menu Item
                </p>
              </div>
            ) : (
              /* ACTIVE CART ITEMS */
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.localId} className="p-2 hover:bg-slate-50 transition flex items-center justify-between gap-1 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{item.name}</div>
                      {item.addons.length > 0 && (
                        <div className="text-[10px] text-emerald-700 truncate">
                          + {item.addons.map((a) => a.name).join(", ")}
                        </div>
                      )}
                    </div>

                    {/* Qty Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.localId, -1)}
                        className="h-5 w-5 rounded bg-white font-bold text-xs text-slate-700 hover:bg-slate-200 flex items-center justify-center"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.localId, 1)}
                        className="h-5 w-5 rounded bg-white font-bold text-xs text-slate-700 hover:bg-slate-200 flex items-center justify-center"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[55px] flex flex-col items-end">
                      <div className="font-mono font-bold text-xs text-slate-800">
                        ₹{item.unitPrice * item.quantity}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.localId)}
                        className="p-0.5 text-slate-400 hover:text-red-600 transition"
                        title="Remove item"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compact Cart Subtotals, Action Buttons, Total Display, Order Type & Payments */}
          <div className="p-2 bg-[#f8fafc] border-t border-[#cbd5e1] space-y-1.5 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-1.5">
                <button type="button" className="px-2 py-0.5 rounded bg-slate-200 text-[10px] font-semibold text-slate-700">
                  Split
                </button>
                <button type="button" className="px-2 py-0.5 rounded bg-slate-200 text-[10px] font-semibold text-slate-700">
                  Advance Order
                </button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500">Disc:</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-14 h-6 rounded border border-slate-300 px-1 text-right font-mono text-xs font-bold"
                />
              </div>
            </div>

            {/* Action Buttons Row (Save Bill, Print Bill, KOT) */}
            <div className="grid grid-cols-3 gap-1 pt-0.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void createOrAddBill(true)}
                className="py-2 px-1 rounded bg-[#b82e46] hover:bg-[#a8253b] text-white font-black text-xs shadow-2xs transition disabled:opacity-60 flex items-center justify-center gap-1"
              >
                Save Bill
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finalizeBill(true)}
                className="py-2 px-1 rounded bg-slate-800 hover:bg-slate-900 text-white font-black text-xs shadow-2xs transition disabled:opacity-60 flex items-center justify-center gap-1"
              >
                Print Bill
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createKot(true)}
                className="py-2 px-1 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black text-xs shadow-2xs transition disabled:opacity-60 flex items-center justify-center gap-1"
              >
                KOT
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void createOrAddBill(false)}
                className="py-1 px-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] transition disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createKot(false)}
                className="py-1 px-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] transition disabled:opacity-60"
              >
                KOT Only
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createOrAddBill(false)}
                className="py-1 px-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] transition disabled:opacity-60"
              >
                Save & EBill
              </button>
            </div>

            {/* Grand Total Display */}
            <div className="flex items-center justify-between bg-slate-900 text-white px-3 py-2 rounded shadow-2xs">
              <span className="text-xs font-semibold text-slate-300">Total</span>
              <span className="font-mono text-xl font-black text-emerald-400">
                ₹ {payableTotal.toLocaleString("en-IN")}
              </span>
            </div>

            {/* Order Type Tabs (Dine In / Takeaway / Delivery) */}
            <div className="grid grid-cols-3 bg-[#e2e8f0] p-1 rounded border border-[#cbd5e1]">
              {orderTypes.map((t) => {
                const isSelected = orderType === t.id;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOrderType(t.id)}
                    className={`py-1.5 text-xs font-bold rounded transition flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-[#b82e46] text-white shadow-2xs"
                        : "text-slate-700 hover:bg-white/60"
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Payment Options */}
            <div className="grid grid-cols-3 gap-1">
              {(["CASH", "CARD", "UPI"] as const).map((m) => {
                const isSelected = paymentMethod === m;
                const PaymentIcon = m === "CASH" ? Banknote : m === "CARD" ? CreditCard : QrCode;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-1 px-1.5 rounded text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-emerald-700 text-white border-emerald-800"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <PaymentIcon className="h-3.5 w-3.5" />
                    <span>{m === "CASH" ? "Cash" : m === "CARD" ? "Card" : "UPI"}</span>
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

      </div>

      {/* HELD BILLS RIGHT-SIDE DRAWER */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[450px] p-4 space-y-3 shadow-2xl border-l border-slate-300 flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Held Bills Queue ({heldBills.length})</h3>
                <p className="text-[11px] text-slate-500">Select a held bill to resume billing</p>
              </div>
              <button type="button" onClick={() => setShowHoldModal(false)} className="p-1 rounded hover:bg-slate-100 transition">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none pr-1">
              {heldBills.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    setActiveBill(b);
                    setShowHoldModal(false);
                    setMessage(`Loaded held bill ${b.billNumber}`);
                  }}
                  className="p-3 rounded-lg border border-slate-200 hover:border-[#b82e46] bg-slate-50 hover:bg-white cursor-pointer transition shadow-2xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{b.billNumber}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {b.customerName || "Walk-in"} • {b.items.length} items
                    </div>
                  </div>
                  <div className="font-mono font-bold text-xs text-emerald-700">
                    ₹{Number(b.total).toFixed(0)}
                  </div>
                </div>
              ))}
              {heldBills.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500 font-semibold">
                  No held bills in queue.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL ORDERS RIGHT-SIDE DRAWER */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[450px] p-4 space-y-3 shadow-2xl border-l border-slate-300 flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Routed Digital Orders ({orders.length})</h3>
                <p className="text-[11px] text-slate-500">Incoming online orders ready for acceptance</p>
              </div>
              <button type="button" onClick={() => setShowOrdersModal(false)} className="p-1 rounded hover:bg-slate-100 transition">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none pr-1">
              {orders.map((o) => (
                <div key={o.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-700 uppercase bg-purple-100 px-2 py-0.5 rounded">{o.source} • {o.type}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void acceptDigitalOrder(o.id);
                        setShowOrdersModal(false);
                      }}
                      className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-2xs transition"
                    >
                      Accept & Import
                    </button>
                  </div>
                  <div className="text-xs text-slate-700">
                    Customer: {o.customerName || "Walk-in"} ({o.customerPhone || "No Phone"})
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-700">
                    Total: ₹{Number(o.total).toFixed(0)}
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500 font-semibold">
                  No pending digital orders waiting.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAILS RIGHT-SIDE DRAWER */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-96 p-5 space-y-4 shadow-2xl border-l border-slate-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Customer Details</h3>
                  <p className="text-[11px] text-slate-500">Attach customer info to this bill</p>
                </div>
                <button type="button" onClick={() => setShowCustomerModal(false)} className="p-1 rounded hover:bg-slate-100 transition">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sahir Qureshi"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-9 rounded border border-slate-300 px-3 text-xs font-medium focus:border-[#b82e46] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. sahir@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full h-9 rounded border border-slate-300 px-3 text-xs font-medium focus:border-[#b82e46] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-9 rounded border border-slate-300 px-3 text-xs font-mono focus:border-[#b82e46] outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="w-full py-2 rounded bg-[#b82e46] hover:bg-[#a8253b] text-white text-xs font-bold shadow-md transition"
              >
                Save Customer Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVIGATION DRAWER (Slide-out Left Menu) */}
      {showNavDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-start">
          <div className="bg-white h-full w-80 shadow-2xl border-r border-slate-300 flex flex-col justify-between p-4">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 px-2 rounded bg-[#b82e46] text-white font-black text-xs flex items-center justify-center">
                    POSS
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-800">Bombay Falooda POS</h3>
                    <p className="text-[10px] text-slate-500 font-mono">Outlet: {context?.outlet.code || "R403993"}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowNavDrawer(false)} className="p-1 rounded hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              {/* Menu List */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal"); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <Store className="h-4 w-4 text-slate-500" />
                  <span>Terminal Billing Register</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/orders"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    <span>Total Today Orders</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {summary?.finalizedBills ?? 0} Orders
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/sales"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <div className="flex items-center gap-3">
                    <IndianRupee className="h-4 w-4 text-emerald-600" />
                    <span>Total Sales Today</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-mono font-bold">
                    ₹{summary?.totalSales.toLocaleString("en-IN") ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/live-orders"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <div className="flex items-center gap-3">
                    <Radio className="h-4 w-4 text-purple-600" />
                    <span>Live Orders</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                    {orders.length} Active
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/team-members"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-amber-600" />
                    <span>Team Members Present</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                    {teamMembers.length} Online
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/shift"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <div className="flex items-center gap-3">
                    <Sun className="h-4 w-4 text-orange-500" />
                    <span>Start Day / End Day</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${shiftStatus === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {shiftStatus}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/item-toggle"); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <SlidersHorizontal className="h-4 w-4 text-[#b82e46]" />
                  <span>Item On/Off (Multi-Channel)</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/settings"); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#b82e46] transition"
                >
                  <Settings className="h-4 w-4 text-slate-600" />
                  <span>Settings & Config (2FA & Printer)</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t space-y-2">
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Active Register</span>
                  <span className="font-bold text-slate-800">{context?.outlet.name || "Varachha Outlet"}</span>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S TOTAL ORDERS DRAWER */}
      {showTodayOrdersDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[480px] p-4 space-y-3 shadow-2xl border-l border-slate-300 flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Total Orders Today</h3>
                <p className="text-[11px] text-slate-500">All counter & online bills generated today</p>
              </div>
              <button type="button" onClick={() => setShowTodayOrdersDrawer(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none pr-1">
              {heldBills.concat(activeBill ? [activeBill] : []).map((b) => (
                <div key={b.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{b.billNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${b.status === "FINALIZED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex justify-between">
                    <span>Customer: {b.customerName || "Walk-in"}</span>
                    <span className="font-mono font-bold text-emerald-700">₹{Number(b.total).toFixed(0)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-200">
                    <span>Type: {b.orderType}</span>
                    <span>{new Date(b.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S TOTAL SALES DRAWER */}
      {showTodaySalesDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[480px] p-5 space-y-4 shadow-2xl border-l border-slate-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Today&apos;s Total Sales Summary</h3>
                  <p className="text-[11px] text-slate-500">Live analytics for shift transactions</p>
                </div>
                <button type="button" onClick={() => setShowTodaySalesDrawer(false)} className="p-1 rounded hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Gross Sales Today</span>
                  <div className="font-mono text-2xl font-black text-emerald-800">
                    ₹ {summary?.totalSales.toLocaleString("en-IN") ?? 0}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                  <span className="text-[11px] font-bold text-blue-700 uppercase">Finalized Bills</span>
                  <div className="font-mono text-2xl font-black text-blue-800">
                    {summary?.finalizedBills ?? 0} Bills
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase text-slate-500">Payment Breakdown</h4>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 text-emerald-600" /> Cash Sales:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹ {(summary?.payments?.find(p => p.method === "CASH")?.amount ?? (summary?.totalSales ? summary.totalSales * 0.5 : 0)).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5 text-purple-600" /> UPI / QR Sales:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹ {(summary?.payments?.find(p => p.method === "UPI")?.amount ?? (summary?.totalSales ? summary.totalSales * 0.35 : 0)).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-blue-600" /> Card Sales:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹ {(summary?.payments?.find(p => p.method === "CARD")?.amount ?? (summary?.totalSales ? summary.totalSales * 0.15 : 0)).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { window.print(); }}
              className="w-full py-2.5 rounded-lg bg-[#b82e46] text-white text-xs font-bold shadow-md hover:bg-[#a8253b] transition"
            >
              Print Sales Summary Report
            </button>
          </div>
        </div>
      )}

      {/* LIVE ORDERS DRAWER */}
      {showLiveOrdersDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[480px] p-4 space-y-3 shadow-2xl border-l border-slate-300 flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Live Orders Queue</h3>
                <p className="text-[11px] text-slate-500">Real-time incoming kitchen & counter tickets</p>
              </div>
              <button type="button" onClick={() => setShowLiveOrdersDrawer(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none pr-1">
              {orders.map((o) => (
                <div key={o.id} className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-800 uppercase">{o.source} • {o.type}</span>
                    <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 text-[10px] font-bold uppercase">{o.status}</span>
                  </div>
                  <div className="text-xs text-slate-700">
                    Customer: {o.customerName || "Walk-in"} ({o.customerPhone || "No Phone"})
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-700">
                    Total: ₹{Number(o.total).toFixed(0)}
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500 font-semibold">
                  No active live orders in queue.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TEAM MEMBERS PRESENT DRAWER */}
      {showTeamMembersDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[450px] p-4 space-y-3 shadow-2xl border-l border-slate-300 flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Team Members Present Today ({teamMembers.length})</h3>
                <p className="text-[11px] text-slate-500">Staff members logged in at this outlet</p>
              </div>
              <button type="button" onClick={() => setShowTeamMembersDrawer(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none pr-1">
              {teamMembers.map((member) => (
                <div key={member.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs text-slate-900">{member.fullName}</div>
                    <div className="text-[11px] text-slate-500">{member.role} • {member.phone || member.email}</div>
                    <div className="text-[10px] text-emerald-700 font-semibold">Checked In: {member.checkInTime}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    PRESENT
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* START DAY / END DAY (REGISTER SHIFT) DRAWER */}
      {showShiftDayDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[450px] p-5 space-y-4 shadow-2xl border-l border-slate-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Start Day / End Day Register</h3>
                  <p className="text-[11px] text-slate-500">Manage shift day opening float and Z-Report closing</p>
                </div>
                <button type="button" onClick={() => setShowShiftDayDrawer(false)} className="p-1 rounded hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-700">Current Shift Status:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${shiftStatus === "OPEN" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                  {shiftStatus}
                </span>
              </div>

              {shiftStatus === "OPEN" ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                    <div className="font-bold">Shift is currently Active</div>
                    <div>Opening Cash Float: ₹{openingFloat}</div>
                    <div>Finalized Bills Today: {summary?.finalizedBills ?? 0}</div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Shift Closing Notes</label>
                    <textarea
                      placeholder="Enter shift handover notes..."
                      className="w-full h-20 rounded border border-slate-300 p-2 text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShiftStatus("CLOSED");
                      setMessage("End of Day Shift Closed. Z-Report Printed.");
                      setTimeout(() => window.print(), 300);
                    }}
                    className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition"
                  >
                    Close Shift & Print End of Day Z-Report
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Opening Cash Float (₹)</label>
                    <input
                      type="number"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      className="w-full h-9 rounded border border-slate-300 px-3 font-mono text-xs font-bold"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShiftStatus("OPEN");
                      setMessage("Day Started successfully with Opening Float ₹" + openingFloat);
                    }}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
                  >
                    Start Day Shift Register
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS DRAWER (2FA & PRINTER CONFIG) */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white h-full w-[480px] p-5 space-y-4 shadow-2xl border-l border-slate-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">POS Terminal Settings</h3>
                  <p className="text-[11px] text-slate-500">Configure 2FA security and thermal printer settings</p>
                </div>
                <button type="button" onClick={() => setShowSettingsDrawer(false)} className="p-1 rounded hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 2FA Section */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <div>
                        <h4 className="font-bold text-xs text-slate-800">Two-Factor Authentication (2FA)</h4>
                        <p className="text-[11px] text-slate-500">Require OTP code on cashier terminal login</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition ${twoFactorEnabled ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"}`}
                    >
                      {twoFactorEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                </div>

                {/* Printer Config Section */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-bold text-xs text-slate-800">Thermal Printer Configuration</h4>
                      <p className="text-[11px] text-slate-500">Configure thermal receipt printer device & paper</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Printer Device Name</label>
                      <input
                        type="text"
                        value={printerName}
                        onChange={(e) => setPrinterName(e.target.value)}
                        className="w-full h-8 rounded border border-slate-300 px-2 text-xs font-medium bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Network IP / Connection</label>
                      <input
                        type="text"
                        value={printerIp}
                        onChange={(e) => setPrinterIp(e.target.value)}
                        className="w-full h-8 rounded border border-slate-300 px-2 text-xs font-mono bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-bold text-slate-600">Paper Width</span>
                      <select
                        value={paperWidth}
                        onChange={(e) => setPaperWidth(e.target.value)}
                        className="h-8 rounded border border-slate-300 px-2 text-xs font-semibold bg-white"
                      >
                        <option value="80mm">80mm Standard Thermal</option>
                        <option value="58mm">58mm Compact Thermal</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex gap-2">
              <button
                type="button"
                onClick={() => { window.print(); }}
                className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition"
              >
                Print Test Receipt
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSettingsDrawer(false);
                  setMessage("Printer & 2FA settings saved successfully!");
                }}
                className="flex-1 py-2 rounded-lg bg-[#b82e46] hover:bg-[#a8253b] text-white text-xs font-bold shadow-md transition"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


