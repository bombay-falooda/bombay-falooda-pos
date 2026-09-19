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

  // Delivery Flow State
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPaymentType, setDeliveryPaymentType] = useState<"COD" | "PAID">("COD");
  const [selectedDriver, setSelectedDriver] = useState<{ id: string; name: string; phone: string }>({
    id: "tm-1",
    name: "Sahir Qureshi",
    phone: "9876543210",
  });
  const [useCustomDriver, setUseCustomDriver] = useState(false);
  const [customDriverName, setCustomDriverName] = useState("");
  const [customDriverPhone, setCustomDriverPhone] = useState("");
  const [showDeliveryAssignModal, setShowDeliveryAssignModal] = useState(false);
  const [showDeliveryLinksModal, setShowDeliveryLinksModal] = useState(false);
  const [pendingPrintMode, setPendingPrintMode] = useState<"BOTH" | "BILL_ONLY">("BOTH");
  const [dispatchedDeliveryData, setDispatchedDeliveryData] = useState<{
    orderId: string;
    billNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    driverName: string;
    driverPhone: string;
    paymentType: "COD" | "PAID";
    total: number;
    customerTrackingUrl: string;
    driverNavUrl: string;
  } | null>(null);
  const [copiedLinkType, setCopiedLinkType] = useState<"CUSTOMER" | "DRIVER" | null>(null);

  // Recent KOTs & Center Addons Modal State
  const [showRecentKotsDrawer, setShowRecentKotsDrawer] = useState(false);
  const [recentKots, setRecentKots] = useState<KotTicket[]>([]);
  const [allTodayBills, setAllTodayBills] = useState<Bill[]>([]);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedPortion, setSelectedPortion] = useState<{ addonId: string; name: string; price: number; groupName?: string } | null>(null);
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
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [desktopPrinters, setDesktopPrinters] = useState<Array<{ name: string; isDefault?: boolean }>>([]);

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

      // Detect Electron Desktop App Native Printers
      const electron = (window as any).electronAPI;
      if (electron && typeof electron.getPrinters === "function") {
        setIsDesktopApp(true);
        electron.getPrinters().then((printers: any[]) => {
          if (Array.isArray(printers) && printers.length > 0) {
            setDesktopPrinters(printers);
            if (!savedName) {
              const defaultP = printers.find((p) => p.isDefault) || printers[0];
              if (defaultP) setPrinterName(defaultP.name);
            }
          }
        }).catch(() => {});
      }
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
      const [menu, held, digitalOrders, shift, dayStatus, kotsList, allBillsList] = await Promise.all([
        apiRequest<MenuCategory[]>("/pos-terminal/menu"),
        apiRequest<Bill[]>("/pos-terminal/bills/held"),
        apiRequest<DigitalOrder[]>("/pos-terminal/orders"),
        apiRequest<ShiftSummary>("/pos-terminal/shift-summary"),
        apiRequest<{ active: boolean; businessDay: any }>("/pos-terminal/day/current").catch(() => ({ active: false, businessDay: null })),
        apiRequest<KotTicket[]>("/pos-terminal/kots").catch(() => []),
        apiRequest<Bill[]>("/pos-terminal/bills").catch(() => []),
      ]);
      setCategories(menu);
      setHeldBills(held || []);
      setOrders(digitalOrders || []);
      setSummary(shift);
      setRecentKots(kotsList || []);
      setAllTodayBills(allBillsList || []);
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
  const activeTotal = cartSubtotal;
  const payableTotal = Math.max(activeTotal - Number(discount || 0), 0);

  const todayFinalizedBills = useMemo(() => {
    return allTodayBills.filter((b) => b.status === "FINALIZED");
  }, [allTodayBills]);

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
    setCustomizingItem(item);
    setCustomizingQty(1);

    // Look for portion / size / style addon group
    const portionGroup = item.addonGroups?.find((g) => {
      const gn = g.name.toLowerCase();
      return gn.includes("size") || gn.includes("portion") || gn.includes("pack") || gn.includes("style") || gn.includes("type") || gn.includes("falooda");
    });

    if (portionGroup && portionGroup.addons.length > 0) {
      const firstPortion = portionGroup.addons[0];
      setSelectedPortion({
        addonId: firstPortion.id,
        name: firstPortion.name,
        price: Number(firstPortion.price),
        groupName: portionGroup.name,
      });
    } else {
      setSelectedPortion(null);
    }

    setCustomizingAddons([]);
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

  function formatCustomizedItemName(
    baseName: string,
    portionOption?: { addonId?: string; name: string; price?: number; groupName?: string } | null
  ): string {
    if (!portionOption || !portionOption.name) {
      return baseName.trim();
    }

    const portionName = portionOption.name.trim();
    const cleanBase = baseName.trim();

    // If portion is simple size like "Half", "Full", "(Half)", "Small", "300 ML", etc.
    if (
      /^(half|full|small|medium|large|regular|1 scoop|2 scoops|\d+\s*ml|\d+\s*gm)/i.test(portionName) ||
      portionName.startsWith("(") ||
      (!portionName.toLowerCase().includes("falooda") &&
        !portionName.toLowerCase().includes("rabdi") &&
        !portionName.toLowerCase().includes("ice cream") &&
        !portionName.toLowerCase().includes("kulfi") &&
        !portionName.toLowerCase().includes("shake"))
    ) {
      if (portionName.startsWith("(") && portionName.endsWith(")")) {
        return `${cleanBase} ${portionName}`;
      }
      return `${cleanBase} (${portionName})`;
    }

    // Common category words like "falooda", "rabdi", "ice cream"
    const catKeywords = ["falooda", "rabdi", "ice cream", "icecream", "shake", "kulfi", "mastani"];
    const matchingCat = catKeywords.find(
      (k) => cleanBase.toLowerCase().includes(k) && portionName.toLowerCase().includes(k)
    );

    if (matchingCat) {
      const flavor = cleanBase.replace(new RegExp(matchingCat, "gi"), "").trim();
      if (flavor && !portionName.toLowerCase().includes(flavor.toLowerCase())) {
        return `${flavor} ${portionName}`.trim();
      }
      return portionName;
    }

    return `${cleanBase} (${portionName})`;
  }

  async function handleHoldOrder() {
    if (!cart.length) {
      handleClearScreen();
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
      await apiRequest<Bill>("/pos-terminal/bills", {
        method: "POST",
        body: {
          ...body,
          type: orderType,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
          notes: billNote,
          notePrintEnabled: true,
          status: "HELD",
        },
      });
      await loadTerminal();
      handleClearScreen();
    });
  }

  function getWhatsAppCustomerUrl(phone: string, name: string, trackingUrl: string) {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `🍨 Hello ${name || "Customer"}!\n\nYour Bombay Falooda order is confirmed & on the way!\n\nTrack your order live here:\n${trackingUrl}\n\nThank you for ordering with Bombay Falooda!`
    );
    return `https://wa.me/${formattedPhone}?text=${msg}`;
  }

  function getWhatsAppDriverUrl(
    driverPhone: string,
    driverName: string,
    custName: string,
    custPhone: string,
    address: string,
    payType: "COD" | "PAID",
    amount: number,
    navUrl: string
  ) {
    const cleanPhone = driverPhone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const payMsg = payType === "PAID" ? "✅ ALREADY PAID (DO NOT COLLECT)" : `💵 CASH ON DELIVERY - COLLECT ₹${amount}`;
    const msg = encodeURIComponent(
      `🛵 *Bombay Falooda Delivery Assignment*\n\nHi ${driverName}, new delivery assigned to you!\n\n👤 *Customer:* ${custName} (${custPhone})\n📍 *Address:* ${address}\n💰 *Payment:* ${payMsg}\n\n🗺️ *Start GPS Navigation & Update Status:*\n${navUrl}`
    );
    return `https://wa.me/${formattedPhone}?text=${msg}`;
  }

  async function triggerThermalPrint(
    mode: "BOTH" | "KOT_ONLY" | "BILL_ONLY",
    billData?: Bill | null,
    kotNumber?: string,
    deliveryAddr?: string,
    driverName?: string,
    deliveryPayType?: "COD" | "PAID"
  ) {
    setPrintMode(mode);

    const electron = typeof window !== "undefined" ? (window as any).electronAPI : null;
    let targetPrinter = (typeof window !== "undefined" ? localStorage.getItem("pos_printer_name") : "") || "POS-80";
    if (targetPrinter === "Thermal Receipt Printer (80mm)") {
      targetPrinter = "POS-80";
    }

    // Build binary ESC/POS buffers
    let kotBytes: Uint8Array | null = null;
    let billBytes: Uint8Array | null = null;

    if (mode === "KOT_ONLY" || mode === "BOTH") {
      kotBytes = buildEscPosKotReceipt(
        kotNumber || billData?.kotTickets?.[0]?.kotNumber || "1",
        orderType,
        (billData?.items || cart).map((i: any) => ({
          name: i.name || i.item?.name || "Item",
          quantity: i.quantity || 1,
          notes: i.notes,
          addons: Array.isArray(i.addons) ? i.addons.map((a: any) => ({ name: a.name || a.addon?.name || a, price: Number(a.price || 0) })) : [],
        })),
        customerName || billData?.customerName || undefined,
        customerPhone || billData?.customerPhone || undefined,
        billNote || billData?.notes || undefined,
        customerEmail || billData?.customerEmail || undefined
      );
    }

    if (mode === "BILL_ONLY" || mode === "BOTH") {
      billBytes = buildEscPosBillReceipt(
        context?.outlet.name || "Bombay Falooda",
        context?.outlet.address || "Opp Sayaji vihar club , near khanderav market , raj mahal road vadodara.",
        billData?.billNumber || "1",
        kotNumber || billData?.kotTickets?.[0]?.kotNumber || "1",
        orderType,
        (billData?.items || cart).map((i: any) => ({
          name: i.name || i.item?.name || "Item",
          quantity: i.quantity || 1,
          unitPrice: Number(i.unitPrice || i.price || 0),
          total: Number(i.total || (i.unitPrice || i.price || 0) * (i.quantity || 1)),
          notes: i.notes,
          addons: Array.isArray(i.addons) ? i.addons.map((a: any) => ({ name: a.name || a.addon?.name || a, price: Number(a.price || 0) })) : [],
        })),
        Number(billData?.total || payableTotal),
        (context?.outlet as any)?.phone || "9574754173",
        (context as any)?.user?.name || (context as any)?.billerName || "biller",
        customerName || billData?.customerName || undefined,
        customerPhone || billData?.customerPhone || undefined,
        Number(discount || billData?.discount || 0),
        customerEmail || billData?.customerEmail || undefined,
        billNote || billData?.notes || undefined,
        deliveryAddr || deliveryAddress || undefined,
        driverName || undefined,
        deliveryPayType || (orderType === "DELIVERY" ? deliveryPaymentType : undefined)
      );
    }

    // 1. ELECTRON DESKTOP APP NATIVE WIN32 RAW ESC/POS PRINT (0ms / Zero Dialog / 100% Reliable)
    if (electron && typeof electron.printRawEscPos === "function") {
      try {
        if (kotBytes) {
          await electron.printRawEscPos(kotBytes, targetPrinter);
        }
        if (billBytes) {
          await electron.printRawEscPos(billBytes, targetPrinter);
        }
        return;
      } catch (err) {
        console.warn("Electron native raw print error:", err);
      }
    }

    // 2. DIRECT USB CABLE DRIVER (0 Preview Dialog / 0ms Screen Flash)
    if (printerConnectionType === "USB_DIRECT") {
      try {
        if (kotBytes) await sendEscPosToUsb(kotBytes);
        if (billBytes) await sendEscPosToUsb(billBytes);
        return;
      } catch (err: any) {
        console.warn("Direct USB print failed, falling back:", err);
      }
    }

    // 3. DIRECT BLUETOOTH DRIVER (0 Preview Dialog / 0ms Screen Flash)
    if (printerConnectionType === "BLUETOOTH" && btDeviceName) {
      try {
        if (kotBytes) await sendEscPosToBluetooth(kotBytes);
        if (billBytes) await sendEscPosToBluetooth(billBytes);
        return;
      } catch (err: any) {
        console.warn("Bluetooth thermal print failed, falling back:", err);
      }
    }

    // 4. FALLBACK TO BROWSER / KIOSK PRINT
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
    setDeliveryAddress("");
    setCustomDriverName("");
    setCustomDriverPhone("");
    setUseCustomDriver(false);
    setDeliveryPaymentType("COD");
    setMessage("Screen cleared for new order.");
  }

  async function saveAndPrintBoth() {
    if (!cart.length && !activeBill) {
      setError("Please select at least one item from left menu");
      return;
    }

    if (orderType === "DELIVERY" && !showDeliveryAssignModal) {
      setPendingPrintMode("BOTH");
      setShowDeliveryAssignModal(true);
      return;
    }

    await executeFinalizeAndPrint("BOTH");
  }

  async function finalizeAndPrintBillOnly() {
    if (!cart.length && !activeBill) {
      setError("Please select at least one item from left menu");
      return;
    }

    if (orderType === "DELIVERY" && !showDeliveryAssignModal) {
      setPendingPrintMode("BILL_ONLY");
      setShowDeliveryAssignModal(true);
      return;
    }

    await executeFinalizeAndPrint("BILL_ONLY");
  }

  async function executeFinalizeAndPrint(mode: "BOTH" | "BILL_ONLY") {
    await runAction(async () => {
      const hasKotAlready = Boolean(activeBill?.kotTickets && activeBill.kotTickets.length > 0);

      const assignedDriverName = useCustomDriver
        ? (customDriverName.trim() || "Delivery Rider")
        : (selectedDriver?.name || "Sahir Qureshi");
      const assignedDriverPhone = useCustomDriver
        ? (customDriverPhone.trim() || "9876543210")
        : (selectedDriver?.phone || "9876543210");

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
            customerEmail: customerEmail || undefined,
            notes: orderType === "DELIVERY" && deliveryAddress ? `[Delivery: ${deliveryAddress}] ${billNote}` : billNote,
            notePrintEnabled: true,
          },
        });
      } else {
        // Update items if cart was modified
        const body = {
          items: cart.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            addons: item.addons,
          })),
        };
        bill = await apiRequest<Bill>(`/pos-terminal/bills/${bill.id}/items`, {
          method: "PATCH",
          body,
        });
      }

      let kotNum = bill.kotTickets?.[0]?.kotNumber;

      // If KOT was not printed yet, generate KOT
      if (!hasKotAlready && mode === "BOTH") {
        try {
          const kotResult = await apiRequest<{ kotNumber: string }>(`/pos-terminal/bills/${bill.id}/kot`, {
            method: "POST",
            body: { notes: billNote },
          });
          if (kotResult?.kotNumber) {
            kotNum = kotResult.kotNumber;
          }
        } catch {
          // KOT ticket generated or existing
        }
      }

      // Finalize and generate Bill
      const chosenPaymentMethod = orderType === "DELIVERY" && deliveryPaymentType === "COD" ? "CASH" : paymentMethod;
      const finalizedBill = await apiRequest<Bill>(`/pos-terminal/bills/${bill.id}/finalize`, {
        method: "PATCH",
        body: {
          discount: Number(discount || 0),
          payments: [{ method: chosenPaymentMethod, amount: payableTotal }],
        },
      });

      // If KOT was already printed previously, only print Bill receipt!
      const actualPrintMode = hasKotAlready && mode === "BOTH" ? "BILL_ONLY" : mode;
      await triggerThermalPrint(
        actualPrintMode,
        finalizedBill,
        kotNum,
        deliveryAddress,
        assignedDriverName,
        deliveryPaymentType
      );

      await loadTerminal();

      if (orderType === "DELIVERY") {
        setDispatchedDeliveryData({
          orderId: finalizedBill.id,
          billNumber: finalizedBill.billNumber,
          customerName: customerName || "Customer",
          customerPhone: customerPhone || "",
          deliveryAddress: deliveryAddress || "Outlet Delivery Area",
          driverName: assignedDriverName,
          driverPhone: assignedDriverPhone,
          paymentType: deliveryPaymentType,
          total: payableTotal,
          customerTrackingUrl: `http://localhost:3003/track/${finalizedBill.id}`,
          driverNavUrl: `http://localhost:3003/delivery-nav/${finalizedBill.id}`,
        });
        setShowDeliveryAssignModal(false);
        setShowDeliveryLinksModal(true);
      } else {
        handleClearScreen();
      }
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
            customerEmail: customerEmail || undefined,
            notes: orderType === "DELIVERY" && deliveryAddress ? `[Delivery: ${deliveryAddress}] ${billNote}` : billNote,
            notePrintEnabled: true,
          },
        });
      } else {
        const body = {
          items: cart.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            addons: item.addons,
          })),
        };
        bill = await apiRequest<Bill>(`/pos-terminal/bills/${bill.id}/items`, {
          method: "PATCH",
          body,
        });
      }

      const kotResult = await apiRequest<{ kotNumber: string }>(`/pos-terminal/bills/${bill.id}/kot`, {
        method: "POST",
        body: { notes: billNote },
      });

      await triggerThermalPrint("KOT_ONLY", bill, kotResult.kotNumber);
      await loadTerminal();
      handleClearScreen();
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

  function loadKotIntoRegister(kot: KotTicket) {
    if (!kot.bill) return;
    setActiveBill(kot.bill);
    setCart(
      (kot.bill.items || []).map((it: any, idx: number) => ({
        localId: `${it.id || idx}-${Date.now()}`,
        itemId: it.itemId || it.id,
        name: it.name,
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || (Number(it.total) / (Number(it.quantity) || 1))),
        addons: Array.isArray(it.addons)
          ? it.addons.map((a: any) => ({ addonId: a.addonId || a.id, name: a.name, price: Number(a.price || 0) }))
          : [],
      }))
    );
    setCustomerName(kot.bill.customerName || "");
    setCustomerPhone(kot.bill.customerPhone || "");
    setCustomerEmail(kot.bill.customerEmail || "");
    setBillNote(kot.notes || kot.bill.notes || "");
    setDiscount(String(kot.bill.discount || 0));
    setShowRecentKotsDrawer(false);
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
        await triggerThermalPrint("KOT_ONLY", activeBill);
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
        await triggerThermalPrint("BILL_ONLY", bill);
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

            {/* KOTs Navbar Button */}
            <button
              type="button"
              onClick={() => void fetchRecentKots()}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors relative cursor-pointer"
              title="Today's Kitchen Orders (KOTs)"
            >
              <Receipt className="h-4 w-4 text-blue-600" />
              <span className="hidden md:inline text-[11px] font-semibold">KOTs</span>
              {recentKots.length > 0 && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {recentKots.length}
                </span>
              )}
            </button>

            {/* Today's Bills / Orders Button */}
            <button
              type="button"
              onClick={() => setShowTodayOrdersDrawer(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors relative cursor-pointer"
              title="Today's Orders & Bills"
            >
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              <span className="hidden md:inline text-[11px] font-semibold">Orders</span>
              {(summary?.finalizedBills ?? 0) > 0 && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {summary?.finalizedBills}
                </span>
              )}
            </button>

            {/* Hold Button in Navbar */}
            <button
              type="button"
              onClick={() => setShowHoldModal(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-amber-50 text-amber-800 transition-colors relative cursor-pointer"
              title="Held Bills Queue"
            >
              <PauseCircle className="h-4 w-4 text-amber-600" />
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
                      className={`relative min-h-[72px] sm:min-h-[78px] p-2.5 sm:p-3 rounded-xl bg-white border text-left flex flex-col justify-between transition-all duration-150 border-l-[3.5px] border-l-emerald-500 cursor-pointer group active:scale-[0.99] ${
                        inCartCount > 0
                          ? "border-2 border-[#b82e46]/60 bg-rose-50/30 shadow-xs"
                          : "border-slate-200/90 hover:border-slate-300 hover:shadow-md"
                      }`}
                    >
                      {/* Top Title Bar - Full name wrapping without truncation */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-[11.5px] sm:text-xs text-slate-900 group-hover:text-[#991b32] transition-colors leading-snug break-words">
                            {item.name}
                          </span>
                          {uniqueAddons.length > 0 && (
                            <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/70 shrink-0 self-start">
                              +Toppings
                            </span>
                          )}
                        </div>

                        {/* Description if present */}
                        {item.description && (
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* In-cart counter badge if item added */}
                      {inCartCount > 0 && (
                        <div className="flex justify-end pt-1">
                          <span className="h-4.5 px-2 rounded-md bg-[#b82e46] text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                            x{inCartCount}
                          </span>
                        </div>
                      )}
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

          {/* Quick Delivery Address Bar when Delivery tab active */}
          {orderType === "DELIVERY" && (
            <div className="p-2 border-b border-amber-200/80 bg-amber-50/50 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                <Bike className="h-3.5 w-3.5 text-amber-700" />
              </div>
              <input
                type="text"
                placeholder="Delivery Address / Landmark / Maps link..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="flex-1 h-7.5 rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
              />
            </div>
          )}

          {/* Cart Items Table Header */}
          <div className="grid grid-cols-12 px-2.5 sm:px-3.5 py-2 bg-slate-50/90 border-b border-slate-200 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <div className="col-span-5">ITEMS</div>
            <div className="col-span-3 text-center">CHECK ITEMS</div>
            <div className="col-span-2 text-center">QTY</div>
            <div className="col-span-2 text-right">PRICE</div>
          </div>

          {/* Cart Body */}
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {cart.length === 0 ? (
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

            {/* Action Buttons Row (Hold, Save & Print [KOT+Bill], KOT Only, Print Bill) */}
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5 pt-0.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleHoldOrder()}
                className="py-2 px-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] sm:text-[11px] border border-amber-200/80 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-[0.98]"
                title="Hold active bill and save to queue"
              >
                Hold
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
                <h3 className="font-bold text-sm text-slate-800">Held Orders Queue ({heldBills.length})</h3>
                <p className="text-[11px] text-slate-500">Select a held order to resume billing in register</p>
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
                    setCart(
                      b.items.map((it: any, idx: number) => ({
                        localId: `${it.id || idx}-${Date.now()}`,
                        itemId: it.itemId || it.id,
                        name: it.name,
                        quantity: Number(it.quantity || 1),
                        unitPrice: Number(it.unitPrice || (Number(it.total) / (Number(it.quantity) || 1))),
                        addons: Array.isArray(it.addons)
                          ? it.addons.map((a: any) => ({ addonId: a.addonId || a.id, name: a.name, price: Number(a.price || 0) }))
                          : [],
                      }))
                    );
                    setCustomerName(b.customerName || "");
                    setCustomerPhone(b.customerPhone || "");
                    setCustomerEmail(b.customerEmail || "");
                    setBillNote(b.notes || "");
                    setDiscount(String(b.discount || 0));
                    setShowHoldModal(false);
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-amber-500 bg-amber-50/40 hover:bg-white cursor-pointer transition-all shadow-2xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                        {b.kotTickets?.[0]?.kotNumber ? `#${b.kotTickets[0].kotNumber}` : `Token #${b.id.slice(-4).toUpperCase()}`}
                      </span>
                      <span className="text-[10px] text-amber-700 uppercase font-bold">HELD</span>
                    </div>
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
                  No held orders in queue.
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

      {/* ASSIGN DELIVERY & PAYMENT MODAL */}
      {showDeliveryAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[94vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-amber-500/20">
                  🛵
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white leading-tight">Assign Delivery Partner & Payment</h3>
                  <p className="text-[11px] text-slate-400">Order #{activeBill?.billNumber || "New"} • {cart.length} items</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeliveryAssignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 scrollbar-none">
              {/* Grand Total Strip */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Total Order Payable</span>
                <span className="font-mono text-xl font-black text-emerald-700">₹{payableTotal.toLocaleString("en-IN")}</span>
              </div>

              {/* Payment Mode Selector: COD vs PAID */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  1. Payment Collection Mode
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setDeliveryPaymentType("COD")}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      deliveryPaymentType === "COD"
                        ? "border-amber-500 bg-amber-50/80 shadow-xs ring-2 ring-amber-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                        💵 Cash On Delivery (COD)
                      </span>
                      {deliveryPaymentType === "COD" && <Check className="h-4 w-4 text-amber-600 stroke-[3]" />}
                    </div>
                    <p className="text-[10.5px] text-amber-800/90 font-medium leading-tight">
                      Rider collects <strong className="font-mono font-bold">₹{payableTotal}</strong> at customer doorstep
                    </p>
                  </div>

                  <div
                    onClick={() => setDeliveryPaymentType("PAID")}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      deliveryPaymentType === "PAID"
                        ? "border-emerald-500 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs text-emerald-950 flex items-center gap-1.5">
                        ✅ Already Paid (Prepaid)
                      </span>
                      {deliveryPaymentType === "PAID" && <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />}
                    </div>
                    <p className="text-[10.5px] text-emerald-800/90 font-medium leading-tight">
                      Paid via UPI/Card/Counter. Zero cash to collect.
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Address & Landmark Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  2. Delivery Address / Landmark / Google Maps Link
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Flat 402, Royal Residency, Near D-Mart, Varachha Road (or paste Google Maps link)"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#b82e46] focus:ring-2 focus:ring-[#b82e46]/10 transition"
                />
                <p className="text-[10.5px] text-slate-500">
                  📍 Tip: Paste full text address or customer WhatsApp Google Maps share link for turn-by-turn navigation.
                </p>
              </div>

              {/* Customer Contact Inputs */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-[#b82e46]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Customer Phone (WhatsApp)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 text-xs font-mono text-slate-900 outline-none focus:bg-white focus:border-[#b82e46]"
                  />
                </div>
              </div>

              {/* Select Present Delivery Member */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    3. Select Delivery Rider / Member
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomDriver(!useCustomDriver)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    {useCustomDriver ? "← Select From Present Staff" : "+ External / Custom Rider"}
                  </button>
                </div>

                {!useCustomDriver ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {teamMembers.map((member) => {
                      const isSelected = selectedDriver?.id === member.id;
                      return (
                        <div
                          key={member.id}
                          onClick={() => setSelectedDriver({ id: member.id, name: member.fullName, phone: member.phone || "9876543210" })}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/90 shadow-2xs ring-2 ring-blue-600/20"
                              : "border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate">{member.fullName}</div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">{member.phone || "No phone"}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[9px] shrink-0">
                            PRESENT
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Rider Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Rider"
                        value={customDriverName}
                        onChange={(e) => setCustomDriverName(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-[#b82e46]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Rider Phone</label>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={customDriverPhone}
                        onChange={(e) => setCustomDriverPhone(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-mono text-slate-900 outline-none focus:border-[#b82e46]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowDeliveryAssignModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executeFinalizeAndPrint(pendingPrintMode)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <span>🚀 Dispatch Delivery & Print Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY DISPATCHED SUCCESS & 2-LINKS SHARE MODAL */}
      {showDeliveryLinksModal && dispatchedDeliveryData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[94vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Top Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-white text-emerald-700 font-black text-base flex items-center justify-center shadow-md">
                  ✓
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white leading-tight">Delivery Order Dispatched!</h3>
                  <p className="text-[11px] text-emerald-100 font-mono">Bill #{dispatchedDeliveryData.billNumber.replace("BILL-", "")} • Total: ₹{dispatchedDeliveryData.total}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeliveryLinksModal(false);
                  handleClearScreen();
                }}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-none text-slate-800">
              {/* Info summary */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-600">Assigned Rider:</span>
                  <span className="text-slate-900">{dispatchedDeliveryData.driverName} ({dispatchedDeliveryData.driverPhone})</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-600">Payment Status:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${dispatchedDeliveryData.paymentType === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {dispatchedDeliveryData.paymentType === "PAID" ? "PREPAID (ALREADY PAID)" : `COD (COLLECT ₹${dispatchedDeliveryData.total})`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80 truncate">
                  📍 {dispatchedDeliveryData.deliveryAddress}
                </div>
              </div>

              {/* 1. CUSTOMER TRACKING LINK */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-blue-900 flex items-center gap-1.5">
                    👤 1. Customer Live Tracking Link
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                    Customer Status Portal
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Customer can see live preparation timeline, driver details, and delivery progress.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={dispatchedDeliveryData.customerTrackingUrl}
                    className="flex-1 h-8 bg-white border border-blue-200 rounded-lg px-2.5 font-mono text-xs text-slate-700 outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(dispatchedDeliveryData.customerTrackingUrl);
                      setCopiedLinkType("CUSTOMER");
                      setTimeout(() => setCopiedLinkType(null), 2500);
                    }}
                    className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs shrink-0"
                  >
                    {copiedLinkType === "CUSTOMER" ? "Copied! ✓" : "Copy Link 📋"}
                  </button>
                </div>
                {dispatchedDeliveryData.customerPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      const url = getWhatsAppCustomerUrl(
                        dispatchedDeliveryData.customerPhone,
                        dispatchedDeliveryData.customerName,
                        dispatchedDeliveryData.customerTrackingUrl
                      );
                      window.open(url, "_blank");
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
                  >
                    <span>💬 Send Tracking Link to Customer on WhatsApp ↗</span>
                  </button>
                )}
              </div>

              {/* 2. DELIVERY GUY / RIDER LINK */}
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                    🛵 2. Delivery Guy Navigation & Portal Link
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                    Rider Navigation
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Rider gets 1-tap Google Maps GPS turn-by-turn navigation, customer call button, and delivery status buttons.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={dispatchedDeliveryData.driverNavUrl}
                    className="flex-1 h-8 bg-white border border-amber-200 rounded-lg px-2.5 font-mono text-xs text-slate-700 outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(dispatchedDeliveryData.driverNavUrl);
                      setCopiedLinkType("DRIVER");
                      setTimeout(() => setCopiedLinkType(null), 2500);
                    }}
                    className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs shrink-0"
                  >
                    {copiedLinkType === "DRIVER" ? "Copied! ✓" : "Copy Link 📋"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = getWhatsAppDriverUrl(
                      dispatchedDeliveryData.driverPhone,
                      dispatchedDeliveryData.driverName,
                      dispatchedDeliveryData.customerName,
                      dispatchedDeliveryData.customerPhone,
                      dispatchedDeliveryData.deliveryAddress,
                      dispatchedDeliveryData.paymentType,
                      dispatchedDeliveryData.total,
                      dispatchedDeliveryData.driverNavUrl
                    );
                    window.open(url, "_blank");
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-[#25D366] hover:bg-[#1eb857] text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <span>💬 Send Assignment & GPS Route to Rider on WhatsApp ↗</span>
                </button>
              </div>
            </div>

            {/* Bottom Done Action */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowDeliveryLinksModal(false);
                  handleClearScreen();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition active:scale-[0.98] cursor-pointer"
              >
                ✓ Done & Start Next Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVIGATION DRAWER (Slide-out Left Menu) */}
      {showNavDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-start animate-in fade-in duration-150">
          <div className="bg-white h-full w-76 sm:w-80 shadow-2xl border-r border-slate-200 flex flex-col justify-between p-4">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-7 px-2 rounded-md bg-gradient-to-br from-[#c82d4d] to-[#991b32] text-white font-black text-[10px] flex items-center justify-center tracking-wider shadow-2xs">
                    POS
                  </div>
                  <div>
                    <h3 className="font-bold text-[11px] text-slate-900 leading-tight">Bombay Falooda POS</h3>
                    <p className="text-[9px] text-slate-400 font-mono">Outlet: {context?.outlet.code || "KIRTI-OLT"}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowNavDrawer(false)} className="p-1 rounded-md hover:bg-slate-100 transition cursor-pointer">
                  <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              {/* Menu List */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal"); }}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                      <Store className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <span className="font-medium text-slate-800">Terminal Billing Register</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/orders"); }}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Receipt className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-800">Total Today Orders</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/70 text-blue-700 text-[9px] font-bold">
                    {summary?.finalizedBills ?? 0} Orders
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/sales"); }}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="font-medium text-slate-800">Total Sales Today</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[9px] font-mono font-bold">
                    ₹{summary?.totalSales.toLocaleString("en-IN") ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/live-orders"); }}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-purple-50 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                      <Radio className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
                    </div>
                    <span className="font-medium text-slate-800">Live Orders</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200/70 text-purple-700 text-[9px] font-bold">
                    {orders.length} Active
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/team-members"); }}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                      <Users className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <span className="font-medium text-slate-800">Team Members Present</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/70 text-amber-700 text-[9px] font-bold">
                    {teamMembers.length} Online
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/shift"); }}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-orange-50 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                      <Sun className="h-3.5 w-3.5 text-orange-500" />
                    </div>
                    <span className="font-medium text-slate-800">Start Day / End Day</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${shiftStatus === "OPEN" ? "bg-emerald-50 text-emerald-700 border-emerald-200/70" : "bg-rose-50 text-rose-700 border-rose-200/70"}`}>
                    {shiftStatus}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/item-toggle"); }}
                  className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="h-7 w-7 rounded-md bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-[#b82e46]" />
                  </div>
                  <span className="font-medium text-slate-800">Item On/Off (Multi-Channel)</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowNavDrawer(false); router.push("/terminal/settings"); }}
                  className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-all cursor-pointer group"
                >
                  <div className="h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                    <Settings className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <span className="font-medium text-slate-800">Settings & Config (2FA & Printer)</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 block font-medium">Active Register</span>
                  <span className="font-bold text-[11px] text-slate-800">{context?.outlet.name || "Kirtistambh Outlet"}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full py-2 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
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
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span>Today's Finalized Orders</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
                    {todayFinalizedBills.length} Bills
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">All finalized bills generated today (Bill-wise read only)</p>
              </div>
              <button type="button" onClick={() => setShowTodayOrdersDrawer(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto scrollbar-none pr-1">
              {todayFinalizedBills.map((b) => (
                <div key={b.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      Bill #{b.billNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      PAID
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex justify-between">
                    <span>Customer: {b.customerName || "Walk-in"} {b.customerPhone ? `(${b.customerPhone})` : ""}</span>
                    <span className="font-mono font-bold text-emerald-700">₹{Number(b.total).toFixed(0)}</span>
                  </div>
                  {b.items && b.items.length > 0 && (
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 space-y-0.5">
                      {b.items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>{it.quantity}x {it.name}</span>
                          <span className="font-mono">₹{Number(it.total || (Number(it.unitPrice || 0) * Number(it.quantity || 1))).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {b.notes && (
                    <div className="text-[10px] text-amber-700 bg-amber-50/80 px-2 py-1 rounded border border-amber-200">
                      Note: {b.notes}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-200">
                    <span>Type: {b.orderType}</span>
                    <span>{new Date(b.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
              {todayFinalizedBills.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  No finalized bills generated today yet.
                </div>
              )}
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
                    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>USB Cable / Desktop Driver:</span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {isDesktopApp ? "⚡ Desktop Native (.exe)" : "🟢 Active (USB / Driver)"}
                        </span>
                      </div>

                      {desktopPrinters.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          <label className="text-[11px] font-bold text-slate-600 block">
                            Select Installed Hardware Printer:
                          </label>
                          <select
                            value={printerName}
                            onChange={(e) => setPrinterName(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-300 px-2 text-xs font-semibold bg-white outline-none cursor-pointer"
                          >
                            {desktopPrinters.map((p) => (
                              <option key={p.name} value={p.name}>
                                🖨️ {p.name} {p.isDefault ? "(Windows Default)" : ""}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Orders and receipts will print 100% silently to this thermal printer with zero dialogs.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Connect thermal printer via USB cable. Automatically uses your configured printer or Windows default.
                        </p>
                      )}
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
                  <p className="text-[11px] text-slate-500">Click any KOT to load into register and bill</p>
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
                    <div
                      key={kot.id}
                      onClick={() => loadKotIntoRegister(kot)}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#b82e46] hover:shadow-md cursor-pointer transition-all space-y-2.5 shadow-2xs group"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            #{kot.kotNumber}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {kot.bill?.orderType || "Takeaway"}
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

                      <div className="text-[10px] text-[#b82e46] font-bold text-center pt-1 border-t border-slate-100 group-hover:underline">
                        Click to load order into menu & bill ➔
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
      {customizingItem && (() => {
        const portionGroups = (customizingItem.addonGroups || []).filter((g) => {
          const gn = g.name.toLowerCase();
          return gn.includes("size") || gn.includes("portion") || gn.includes("pack") || gn.includes("style") || gn.includes("type") || gn.includes("falooda");
        });
        const toppingGroups = (customizingItem.addonGroups || []).filter((g) => {
          const gn = g.name.toLowerCase();
          return !gn.includes("size") && !gn.includes("portion") && !gn.includes("pack") && !gn.includes("style") && !gn.includes("type") && !gn.includes("falooda");
        });

        const portionAddons = portionGroups.flatMap((g) => g.addons.map((a) => ({ ...a, groupName: g.name })));
        const toppingAddons = toppingGroups.flatMap((g) => g.addons.map((a) => ({ ...a, groupName: g.name })));

        const basePrice = selectedPortion ? Number(selectedPortion.price) : Number(customizingItem.price);
        const toppingTotal = customizingAddons.reduce((sum, a) => sum + a.price, 0);
        const unitPrice = basePrice + toppingTotal;
        const lineTotal = unitPrice * customizingQty;
        const displayName = formatCustomizedItemName(customizingItem.name, selectedPortion);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#b82e46] tracking-wider">Customize Item</span>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{displayName}</h3>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-1 inline-block">
                    Price: ₹{unitPrice.toFixed(0)}
                  </span>
                </div>
                <button type="button" onClick={() => setCustomizingItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Portion / Size Selection (Single-Choice Radio) */}
              {portionAddons.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">Select Portion / Size:</span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto scrollbar-none pr-1">
                    {portionAddons.map((addon) => {
                      const isSelected = selectedPortion?.addonId === addon.id;
                      return (
                        <label
                          key={addon.id}
                          onClick={() => setSelectedPortion({ addonId: addon.id, name: addon.name, price: Number(addon.price), groupName: addon.groupName })}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-xs ${
                            isSelected ? "bg-rose-50/80 border-[#b82e46] text-[#991b32] font-bold shadow-2xs" : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="portionSelection"
                              checked={isSelected}
                              onChange={() => setSelectedPortion({ addonId: addon.id, name: addon.name, price: Number(addon.price), groupName: addon.groupName })}
                              className="h-4 w-4 text-[#b82e46] focus:ring-0 cursor-pointer accent-[#b82e46]"
                            />
                            <div>
                              <span className="text-xs block">{addon.name}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{addon.groupName}</span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-slate-900">₹{Number(addon.price).toFixed(0)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Addons / Toppings (Multi-Choice Checkboxes) */}
              {toppingAddons.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700 block">Add Extra Toppings:</span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-none pr-1">
                    {toppingAddons.map((addon) => {
                      const isChecked = customizingAddons.some((a) => a.addonId === addon.id);
                      return (
                        <label
                          key={addon.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-xs ${
                            isChecked ? "bg-emerald-50/80 border-emerald-500 text-slate-900 shadow-2xs" : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-white"
                          }`}
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
                          <span className="font-mono font-bold text-emerald-700">+₹{Number(addon.price).toFixed(0)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {portionAddons.length === 0 && toppingAddons.length === 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium">
                  Standard item with no additional toppings. Set quantity below and add to bill.
                </div>
              )}

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
                    setCart((current) => [
                      ...current,
                      {
                        localId: `${customizingItem.id}-${Date.now()}-${current.length}`,
                        itemId: customizingItem.id,
                        name: displayName,
                        quantity: customizingQty,
                        addons: customizingAddons,
                        unitPrice,
                      },
                    ]);
                    setCustomizingItem(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#b82e46] to-[#991b32] hover:from-[#a8253b] hover:to-[#88172c] text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-[0.98]"
                >
                  Add to Cart (₹{lineTotal.toFixed(0)})
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 80MM THERMAL RECEIPT PRINT CONTAINER (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
      {mounted && typeof document !== "undefined"
        ? createPortal(
            <div id="print-ticket-root">
              {printMode === "KOT_ONLY" || printMode === "BOTH" ? (
                <div style={{ pageBreakAfter: printMode === "BOTH" ? "always" : "auto", paddingBottom: "8px", fontFamily: "Arial, 'Helvetica Neue', Helvetica, Roboto, sans-serif" }}>
                  <div style={{ fontSize: "11px", fontWeight: "400", color: "#000", marginBottom: "2px" }}>
                    {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div style={{ textAlign: "center", margin: "4px 0 6px 0" }}>
                    <div style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "0.5px" }}>
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
                              {activeBill.order?.source === "ZOMATO" ? "Zomato" : activeBill.order?.source === "SWIGGY" ? "Swiggy" : activeBill.order?.source} : {mainPart}<span style={{ fontWeight: "700", fontSize: "15px" }}>{last4}</span>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                    <div style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", marginTop: "2px" }}>
                      {orderType === "DINE_IN" ? "DINE IN" : orderType === "DELIVERY" ? "Delivery" : "Pick Up"}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", margin: "4px 0" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #000" }}>
                        <th style={{ textAlign: "left", paddingBottom: "4px", fontWeight: "400" }}>No.Item</th>
                        <th style={{ textAlign: "center", paddingBottom: "4px", width: "35%", fontWeight: "400" }}>Special Note</th>
                        <th style={{ textAlign: "right", paddingBottom: "4px", width: "15%", fontWeight: "400" }}>Qty.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((activeBill?.items && activeBill.items.length > 0)
                        ? activeBill.items
                        : cart.length > 0
                        ? cart
                        : [{ name: "Royal Falooda (Sample Test)", quantity: 1, notes: "Printer Test OK" }]
                      ).map((item: any, idx: number) => (
                        <tr key={idx} style={{ verticalAlign: "top" }}>
                          <td style={{ textAlign: "left", paddingTop: "4px", fontWeight: "400" }}>
                            {idx + 1} {item.name}
                            {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                              <div style={{ fontSize: "10px", fontWeight: "400", color: "#000" }}>
                                ({item.addons.map((a: any) => a.name).join(", ")})
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "center", paddingTop: "4px", fontSize: "10px", fontWeight: "400" }}>
                            {item.notes ? item.notes : "--"}
                          </td>
                          <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "700", fontSize: "12px" }}>
                            {item.quantity || 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ borderTop: "1px solid #000", marginTop: "6px" }} />
                </div>
              ) : null}

              {printMode === "BILL_ONLY" || printMode === "BOTH" ? (
                <div style={{ paddingTop: printMode === "BOTH" ? "8px" : "0", fontFamily: "Arial, 'Helvetica Neue', Helvetica, Roboto, sans-serif" }}>
                  <div style={{ textAlign: "center", lineHeight: "1.25" }}>
                    {activeBill?.order ? (
                      <div style={{ fontWeight: "700", fontSize: "13px", textTransform: "uppercase", marginBottom: "2px" }}>
                        PAID
                      </div>
                    ) : null}
                    <div style={{ fontWeight: "700", fontSize: "16px", textTransform: "none", marginBottom: "2px" }}>
                      Bombay Falooda
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "700", padding: "0 2px" }}>
                      {context?.outlet?.address || "Opp Sayaji vihar club, near khanderav market, raj mahal road vadodara."}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "700", marginTop: "1px" }}>
                      M. {(context?.outlet as any)?.phone || "9574754173"}
                    </div>
                  </div>

                  <div style={{ fontSize: "11px", marginTop: "8px", lineHeight: "1.3" }}>
                    {activeBill?.customerName && (
                      <div style={{ fontWeight: "400" }}>Name: {activeBill.customerName}</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "400" }}>Date: {new Date().toLocaleDateString("en-GB")}</span>
                      <span style={{ fontWeight: "400" }}>{new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "700" }}>
                        Bill No.: {activeBill?.billNumber ? activeBill.billNumber.replace("BILL-", "") : "51851"}
                      </span>
                      <span style={{ fontWeight: "700" }}>
                        {orderType === "DINE_IN" ? "Dine In" : orderType === "DELIVERY" ? "Delivery" : "Pick Up"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "700" }}>
                        Token No.: {activeBill?.kotTickets?.[0]?.kotNumber ? activeBill.kotTickets[0].kotNumber.replace("KOT-", "") : "8"}
                      </span>
                      <span style={{ fontWeight: "400" }}>
                        Cashier: {activeBill?.order ? "Autoaccept" : ((context as any)?.device?.name || "biller")}
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #000", margin: "6px 0 4px 0" }} />

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #000" }}>
                        <th style={{ textAlign: "left", paddingBottom: "4px", fontWeight: "400" }}>No.Item</th>
                        <th style={{ textAlign: "center", paddingBottom: "4px", width: "12%", fontWeight: "400" }}>Qty.</th>
                        <th style={{ textAlign: "right", paddingBottom: "4px", width: "18%", fontWeight: "400" }}>Price</th>
                        <th style={{ textAlign: "right", paddingBottom: "4px", width: "22%", fontWeight: "400" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((activeBill?.items && activeBill.items.length > 0)
                        ? activeBill.items
                        : cart.length > 0
                        ? cart
                        : [{ name: "Royal Falooda (Sample)", quantity: 1, unitPrice: 90, price: 90, total: 90 }]
                      ).map((item: any, idx: number) => {
                        const qty = item.quantity || 1;
                        const unitPrice = Number(item.unitPrice || item.price || 90);
                        const itemTotal = Number(item.total || unitPrice * qty);
                        return (
                          <tr key={idx} style={{ verticalAlign: "top" }}>
                            <td style={{ textAlign: "left", paddingTop: "4px", fontWeight: "400", paddingRight: "4px" }}>
                              {idx + 1} {item.name}
                              {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                                <div style={{ fontSize: "10px", fontWeight: "400", color: "#000" }}>
                                  ({item.addons.map((a: any) => a.name).join(", ")})
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: "center", paddingTop: "4px", fontWeight: "400" }}>{qty}</td>
                            <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "400" }}>{unitPrice.toFixed(2)}</td>
                            <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "400" }}>{itemTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ borderTop: "1px solid #000", marginTop: "6px", paddingTop: "4px", fontSize: "11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "400" }}>
                      <span>Total Qty: {((activeBill?.items && activeBill.items.length > 0) ? activeBill.items : cart.length > 0 ? cart : [{ quantity: 1 }]).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)}</span>
                      <span>Sub Total  {Number(activeBill?.subtotal || (cartSubtotal > 0 ? cartSubtotal : 90)).toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", margin: "6px 0", padding: "6px 0", display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "14px" }}>
                    <span>Grand Total</span>
                    <span>₹ {Number(activeBill?.total || (activeTotal > 0 ? activeTotal : 90)).toFixed(2)}</span>
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
                      <div style={{ borderTop: "1px solid #000", margin: "6px 0 4px 0" }} />
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


