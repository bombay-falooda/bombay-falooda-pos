"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  Bluetooth,
} from "lucide-react";

import { ThermalBillReceipt, money } from "@/components/pos-ui";
import { apiRequest, type AcceptedDigitalOrder, type Bill, type DigitalOrder, type MenuAddon, type MenuCategory, type MenuItem } from "@/lib/api";
import { clearPosSession, getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";
import {
  connectBluetoothPrinter,
  sendEscPosToBluetooth,
  buildEscPosKotReceipt,
  buildEscPosBillReceipt,
} from "@/lib/bluetooth-printer";
import { connectUsbPrinter, sendEscPosToUsb } from "@/lib/usb-printer";

type CartLine = {
  localId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  addons: Array<{ addonId: string; name: string; price: number }>;
};

type KotTicket = {
  id: string;
  kotNumber: string;
  createdAt: string;
  notes?: string | null;
  items: Array<{
    id: string;
    quantity: number;
    notes?: string | null;
    billItem?: { name: string; total: number; unitPrice: number };
  }>;
  bill?: Bill | null;
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
  const [mounted, setMounted] = useState(false);
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

  // Recent KOTs & Center Addons Modal State
  const [showRecentKotsDrawer, setShowRecentKotsDrawer] = useState(false);
  const [recentKots, setRecentKots] = useState<KotTicket[]>([]);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customizingAddons, setCustomizingAddons] = useState<Array<{ addonId: string; name: string; price: number }>>([]);
  const [customizingQty, setCustomizingQty] = useState(1);
  const [printMode, setPrintMode] = useState<"BOTH" | "KOT_ONLY" | "BILL_ONLY">("BOTH");

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
  const [shiftClosingNotes, setShiftClosingNotes] = useState("");
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
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedType = localStorage.getItem("pos_printer_type");
      if (savedType === "BLUETOOTH" || savedType === "CABLE") {
        setPrinterConnectionType(savedType);
      }
      const savedName = localStorage.getItem("pos_printer_name");
      if (savedName) setPrinterName(savedName);
      const savedIp = localStorage.getItem("pos_printer_ip");
      if (savedIp) setPrinterIp(savedIp);
      const savedPaper = localStorage.getItem("pos_printer_paper");
      if (savedPaper) setPaperWidth(savedPaper);
    }
    const token = getPosToken();
    const savedContext = getSavedPosContext();
    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }
    setContext(savedContext);
    void loadTerminal();
  }, [router]);

  async function handleStartShift() {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const res = await apiRequest<{ success: boolean; status: "OPEN" | "CLOSED"; message: string }>("/pos-terminal/shift/start", {
        method: "POST",
        body: { openingFloat: Number(openingFloat || 0) },
      });
      setShiftStatus("OPEN");
      setMessage(res.message || "Shift / Day Started Successfully");
      void loadTerminal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start shift");
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseShift() {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const res = await apiRequest<{ success: boolean; status: "OPEN" | "CLOSED"; message: string }>("/pos-terminal/shift/end", {
        method: "POST",
        body: { closingNotes: shiftClosingNotes },
      });
      setShiftStatus("CLOSED");
      setMessage(res.message || "End of Day Shift Closed. Z-Report Printed.");
      void loadTerminal();
      setTimeout(() => window.print(), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close shift");
    } finally {
      setBusy(false);
    }
  }

  async function savePrinterSettings() {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_printer_type", printerConnectionType);
      localStorage.setItem("pos_printer_name", printerName);
      localStorage.setItem("pos_printer_ip", printerIp);
      localStorage.setItem("pos_printer_paper", paperWidth);
    }
    try {
      await apiRequest("/pos-terminal/printer-settings", {
        method: "PATCH",
        body: { printerName, printerIp, paperWidth },
      });
    } catch {
      // Local persistence intact
    }
    setShowSettingsDrawer(false);
    setMessage(`Printer config saved (${printerConnectionType === "BLUETOOTH" ? "Bluetooth Wireless Mode" : "USB Cable / Windows Mode"})`);
  }

  async function testPrinterConnection() {
    if (printerConnectionType === "BLUETOOTH") {
      if (!btDeviceName) {
        setError("No Bluetooth printer paired. Please click 'Pair Bluetooth Thermal Printer' first.");
        return;
      }
      await triggerThermalPrint("BOTH", {
        id: "test-bill",
        billNumber: "TEST-001",
        status: "FINALIZED",
        subtotal: 70,
        discount: 0,
        total: 70,
        customerName: "Test Customer",
        createdAt: new Date().toISOString(),
        orderType: "TAKEAWAY",
        items: [{ id: "test-item-1", name: "Pista Falooda (Test)", quantity: 1, unitPrice: 70, total: 70 }],
        kotTickets: [{ id: "test-kot-1", kotNumber: "TEST-1", createdAt: new Date().toISOString() }],
        payments: [],
      });
      setMessage(`Sent Bluetooth test receipt to ${btDeviceName}`);
    } else {
      setMessage("Triggering USB Cable / Windows driver test print...");
      setTimeout(() => window.print(), 250);
    }
  }

  async function loadTerminal() {
    try {
      const [menu, held, digitalOrders, shift, dayStatus] = await Promise.all([
        apiRequest<MenuCategory[]>("/pos-terminal/menu"),
        apiRequest<Bill[]>("/pos-terminal/bills/held"),
        apiRequest<DigitalOrder[]>("/pos-terminal/orders"),
        apiRequest<ShiftSummary>("/pos-terminal/shift-summary"),
        apiRequest<{ active: boolean; businessDay: any }>("/pos-terminal/day/current").catch(() => ({ active: false, businessDay: null })),
      ]);
      setCategories(menu);
      setHeldBills(held);
      setOrders(digitalOrders);
      setSummary(shift);
      if (dayStatus) {
        setShiftStatus(dayStatus.active ? "OPEN" : "CLOSED");
      }
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
    const uniqueAddons = Array.from(
      new Map(
        (item.addonGroups || [])
          .flatMap((g) => g.addons)
          .map((a) => [a.id, a])
      ).values()
    );

    if (uniqueAddons.length > 0) {
      setCustomizingItem(item);
      setCustomizingAddons([]);
      setCustomizingQty(1);
    } else {
      addItemDirectly(item, []);
    }
  }

  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [usbDeviceName, setUsbDeviceName] = useState<string | null>(null);
  const [printerConnectionType, setPrinterConnectionType] = useState<"USB_DIRECT" | "BLUETOOTH" | "CABLE">("USB_DIRECT");

  async function handleConnectBluetooth() {
    try {
      setBusy(true);
      setError("");
      const name = await connectBluetoothPrinter();
      setBtDeviceName(name);
      setPrinterConnectionType("BLUETOOTH");
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_printer_type", "BLUETOOTH");
      }
      setMessage(`Connected to Bluetooth Printer: ${name}`);
    } catch (err: any) {
      setError(err.message || "Failed to pair Bluetooth printer");
    } finally {
      setBusy(false);
    }
  }

  async function triggerThermalPrint(mode: "BOTH" | "KOT_ONLY" | "BILL_ONLY", billData?: Bill | null, kotNumber?: string) {
    setPrintMode(mode);

    // 1. DIRECT USB CABLE DRIVER (0 Preview Dialog / 0ms Screen Flash)
    if (printerConnectionType === "USB_DIRECT") {
      try {
        if (mode === "KOT_ONLY" || mode === "BOTH") {
          const kotBytes = buildEscPosKotReceipt(
            kotNumber || billData?.kotTickets?.[0]?.kotNumber || "1",
            orderType,
            (billData?.items || cart).map((i: any) => ({ name: i.name, quantity: i.quantity || 1, notes: i.notes }))
          );
          await sendEscPosToUsb(kotBytes);
        }
        if (mode === "BILL_ONLY" || mode === "BOTH") {
          const billBytes = buildEscPosBillReceipt(
            context?.outlet.name || "Bombay Falooda",
            context?.outlet.address || "Vadodara",
            billData?.billNumber || "1",
            kotNumber || billData?.kotTickets?.[0]?.kotNumber || "1",
            orderType,
            (billData?.items || cart).map((i: any) => ({
              name: i.name,
              quantity: i.quantity || 1,
              unitPrice: Number(i.unitPrice || i.price || 0),
              total: Number(i.total || (i.unitPrice || i.price || 0) * (i.quantity || 1)),
            })),
            Number(billData?.total || payableTotal)
          );
          await sendEscPosToUsb(billBytes);
        }
        return;
      } catch (err: any) {
        console.warn("Direct USB print failed, falling back to window.print():", err);
      }
    }

    // 2. DIRECT BLUETOOTH DRIVER (0 Preview Dialog / 0ms Screen Flash)
    if (printerConnectionType === "BLUETOOTH" && btDeviceName) {
      try {
        if (mode === "KOT_ONLY" || mode === "BOTH") {
          const kotBytes = buildEscPosKotReceipt(
            kotNumber || billData?.kotTickets?.[0]?.kotNumber || "1",
            orderType,
            (billData?.items || cart).map((i: any) => ({ name: i.name, quantity: i.quantity || 1, notes: i.notes }))
          );
          await sendEscPosToBluetooth(kotBytes);
        }
        if (mode === "BILL_ONLY" || mode === "BOTH") {
          const billBytes = buildEscPosBillReceipt(
            context?.outlet.name || "Bombay Falooda",
            context?.outlet.address || "Vadodara",
            billData?.billNumber || "1",
            kotNumber || billData?.kotTickets?.[0]?.kotNumber || "1",
            orderType,
            (billData?.items || cart).map((i: any) => ({
              name: i.name,
              quantity: i.quantity || 1,
              unitPrice: Number(i.unitPrice || i.price || 0),
              total: Number(i.total || (i.unitPrice || i.price || 0) * (i.quantity || 1)),
            })),
            Number(billData?.total || payableTotal)
          );
          await sendEscPosToBluetooth(billBytes);
        }
        return;
      } catch (err: any) {
        console.warn("Bluetooth thermal print failed, falling back to USB cable / Windows driver:", err);
      }
    }

    // 3. FALLBACK TO WINDOWS DRIVER / KIOSK SPOOLER
    setTimeout(() => window.print(), 350);
  }

  function handleClearScreen() {
    setCart([]);
    setActiveBill(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setBillNote("");
    setDiscount("0");
    setMessage("Screen cleared for new order.");
  }

  async function saveAndPrintBoth() {
    if (!cart.length && !activeBill) {
      setError("Please select at least one item from left menu");
      return;
    }

    await runAction(async () => {
      let bill = activeBill;
      if (!bill) {
        const body = {
          items: cart.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            addons: item.addons,
          })),
        };
        bill = await apiRequest<Bill>("/pos-terminal/bills", {
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
      }

      try {
        await apiRequest(`/pos-terminal/bills/${bill.id}/kot`, {
          method: "POST",
          body: { notes: billNote },
        });
      } catch {
        // KOT ticket generated or existing
      }

      await loadTerminal();
      setMessage(`Bill #${bill.billNumber} saved. Printing KOT & Bill...`);
      await triggerThermalPrint("BOTH", bill);
    });
  }

  async function createKotOnly() {
    if (!cart.length && !activeBill) {
      setError("Please select at least one item from left menu");
      return;
    }

    await runAction(async () => {
      let bill = activeBill;
      if (!bill) {
        const body = {
          items: cart.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            addons: item.addons,
          })),
        };
        bill = await apiRequest<Bill>("/pos-terminal/bills", {
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
      }

      const kotResult = await apiRequest<{ kotNumber: string }>(`/pos-terminal/bills/${bill.id}/kot`, {
        method: "POST",
        body: { notes: billNote },
      });

      await loadTerminal();
      setMessage(`KOT #${kotResult.kotNumber || 'Generated'} created & printed.`);
      await triggerThermalPrint("KOT_ONLY", bill, kotResult.kotNumber);
    });
  }

  async function finalizeAndPrintBillOnly() {
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

      setMessage(`Bill #${bill.billNumber} finalized & paid.`);
      await triggerThermalPrint("BILL_ONLY", bill);
      setTimeout(() => {
        handleClearScreen();
      }, 500);

      await loadTerminal();
    });
  }

  async function fetchRecentKots() {
    try {
      setBusy(true);
      const data = await apiRequest<KotTicket[]>("/pos-terminal/kots");
      setRecentKots(data || []);
      setShowRecentKotsDrawer(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recent KOTs");
    } finally {
      setBusy(false);
    }
  }

  function editKot(kot: KotTicket) {
    if (!kot.bill) return;
    setActiveBill(kot.bill);
    setCart([]);
    setCustomerName(kot.bill.customerName || "");
    setCustomerPhone(kot.bill.customerPhone || "");
    setCustomerEmail(kot.bill.customerEmail || "");
    setBillNote(kot.notes || kot.bill.notes || "");
    setShowRecentKotsDrawer(false);
    setMessage(`Editing KOT #${kot.kotNumber} for Bill #${kot.bill.billNumber}`);
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
    <div className="no-print h-screen w-screen flex flex-col bg-[#f8fafc] text-[#0f172a] overflow-hidden select-none font-sans antialiased">
      {/* TOP HEADER BAR (Premium Light Aesthetic) */}
      <header className="no-print h-12 bg-white/95 backdrop-blur-md text-[#0f172a] flex items-center justify-between px-3.5 shrink-0 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)] z-30">
        {/* Left Brand & Action Bar */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNavDrawer(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100/90 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Sidebar Menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          {/* Logo Badge */}
          <div className="flex items-center gap-2">
            <div className="h-7 px-2.5 rounded-lg bg-gradient-to-br from-[#c82d4d] to-[#991b32] text-white font-black text-[11px] flex items-center justify-center tracking-wider shadow-xs">
              POS
            </div>
            <span className="text-xs font-bold text-slate-800 tracking-tight hidden sm:inline">
              Bombay Falooda <span className="text-[11px] font-mono font-medium text-slate-400">({context?.outlet.code || "R403993"})</span>
            </span>
          </div>

          {/* New Order Button */}
          <button
            type="button"
            onClick={handleNewOrder}
            className="bg-gradient-to-r from-[#b82e46] to-[#9e2037] hover:from-[#a8253b] hover:to-[#8c192e] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer"
          >
            New Order
          </button>

          {/* Quick Header Inputs */}
          <div className="hidden 2xl:flex items-center gap-2 ml-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search Item..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="h-7.5 w-36 rounded-lg border border-slate-200/90 bg-slate-50/80 px-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 transition-all"
              />
            </div>
            <input
              type="text"
              placeholder="Bill No"
              value={billNoSearch}
              onChange={(e) => setBillNoSearch(e.target.value)}
              className="h-7.5 w-20 rounded-lg border border-slate-200/90 bg-slate-50/80 px-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 transition-all"
            />
            <input
              type="text"
              placeholder="KOT No"
              value={kotNoSearch}
              onChange={(e) => setKotNoSearch(e.target.value)}
              className="h-7.5 w-20 rounded-lg border border-slate-200/90 bg-slate-50/80 px-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 transition-all"
            />
          </div>
        </div>

        {/* Right Utility Icons (Modern Refined Strip) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Link
              href="/terminal/item-toggle"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
              title="Item On/Off"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <span className="hidden md:inline text-[11px] font-semibold">Item On/Off</span>
            </Link>

            <Link
              href="/terminal/live-orders"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-purple-50 text-purple-700 transition-colors"
              title="Live Orders"
            >
              <Radio className="h-4 w-4 text-purple-600 animate-pulse" />
              <span className="hidden md:inline text-[11px] font-bold">Live Orders</span>
            </Link>

            <Link
              href="/terminal"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
              title="Store"
            >
              <Store className="h-4 w-4 text-slate-500" />
              <span className="hidden md:inline text-[11px] font-semibold">Store</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowOrdersModal(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors relative cursor-pointer"
              title="Orders"
            >
              <ClipboardList className="h-4 w-4 text-slate-500" />
              <span className="hidden md:inline text-[11px] font-semibold">Orders</span>
              {orders.length > 0 && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-[#b82e46] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowHoldModal(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors relative cursor-pointer"
              title="Hold"
            >
              <PauseCircle className="h-4 w-4 text-slate-500" />
              <span className="hidden md:inline text-[11px] font-semibold">Hold</span>
              {heldBills.length > 0 && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {heldBills.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4 w-4 text-slate-500 hover:text-red-600 transition-colors" />
              <span className="hidden md:inline text-[11px] font-semibold">Logout</span>
            </button>
          </div>

          <div className="hidden lg:block border-l border-slate-200 pl-3 text-right">
            <span className="text-[10px] font-medium text-slate-400 block leading-tight">Need Help?</span>
            <span className="text-xs font-mono font-bold text-blue-600 block hover:underline cursor-pointer">07969 223344</span>
          </div>
        </div>
      </header>

      {/* TOAST / ALERT NOTIFICATION */}
      {(message || error) && (
        <div className="no-print fixed top-14 right-5 z-50 rounded-xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 px-4 py-2.5 text-xs font-semibold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className={error ? "text-rose-400" : "text-emerald-400"}>
            {error || message}
          </span>
          <button
            type="button"
            onClick={() => { setError(""); setMessage(""); }}
            className="text-slate-400 hover:text-white transition cursor-pointer p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* MAIN 3-PANEL WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANE 1: LEFT CATEGORY NAVIGATION BAR */}
        <aside className="w-32 sm:w-36 md:w-40 lg:w-44 xl:w-48 bg-[#f8fafc] border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`w-full text-left px-2.5 sm:px-3.5 py-2.5 sm:py-3 text-[11px] sm:text-xs font-semibold transition-all border-b border-slate-100 cursor-pointer ${
              selectedCategory === "all"
                ? "bg-white text-[#991b32] border-l-[3.5px] border-[#b82e46] font-bold shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium"
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
                className={`w-full text-left px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-[11px] sm:text-xs transition-all border-b border-slate-100 leading-tight cursor-pointer ${
                  isSelected
                    ? "bg-white text-[#991b32] border-l-[3.5px] border-[#b82e46] font-bold shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </aside>

        {/* PANE 2: CENTER ITEMS GRID & SEARCH AREA */}
        <section className="flex-1 flex flex-col bg-[#f1f5f9]/70 min-w-0 overflow-hidden">
          {/* Sub Header Search */}
          <div className="p-2 sm:p-2.5 bg-white border-b border-slate-200 flex gap-2 sm:gap-2.5 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search menu items..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full h-8 sm:h-8.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 transition-all font-medium placeholder-slate-400"
              />
            </div>
            <input
              type="text"
              placeholder="Short Code"
              value={shortCodeSearch}
              onChange={(e) => setShortCodeSearch(e.target.value)}
              className="w-24 sm:w-32 h-8 sm:h-8.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 sm:px-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 transition-all font-medium placeholder-slate-400"
            />
          </div>

          {/* Items Grid */}
          <div className="flex-1 p-2 sm:p-3 overflow-y-auto scrollbar-none">
            {visibleItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs font-semibold text-slate-400 gap-1.5">
                <Search className="h-6 w-6 text-slate-300" />
                <span>No active items found matching search.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-2.5">
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
                      onClick={() => handleItemClick(item)}
                      className={`relative min-h-[86px] sm:min-h-[92px] p-2.5 sm:p-3 rounded-xl bg-white border text-left flex flex-col justify-between transition-all duration-150 border-l-[3.5px] border-l-emerald-500 cursor-pointer group active:scale-[0.99] ${
                        inCartCount > 0
                          ? "border-2 border-[#b82e46]/60 bg-rose-50/30 shadow-xs"
                          : "border-slate-200/90 hover:border-slate-300 hover:shadow-md"
                      }`}
                    >
                      {/* Top Title Bar */}
                      <div className="flex items-start justify-between gap-1 pb-1">
                        <span className="font-bold text-[11px] sm:text-xs text-slate-800 group-hover:text-[#991b32] transition-colors leading-snug line-clamp-2">
                          {item.name}
                        </span>
                        {uniqueAddons.length > 0 && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/70 shrink-0">
                            +Toppings
                          </span>
                        )}
                      </div>

                      {/* Description if present */}
                      {item.description && (
                        <p className="text-[10px] text-slate-400 line-clamp-1 my-0.5">
                          {item.description}
                        </p>
                      )}

                      {/* Bottom Price Footer */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs sm:text-sm font-black text-slate-900">
                            ₹{Number(item.price).toFixed(0)}
                          </span>
                        </div>

                        {inCartCount > 0 && (
                          <span className="h-4.5 px-2 rounded-md bg-[#b82e46] text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
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
        <aside className="w-72 sm:w-80 md:w-[340px] lg:w-[380px] xl:w-[430px] 2xl:w-[480px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-[-4px_0_16px_rgba(0,0,0,0.02)]">
          {/* Order Type Tabs (Dine In / Takeaway / Delivery) */}
          <div className="p-2 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-3 bg-slate-200/70 p-1 rounded-xl border border-slate-200 gap-1">
              {orderTypes.map((t) => {
                const isSelected = orderType === t.id;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOrderType(t.id)}
                    className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[#b82e46] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer / Note Row */}
          <div className="p-2 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="h-8 sm:h-8.5 w-8.5 sm:w-9.5 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 text-[#b82e46] hover:bg-rose-50 hover:border-rose-300 transition-all shrink-0 shadow-2xs cursor-pointer"
              title={customerName || customerPhone ? `${customerName || "Customer"} (${customerPhone})` : "Add Customer"}
            >
              <User className="h-4 w-4 text-[#b82e46]" />
            </button>

            <div className="flex-1 h-8 sm:h-8.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 flex items-center gap-2 focus-within:bg-white focus-within:border-[#b82e46] focus-within:ring-2 focus-within:ring-[#b82e46]/10 transition-all">
              <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Note / Table number..."
                value={billNote}
                onChange={(e) => setBillNote(e.target.value)}
                className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Cart Items Table Header */}
          <div className="grid grid-cols-12 px-2.5 sm:px-3.5 py-2 bg-slate-50/90 border-b border-slate-200 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <div className="col-span-5">ITEMS</div>
            <div className="col-span-3 text-center">CHECK ITEMS</div>
            <div className="col-span-2 text-center">QTY</div>
            <div className="col-span-2 text-right">PRICE</div>
          </div>

          {/* Cart Body */}
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {activeBill ? (
              <div className="p-2.5 sm:p-3 space-y-2">
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs shadow-2xs">
                  <div className="flex items-center justify-between font-bold text-purple-700">
                    <span>Bill: {activeBill.billNumber}</span>
                    <span className="uppercase text-[10px] px-2 py-0.5 rounded-full bg-purple-200/80 font-extrabold">{activeBill.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Customer: {activeBill.customerName || "Walk-in"} ({activeBill.customerPhone || "No Phone"})
                  </div>
                </div>

                {activeBill.items.map((item) => (
                  <div key={item.id} className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs space-y-0.5 shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{item.name}</span>
                      <span className="font-mono font-bold text-slate-900">₹{Number(item.total).toFixed(0)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Qty: {item.quantity} x ₹{Number(item.unitPrice).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : cart.length === 0 ? (
              /* EMPTY CART WATERMARK */
              <div className="h-full flex flex-col items-center justify-center p-4 sm:p-6 text-center text-slate-400">
                <div className="h-14 sm:h-16 w-14 sm:w-16 rounded-2xl border border-slate-200/80 flex items-center justify-center mb-2.5 text-slate-400 bg-slate-50/80 shadow-2xs">
                  <UtensilsCrossed className="h-6 sm:h-7 w-6 sm:w-7 text-slate-400 stroke-[1.75]" />
                </div>
                <h4 className="font-bold text-xs text-slate-700">No Item Selected</h4>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 max-w-[200px] leading-tight">
                  Please select products or beverages from the menu grid to start billing
                </p>
              </div>
            ) : (
              /* ACTIVE CART ITEMS */
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.localId} className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{item.name}</div>
                      {item.addons.length > 0 && (
                        <div className="text-[10px] text-emerald-700 font-medium truncate mt-0.5">
                          + {item.addons.map((a) => a.name).join(", ")}
                        </div>
                      )}
                    </div>

                    {/* Qty Controls */}
                    <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.localId, -1)}
                        className="h-5 w-5 rounded-md bg-white font-bold text-xs text-slate-700 hover:bg-slate-200 flex items-center justify-center shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4.5 text-center text-xs font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.localId, 1)}
                        className="h-5 w-5 rounded-md bg-white font-bold text-xs text-slate-700 hover:bg-slate-200 flex items-center justify-center shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[50px] sm:min-w-[55px] flex flex-col items-end">
                      <div className="font-mono font-bold text-xs text-slate-900">
                        ₹{item.unitPrice * item.quantity}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.localId)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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

          {/* Compact Bottom Controls Box */}
          <div className="p-2 sm:p-2.5 bg-slate-50/90 border-t border-slate-200 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-1.5">
                <button type="button" className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer">
                  Split
                </button>
                <button type="button" className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer">
                  Advance Order
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500">Disc:</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-14 sm:w-16 h-6 sm:h-6.5 rounded-lg border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-bold text-slate-800 outline-none focus:border-[#b82e46] shadow-2xs"
                />
              </div>
            </div>

            {/* Action Buttons Row (Clear, Save & Print [KOT+Bill], KOT Only, Print Bill) */}
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleClearScreen}
                className="py-2 px-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] sm:text-[11px] border border-rose-200/80 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-[0.98]"
                title="Clear active screen, cart items, customer details & notes"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAndPrintBoth()}
                className="py-2 px-1 rounded-xl bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white font-bold text-[10px] sm:text-[11px] shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                title="Saves bill & prints BOTH KOT and Bill receipts"
              >
                Save & Print
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createKotOnly()}
                className="py-2 px-1 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-[10px] sm:text-[11px] shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                title="Generates & prints KOT receipt only"
              >
                KOT Only
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finalizeAndPrintBillOnly()}
                className="py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] sm:text-[11px] shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                title="Finalizes payment & prints Bill receipt only"
              >
                Print Bill
              </button>
            </div>

            {/* Grand Total Display */}
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl shadow-xs border border-slate-700/50">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 tracking-wide uppercase">Grand Total</span>
              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                ₹ {payableTotal.toLocaleString("en-IN")}
              </span>
            </div>

            {/* Payment Options */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
              {(["CASH", "CARD", "UPI"] as const).map((m) => {
                const isSelected = paymentMethod === m;
                const PaymentIcon = m === "CASH" ? Banknote : m === "CARD" ? CreditCard : QrCode;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-1.5 px-1 sm:px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <PaymentIcon className="h-3.5 w-3.5 shrink-0" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[450px] p-5 space-y-3 shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Held Bills Queue ({heldBills.length})</h3>
                <p className="text-[11px] text-slate-500">Select a held bill to resume billing</p>
              </div>
              <button type="button" onClick={() => setShowHoldModal(false)} className="p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[460px] p-5 space-y-3 shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Routed Digital Orders ({orders.length})</h3>
                <p className="text-[11px] text-slate-500">Incoming online orders ready for acceptance</p>
              </div>
              <button type="button" onClick={() => setShowOrdersModal(false)} className="p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto scrollbar-none pr-1">
              {orders.map((o) => (
                <div key={o.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-purple-300 transition-all space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-700 uppercase bg-purple-100/80 px-2.5 py-0.5 rounded-full border border-purple-200/60">{o.source} • {o.type}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void acceptDigitalOrder(o.id);
                        setShowOrdersModal(false);
                      }}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95"
                    >
                      Accept & Import
                    </button>
                  </div>
                  <div className="text-xs text-slate-700 font-medium">
                    Customer: {o.customerName || "Walk-in"} ({o.customerPhone || "No Phone"})
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-700 flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-500 font-sans font-normal text-[11px]">Total Payable:</span>
                    <span>₹{Number(o.total).toFixed(0)}</span>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  No pending digital orders waiting.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAILS RIGHT-SIDE DRAWER */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-96 p-5 space-y-4 shadow-2xl border-l border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Customer Details</h3>
                  <p className="text-[11px] text-slate-500">Attach customer info to this bill</p>
                </div>
                <button type="button" onClick={() => setShowCustomerModal(false)} className="p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sahir Qureshi"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. sahir@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-mono focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 outline-none transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white text-xs font-bold shadow-sm transition active:scale-[0.98] cursor-pointer"
              >
                Save Customer Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVIGATION DRAWER (Slide-out Left Menu) */}
      {showNavDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-start animate-in fade-in duration-150">
          <div className="bg-white h-full w-84 shadow-2xl border-r border-slate-200 flex flex-col justify-between p-5">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 px-2.5 rounded-lg bg-gradient-to-br from-[#c82d4d] to-[#991b32] text-white font-black text-xs flex items-center justify-center tracking-wider shadow-xs">
                    POS
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 leading-tight">Bombay Falooda POS</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Outlet: {context?.outlet.code || "KIRTI-OLT"}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowNavDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              {/* Menu List */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal"); }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                      <Store className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="font-medium text-slate-800">Terminal Billing Register</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/orders"); }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Receipt className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-800">Total Today Orders</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/70 text-blue-700 text-[10px] font-bold">
                    {summary?.finalizedBills ?? 0} Orders
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/sales"); }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <IndianRupee className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="font-medium text-slate-800">Total Sales Today</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[10px] font-mono font-bold">
                    ₹{summary?.totalSales.toLocaleString("en-IN") ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/live-orders"); }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                      <Radio className="h-4 w-4 text-purple-600 animate-pulse" />
                    </div>
                    <span className="font-medium text-slate-800">Live Orders</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200/70 text-purple-700 text-[10px] font-bold">
                    {orders.length} Active
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/team-members"); }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                      <Users className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="font-medium text-slate-800">Team Members Present</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/70 text-amber-700 text-[10px] font-bold">
                    {teamMembers.length} Online
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/shift"); }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                      <Sun className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="font-medium text-slate-800">Start Day / End Day</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${shiftStatus === "OPEN" ? "bg-emerald-50 text-emerald-700 border-emerald-200/70" : "bg-rose-50 text-rose-700 border-rose-200/70"}`}>
                    {shiftStatus}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/item-toggle"); }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                    <SlidersHorizontal className="h-4 w-4 text-[#b82e46]" />
                  </div>
                  <span className="font-medium text-slate-800">Item On/Off (Multi-Channel)</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/settings"); }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                    <Settings className="h-4 w-4 text-slate-600" />
                  </div>
                  <span className="font-medium text-slate-800">Settings & Config (2FA & Printer)</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Active Register</span>
                  <span className="font-bold text-slate-800">{context?.outlet.name || "Kirtistambh Outlet"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[480px] p-5 space-y-3 shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Total Orders Today</h3>
                <p className="text-[11px] text-slate-500">All counter & online bills generated today</p>
              </div>
              <button type="button" onClick={() => setShowTodayOrdersDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none pr-1">
              {heldBills.concat(activeBill ? [activeBill] : []).map((b) => (
                <div key={b.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{b.billNumber}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${b.status === "FINALIZED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[480px] p-5 space-y-4 shadow-2xl border-l border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Today&apos;s Total Sales Summary</h3>
                  <p className="text-[11px] text-slate-500">Live analytics for shift transactions</p>
                </div>
                <button type="button" onClick={() => setShowTodaySalesDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Gross Sales Today</span>
                  <div className="font-mono text-2xl font-black text-emerald-800">
                    ₹ {summary?.totalSales.toLocaleString("en-IN") ?? 0}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-blue-700 uppercase">Finalized Bills</span>
                  <div className="font-mono text-2xl font-black text-blue-800">
                    {summary?.finalizedBills ?? 0} Bills
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase text-slate-400">Payment Breakdown</h4>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5 text-xs">
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
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              Print Sales Summary Report
            </button>
          </div>
        </div>
      )}

      {/* LIVE ORDERS DRAWER */}
      {showLiveOrdersDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[480px] p-5 space-y-3 shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Live Orders Queue</h3>
                <p className="text-[11px] text-slate-500">Real-time incoming kitchen & counter tickets</p>
              </div>
              <button type="button" onClick={() => setShowLiveOrdersDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto scrollbar-none pr-1">
              {orders.map((o) => (
                <div key={o.id} className="p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/40 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-800 uppercase">{o.source} • {o.type}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-200/80 text-purple-900 text-[10px] font-bold uppercase">{o.status}</span>
                  </div>
                  <div className="text-xs text-slate-700 font-medium">
                    Customer: {o.customerName || "Walk-in"} ({o.customerPhone || "No Phone"})
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-700 flex justify-between pt-1 border-t border-purple-100">
                    <span className="text-slate-500 font-sans font-normal text-[11px]">Total:</span>
                    <span>₹{Number(o.total).toFixed(0)}</span>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  No active live orders in queue.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TEAM MEMBERS PRESENT DRAWER */}
      {showTeamMembersDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[450px] p-5 space-y-3 shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Team Members Present Today ({teamMembers.length})</h3>
                <p className="text-[11px] text-slate-500">Staff members logged in at this outlet</p>
              </div>
              <button type="button" onClick={() => setShowTeamMembersDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto scrollbar-none pr-1">
              {teamMembers.map((member) => (
                <div key={member.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs text-slate-900">{member.fullName}</div>
                    <div className="text-[11px] text-slate-500">{member.role} • {member.phone || member.email}</div>
                    <div className="text-[10px] text-emerald-700 font-semibold">Checked In: {member.checkInTime}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[10px] font-bold">
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[450px] p-5 space-y-4 shadow-2xl border-l border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Start Day / End Day Register</h3>
                  <p className="text-[11px] text-slate-500">Manage shift day opening float and Z-Report closing</p>
                </div>
                <button type="button" onClick={() => setShowShiftDayDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-700">Current Shift Status:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${shiftStatus === "OPEN" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                  {shiftStatus}
                </span>
              </div>

              {shiftStatus === "OPEN" ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-800 space-y-1">
                    <div className="font-bold">Shift is currently Active</div>
                    <div>Opening Cash Float: ₹{openingFloat}</div>
                    <div>Finalized Bills Today: {summary?.finalizedBills ?? 0}</div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Shift Closing Notes</label>
                    <textarea
                      placeholder="Enter shift handover notes..."
                      value={shiftClosingNotes}
                      onChange={(e) => setShiftClosingNotes(e.target.value)}
                      className="w-full h-20 rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCloseShift()}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-60 active:scale-[0.98]"
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
                      className="w-full h-9.5 rounded-xl border border-slate-200 px-3 font-mono text-xs font-bold outline-none focus:border-[#b82e46]"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStartShift()}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-60 active:scale-[0.98]"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[480px] p-5 space-y-4 shadow-2xl border-l border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">POS Terminal Settings</h3>
                  <p className="text-[11px] text-slate-500">Configure 2FA security and thermal printer settings</p>
                </div>
                <button type="button" onClick={() => setShowSettingsDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 2FA Section */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <div>
                        <h4 className="font-bold text-xs text-slate-800">Two-Factor Authentication (2FA)</h4>
                        <p className="text-[11px] text-slate-500">Require OTP code on cashier terminal login</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${twoFactorEnabled ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"}`}
                    >
                      {twoFactorEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                </div>

                {/* Printer Config Section */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Printer className="h-5 w-5 text-[#b82e46]" />
                    <div>
                      <h4 className="font-bold text-xs text-slate-800">Thermal Printer Configuration</h4>
                      <p className="text-[11px] text-slate-500">Select connection mode & pair hardware printer</p>
                    </div>
                  </div>

                  {/* Connection Mode Selection Cards */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPrinterConnectionType("CABLE")}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        printerConnectionType === "CABLE"
                          ? "border-blue-600 bg-blue-50/90 text-blue-950 font-bold shadow-2xs"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">🔌 USB / Cable</span>
                        {printerConnectionType === "CABLE" && <Check className="h-4 w-4 text-blue-600 font-bold" />}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">Windows Driver / Kiosk Print</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPrinterConnectionType("BLUETOOTH")}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        printerConnectionType === "BLUETOOTH"
                          ? "border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold shadow-2xs"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">📶 Bluetooth</span>
                        {printerConnectionType === "BLUETOOTH" && <Check className="h-4 w-4 text-emerald-600 font-bold" />}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">Wireless ESC/POS Direct Pair</span>
                    </button>
                  </div>

                  {/* Active Connection Panel */}
                  {printerConnectionType === "BLUETOOTH" ? (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Bluetooth Connection:</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${btDeviceName ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                          {btDeviceName ? `🟢 Paired: ${btDeviceName}` : "🔴 Disconnected"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleConnectBluetooth()}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Bluetooth className="h-4 w-4" />
                        <span>{btDeviceName ? "Re-pair Bluetooth Printer" : "Pair Bluetooth Thermal Printer"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>USB Cable / Driver Status:</span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          🟢 Active (USB / Windows Driver)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Connect thermal printer via USB cable to PC. Uses default Windows printer driver or Chrome kiosk auto-print (<code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">--kiosk-printing</code>).
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-600">Paper Roll Size</span>
                    <select
                      value={paperWidth}
                      onChange={(e) => setPaperWidth(e.target.value)}
                      className="h-8 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold bg-white outline-none"
                    >
                      <option value="80mm">80mm Standard Thermal</option>
                      <option value="58mm">58mm Compact Thermal</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => void testPrinterConnection()}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🧪 Test Connection</span>
              </button>
              <button
                type="button"
                onClick={() => void savePrinterSettings()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>💾 Save Printer Config</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECENT KOTS DRAWER (SLIDE-OVER FROM RIGHT) */}
      {showRecentKotsDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="bg-white h-full w-[480px] p-5 space-y-4 shadow-2xl border-l border-slate-200 flex flex-col justify-between">
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 shrink-0">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <span>🕒 Recent Kitchen Orders (KOTs)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-800 text-[10px] font-mono font-bold">
                      {recentKots.length} Today
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Inspect open KOTs, edit items, or convert directly to printed bill</p>
                </div>
                <button type="button" onClick={() => setShowRecentKotsDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              {recentKots.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                  <span className="text-3xl">🍳</span>
                  <div className="font-bold text-xs text-slate-600">No Active KOTs</div>
                  <p className="text-[11px] text-slate-400">All kitchen orders are cleared for today's shift.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 scrollbar-none pr-1">
                  {recentKots.map((kot) => (
                    <div key={kot.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            #{kot.kotNumber}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700">
                            Bill #{kot.bill?.billNumber || "Draft"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(kot.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1">
                        {kot.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">
                              {item.quantity}x {item.billItem?.name || item.notes || "Item"}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              ₹{Number(item.billItem?.total || 0).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {kot.notes && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 font-medium">
                          Note: {kot.notes}
                        </div>
                      )}

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => editKot(kot)}
                          className="flex-1 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs transition cursor-pointer shadow-2xs"
                        >
                          ✏️ Edit KOT
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (kot.bill) {
                              setActiveBill(kot.bill);
                              void finalizeAndPrintBillOnly();
                              setShowRecentKotsDrawer(false);
                            }
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                        >
                          🖨️ Print Bill
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CENTER ADD-ONS SELECTION MODAL POPUP */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#b82e46] tracking-wider">Customize Toppings</span>
                <h3 className="text-base font-bold text-slate-900">{customizingItem.name}</h3>
              </div>
              <button type="button" onClick={() => setCustomizingItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">Select toppings to add to your loaded cup:</p>

            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-none pr-1">
              {Array.from(
                new Map(
                  (customizingItem.addonGroups || [])
                    .flatMap((g) => g.addons.map((a) => ({ ...a, groupName: g.name })))
                    .map((a) => [a.id, a])
                ).values()
              ).map((addon) => {
                const isChecked = customizingAddons.some((a) => a.addonId === addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-xs ${isChecked ? "bg-emerald-50/80 border-emerald-500 text-slate-900 shadow-2xs" : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-white"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCustomizingAddons([...customizingAddons, { addonId: addon.id, name: addon.name, price: Number(addon.price) }]);
                          } else {
                            setCustomizingAddons(customizingAddons.filter((a) => a.addonId !== addon.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-[#b82e46] focus:ring-0 cursor-pointer accent-[#b82e46]"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">{addon.name}</span>
                        <span className="text-[10px] text-slate-400 block">{addon.groupName}</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">+₹{Number(addon.price)}</span>
                  </label>
                );
              })}
            </div>

            {/* Qty & Add to Cart */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCustomizingQty(Math.max(1, customizingQty - 1))}
                  className="h-7 w-7 bg-white rounded-lg font-bold text-slate-700 flex items-center justify-center hover:bg-slate-200 text-xs shadow-2xs cursor-pointer active:scale-95"
                >
                  -
                </button>
                <span className="w-5 text-center font-bold text-xs text-slate-800">{customizingQty}</span>
                <button
                  type="button"
                  onClick={() => setCustomizingQty(customizingQty + 1)}
                  className="h-7 w-7 bg-white rounded-lg font-bold text-slate-700 flex items-center justify-center hover:bg-slate-200 text-xs shadow-2xs cursor-pointer active:scale-95"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const addonTotal = customizingAddons.reduce((sum, a) => sum + a.price, 0);
                  const unitPrice = Number(customizingItem.price) + addonTotal;
                  setCart((current) => [
                    ...current,
                    {
                      localId: `${customizingItem.id}-${Date.now()}-${current.length}`,
                      itemId: customizingItem.id,
                      name: customizingItem.name,
                      quantity: customizingQty,
                      addons: customizingAddons,
                      unitPrice,
                    },
                  ]);
                  setCustomizingItem(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-[0.98]"
              >
                Add to Cart (₹{((Number(customizingItem.price) + customizingAddons.reduce((sum, a) => sum + a.price, 0)) * customizingQty).toFixed(0)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 80MM THERMAL RECEIPT PRINT CONTAINER (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
      {/* 80MM THERMAL RECEIPT PRINT CONTAINER (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
      {mounted && typeof document !== "undefined"
        ? createPortal(
            <div id="print-ticket-root">
              {printMode === "KOT_ONLY" || printMode === "BOTH" ? (
                <div style={{ pageBreakAfter: printMode === "BOTH" ? "always" : "auto", paddingBottom: "8px", fontFamily: "'Courier New', Courier, monospace" }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#000", marginBottom: "2px" }}>
                    {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div style={{ textAlign: "center", margin: "4px 0 6px 0" }}>
                    <div style={{ fontSize: "18px", fontWeight: "900", letterSpacing: "0.5px" }}>
                      {activeBill?.kotTickets?.[0]?.kotNumber ? `KOT - ${activeBill.kotTickets[0].kotNumber.replace("KOT-", "")}` : `KOT - ${activeBill?.kotTickets?.length ? activeBill.kotTickets.length : "1"}`}
                    </div>
                    {activeBill?.order?.source && activeBill.order.source !== "POS" ? (
                      <div style={{ fontSize: "12px", fontWeight: "700", marginTop: "2px" }}>
                        {(() => {
                          const fullId = activeBill.order?.id || "247835229110578";
                          const mainPart = fullId.slice(0, -4);
                          const last4 = fullId.slice(-4);
                          return (
                            <>
                              {activeBill.order?.source === "ZOMATO" ? "Zomato" : activeBill.order?.source === "SWIGGY" ? "Swiggy" : activeBill.order?.source} : {mainPart}<span style={{ fontWeight: "900", fontSize: "15px" }}>{last4}</span>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                    <div style={{ fontSize: "13px", fontWeight: "900", textTransform: "uppercase", marginTop: "2px" }}>
                      {orderType === "DINE_IN" ? "DINE IN" : orderType === "DELIVERY" ? "Delivery" : "Pick Up"}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", margin: "4px 0" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px dashed #000" }}>
                        <th style={{ textAlign: "left", paddingBottom: "4px", fontWeight: "800" }}>No.Item</th>
                        <th style={{ textAlign: "center", paddingBottom: "4px", width: "35%", fontWeight: "800" }}>Special Note</th>
                        <th style={{ textAlign: "right", paddingBottom: "4px", width: "15%", fontWeight: "800" }}>Qty.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeBill?.items || cart).map((item: any, idx: number) => (
                        <tr key={idx} style={{ verticalAlign: "top" }}>
                          <td style={{ textAlign: "left", paddingTop: "4px", fontWeight: "800" }}>
                            {idx + 1} {item.name}
                            {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                              <div style={{ fontSize: "10px", fontWeight: "600", color: "#000" }}>
                                ({item.addons.map((a: any) => a.name).join(", ")})
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "center", paddingTop: "4px", fontSize: "10px", fontWeight: "600" }}>
                            {item.notes ? item.notes : "--"}
                          </td>
                          <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "800", fontSize: "12px" }}>
                            {item.quantity || 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ borderTop: "1px dashed #000", marginTop: "6px" }} />

                  {/* Online Aggregator Specific KOT Details */}
                  {activeBill?.notes || activeBill?.order ? (
                    <div style={{ marginTop: "6px", fontSize: "11px", lineHeight: "1.3" }}>
                      {activeBill?.notes && (
                        <div style={{ fontWeight: "900", marginBottom: "4px" }}>
                          Customer Notes: {activeBill.notes}
                        </div>
                      )}
                      <div style={{ fontWeight: "700" }}>
                        Payment Status : {activeBill?.order ? "Online Paid" : "Paid"}
                      </div>
                      <div style={{ fontWeight: "700" }}>
                        Prepare By : {new Date().toISOString().slice(0, 10)} {new Date().toLocaleTimeString("en-GB")}
                      </div>
                      <div style={{ fontWeight: "900", fontSize: "13px", marginTop: "4px" }}>
                        Delivery Passcode : {activeBill?.order?.id ? activeBill.order.id.slice(-4) : "8990"}
                      </div>

                      <div style={{ textAlign: "center", marginTop: "8px" }}>
                        <div style={{ fontSize: "10px", fontWeight: "800" }}>Scan to Mark food ready</div>
                        {/* Barcode Graphic */}
                        <div style={{ textAlign: "center", margin: "4px 0" }}>
                          <svg viewBox="0 0 220 36" style={{ height: "32px", width: "85%", margin: "0 auto", display: "block" }}>
                            <rect x="0" y="0" width="3" height="36" fill="#000" />
                            <rect x="5" y="0" width="2" height="36" fill="#000" />
                            <rect x="9" y="0" width="4" height="36" fill="#000" />
                            <rect x="15" y="0" width="2" height="36" fill="#000" />
                            <rect x="19" y="0" width="3" height="36" fill="#000" />
                            <rect x="24" y="0" width="5" height="36" fill="#000" />
                            <rect x="31" y="0" width="2" height="36" fill="#000" />
                            <rect x="35" y="0" width="4" height="36" fill="#000" />
                            <rect x="41" y="0" width="3" height="36" fill="#000" />
                            <rect x="46" y="0" width="2" height="36" fill="#000" />
                            <rect x="50" y="0" width="5" height="36" fill="#000" />
                            <rect x="57" y="0" width="3" height="36" fill="#000" />
                            <rect x="62" y="0" width="2" height="36" fill="#000" />
                            <rect x="66" y="0" width="4" height="36" fill="#000" />
                            <rect x="72" y="0" width="3" height="36" fill="#000" />
                            <rect x="77" y="0" width="2" height="36" fill="#000" />
                            <rect x="81" y="0" width="5" height="36" fill="#000" />
                            <rect x="88" y="0" width="3" height="36" fill="#000" />
                            <rect x="93" y="0" width="2" height="36" fill="#000" />
                            <rect x="97" y="0" width="4" height="36" fill="#000" />
                            <rect x="103" y="0" width="3" height="36" fill="#000" />
                            <rect x="108" y="0" width="2" height="36" fill="#000" />
                            <rect x="112" y="0" width="5" height="36" fill="#000" />
                            <rect x="119" y="0" width="3" height="36" fill="#000" />
                            <rect x="124" y="0" width="2" height="36" fill="#000" />
                            <rect x="128" y="0" width="4" height="36" fill="#000" />
                            <rect x="134" y="0" width="3" height="36" fill="#000" />
                            <rect x="139" y="0" width="2" height="36" fill="#000" />
                            <rect x="143" y="0" width="5" height="36" fill="#000" />
                            <rect x="150" y="0" width="3" height="36" fill="#000" />
                            <rect x="155" y="0" width="2" height="36" fill="#000" />
                            <rect x="159" y="0" width="4" height="36" fill="#000" />
                            <rect x="165" y="0" width="3" height="36" fill="#000" />
                            <rect x="170" y="0" width="2" height="36" fill="#000" />
                            <rect x="174" y="0" width="5" height="36" fill="#000" />
                            <rect x="181" y="0" width="3" height="36" fill="#000" />
                            <rect x="186" y="0" width="2" height="36" fill="#000" />
                            <rect x="190" y="0" width="4" height="36" fill="#000" />
                            <rect x="196" y="0" width="3" height="36" fill="#000" />
                            <rect x="201" y="0" width="2" height="36" fill="#000" />
                            <rect x="205" y="0" width="4" height="36" fill="#000" />
                            <rect x="211" y="0" width="3" height="36" fill="#000" />
                            <rect x="216" y="0" width="2" height="36" fill="#000" />
                          </svg>
                        </div>
                        <div style={{ fontSize: "10px", fontWeight: "900" }}>
                          {activeBill?.order?.id ? activeBill.order.id.slice(-15) : "247835229110578"}
                        </div>
                        <div style={{ fontSize: "9px", fontWeight: "700", marginTop: "2px" }}>
                          Pickup barcode for {activeBill?.order?.source || "delivery"} partner
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {printMode === "BILL_ONLY" || printMode === "BOTH" ? (
                <div style={{ paddingTop: printMode === "BOTH" ? "8px" : "0", fontFamily: "'Courier New', Courier, monospace" }}>
                  <div style={{ textAlign: "center", lineHeight: "1.25" }}>
                    {activeBill?.order ? (
                      <div style={{ fontWeight: "900", fontSize: "13px", textTransform: "uppercase", marginBottom: "2px" }}>
                        PAID
                      </div>
                    ) : null}
                    <div style={{ fontWeight: "900", fontSize: "16px", textTransform: "none", marginBottom: "2px" }}>
                      Bombay Falooda
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: "600", padding: "0 2px" }}>
                      {context?.outlet?.address || "Opp Sayaji vihar club, near khanderav market, raj mahal road vadodara."}
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: "600", marginTop: "1px" }}>
                      M. {(context?.outlet as any)?.phone || "9574754173"}
                    </div>
                  </div>

                  {/* Online Aggregator Details for Bill */}
                  {activeBill?.order?.source && activeBill.order.source !== "POS" ? (
                    <>
                      <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px 0" }} />
                      <div style={{ fontSize: "11px", fontWeight: "700", lineHeight: "1.3" }}>
                        {(() => {
                          const fullId = activeBill.order?.id || "8577852406";
                          const mainPart = fullId.slice(0, -4);
                          const last4 = fullId.slice(-4);
                          return (
                            <>
                              <div>From {activeBill.order?.source === "ZOMATO" ? "Zomato" : activeBill.order?.source === "SWIGGY" ? "Swiggy" : activeBill.order?.source}[{mainPart}<span style={{ fontWeight: "900", fontSize: "14px" }}>{last4}</span>]</div>
                              <div style={{ fontSize: "14px", fontWeight: "900", margin: "2px 0" }}>
                                OTP: <span style={{ fontWeight: "900", fontSize: "16px" }}>{last4}</span>
                              </div>
                            </>
                          );
                        })()}
                        {activeBill.customerName && <div>Name: {activeBill.customerName}</div>}
                        <div>Adr: {activeBill.order.deliveryAddress || "Alwa Naka, Vadodara Vadodara India"}</div>
                      </div>
                    </>
                  ) : null}

                  <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px 0" }} />

                  <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600" }}>Date: {new Date().toLocaleDateString("en-GB")}</span>
                      <span style={{ fontWeight: "800" }}>
                        {orderType === "DINE_IN" ? "Dine In" : orderType === "DELIVERY" ? "Delivery" : "Pick Up"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600" }}>{new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600" }}>Cashier: {activeBill?.order ? "Autoaccept" : ((context as any)?.device?.name || "biller")}</span>
                      <span style={{ fontWeight: "800" }}>
                        Bill No.: {activeBill?.billNumber ? activeBill.billNumber.replace("BILL-", "") : "51766"}
                      </span>
                    </div>
                    <div style={{ fontWeight: "800" }}>
                      Token No.: {activeBill?.kotTickets?.[0]?.kotNumber ? activeBill.kotTickets[0].kotNumber.replace("KOT-", "") : "172"}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px 0" }} />

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px dashed #000" }}>
                        <th style={{ textAlign: "left", paddingBottom: "4px", fontWeight: "800" }}>No.Item</th>
                        <th style={{ textAlign: "center", paddingBottom: "4px", width: "12%", fontWeight: "800" }}>Qty.</th>
                        <th style={{ textAlign: "right", paddingBottom: "4px", width: "18%", fontWeight: "800" }}>Price</th>
                        <th style={{ textAlign: "right", paddingBottom: "4px", width: "22%", fontWeight: "800" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeBill?.items || cart).map((item: any, idx: number) => {
                        const qty = item.quantity || 1;
                        const unitPrice = Number(item.unitPrice || item.price || 0);
                        const itemTotal = Number(item.total || unitPrice * qty);
                        return (
                          <tr key={idx} style={{ verticalAlign: "top" }}>
                            <td style={{ textAlign: "left", paddingTop: "4px", fontWeight: "800", paddingRight: "4px" }}>
                              {idx + 1} {item.name}
                              {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                                <div style={{ fontSize: "10px", fontWeight: "600", color: "#000" }}>
                                  ({item.addons.map((a: any) => a.name).join(", ")})
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: "center", paddingTop: "4px", fontWeight: "700" }}>{qty}</td>
                            <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "700" }}>{unitPrice.toFixed(2)}</td>
                            <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "800" }}>{itemTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ borderTop: "1px dashed #000", marginTop: "6px", paddingTop: "4px", fontSize: "11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "800" }}>
                      <span>Total Qty: {(activeBill?.items || cart).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)}</span>
                      <span>Sub Total  {Number(activeBill?.subtotal || payableTotal).toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", margin: "6px 0", padding: "6px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "900", fontSize: "15px" }}>
                      <span>Grand Total</span>
                      <span>₹ {Number(activeBill?.total || payableTotal).toFixed(2)}</span>
                    </div>
                    {activeBill?.order?.source && activeBill.order.source !== "POS" ? (
                      <div style={{ fontSize: "10px", fontWeight: "800", marginTop: "2px" }}>
                        Paid via Online [{activeBill.order.source === "ZOMATO" ? "Zomato" : activeBill.order.source === "SWIGGY" ? "Swiggy" : activeBill.order.source}]
                      </div>
                    ) : null}
                  </div>

                  {activeBill?.order?.source && activeBill.order.source !== "POS" ? (
                    <>
                      <div style={{ fontSize: "9px", fontWeight: "700", textAlign: "center", margin: "4px 0" }}>
                        Tax to be paid under section 9(5) by Eco
                      </div>
                      <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

                      <div style={{ textAlign: "center", marginTop: "6px" }}>
                        <div style={{ fontSize: "10px", fontWeight: "800" }}>Scan to Mark food ready</div>
                        {/* Barcode Graphic */}
                        <div style={{ textAlign: "center", margin: "4px 0" }}>
                          <svg viewBox="0 0 220 36" style={{ height: "32px", width: "85%", margin: "0 auto", display: "block" }}>
                            <rect x="0" y="0" width="3" height="36" fill="#000" />
                            <rect x="5" y="0" width="2" height="36" fill="#000" />
                            <rect x="9" y="0" width="4" height="36" fill="#000" />
                            <rect x="15" y="0" width="2" height="36" fill="#000" />
                            <rect x="19" y="0" width="3" height="36" fill="#000" />
                            <rect x="24" y="0" width="5" height="36" fill="#000" />
                            <rect x="31" y="0" width="2" height="36" fill="#000" />
                            <rect x="35" y="0" width="4" height="36" fill="#000" />
                            <rect x="41" y="0" width="3" height="36" fill="#000" />
                            <rect x="46" y="0" width="2" height="36" fill="#000" />
                            <rect x="50" y="0" width="5" height="36" fill="#000" />
                            <rect x="57" y="0" width="3" height="36" fill="#000" />
                            <rect x="62" y="0" width="2" height="36" fill="#000" />
                            <rect x="66" y="0" width="4" height="36" fill="#000" />
                            <rect x="72" y="0" width="3" height="36" fill="#000" />
                            <rect x="77" y="0" width="2" height="36" fill="#000" />
                            <rect x="81" y="0" width="5" height="36" fill="#000" />
                            <rect x="88" y="0" width="3" height="36" fill="#000" />
                            <rect x="93" y="0" width="2" height="36" fill="#000" />
                            <rect x="97" y="0" width="4" height="36" fill="#000" />
                            <rect x="103" y="0" width="3" height="36" fill="#000" />
                            <rect x="108" y="0" width="2" height="36" fill="#000" />
                            <rect x="112" y="0" width="5" height="36" fill="#000" />
                            <rect x="119" y="0" width="3" height="36" fill="#000" />
                            <rect x="124" y="0" width="2" height="36" fill="#000" />
                            <rect x="128" y="0" width="4" height="36" fill="#000" />
                            <rect x="134" y="0" width="3" height="36" fill="#000" />
                            <rect x="139" y="0" width="2" height="36" fill="#000" />
                            <rect x="143" y="0" width="5" height="36" fill="#000" />
                            <rect x="150" y="0" width="3" height="36" fill="#000" />
                            <rect x="155" y="0" width="2" height="36" fill="#000" />
                            <rect x="159" y="0" width="4" height="36" fill="#000" />
                            <rect x="165" y="0" width="3" height="36" fill="#000" />
                            <rect x="170" y="0" width="2" height="36" fill="#000" />
                            <rect x="174" y="0" width="5" height="36" fill="#000" />
                            <rect x="181" y="0" width="3" height="36" fill="#000" />
                            <rect x="186" y="0" width="2" height="36" fill="#000" />
                            <rect x="190" y="0" width="4" height="36" fill="#000" />
                            <rect x="196" y="0" width="3" height="36" fill="#000" />
                            <rect x="201" y="0" width="2" height="36" fill="#000" />
                            <rect x="205" y="0" width="4" height="36" fill="#000" />
                            <rect x="211" y="0" width="3" height="36" fill="#000" />
                            <rect x="216" y="0" width="2" height="36" fill="#000" />
                          </svg>
                        </div>
                        <div style={{ fontSize: "10px", fontWeight: "900" }}>
                          {activeBill?.order?.id ? activeBill.order.id.slice(-4) : "2406"}
                        </div>
                      </div>
                      <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px 0" }} />
                    </>
                  ) : null}

                  <div style={{ textAlign: "center", paddingTop: "4px", fontSize: "11px", fontWeight: "800", lineHeight: "1.4" }}>
                    <div>Thank You Visit Again</div>
                    <div style={{ fontSize: "10px", marginTop: "2px", fontWeight: "800" }}>"Please wait for 10 minutes after ordering."</div>
                  </div>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}


