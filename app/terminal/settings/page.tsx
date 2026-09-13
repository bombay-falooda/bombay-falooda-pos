"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Settings,
  ShieldCheck,
  Printer,
  Wifi,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Radio,
  Sliders,
  Check,
  X,
  Bluetooth,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";
import {
  connectBluetoothPrinter,
  sendEscPosToBluetooth,
  buildEscPosKotReceipt,
  buildEscPosBillReceipt,
} from "@/lib/bluetooth-printer";
import {
  connectUsbPrinter,
  sendEscPosToUsb,
  isWebSerialSupported,
  getConnectedUsbDeviceName,
} from "@/lib/usb-printer";

type SettingsData = {
  twoFactorEnabled: boolean;
  printer: {
    name: string;
    ipAddress: string;
    paperWidth: string;
    autoCut: boolean;
  };
};

export default function PosSettingsPage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [printerName, setPrinterName] = useState("Thermal Receipt Printer (80mm)");
  const [printerIp, setPrinterIp] = useState("192.168.1.100");
  const [paperWidth, setPaperWidth] = useState("80mm");
  const [autoCut, setAutoCut] = useState(true);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [desktopPrinters, setDesktopPrinters] = useState<Array<{ name: string; isDefault?: boolean }>>([]);

  // Printer Connection Mode & Hardware States
  const [printerConnectionType, setPrinterConnectionType] = useState<"USB_DIRECT" | "BLUETOOTH" | "CABLE">("USB_DIRECT");
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [usbDeviceName, setUsbDeviceName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedType = localStorage.getItem("pos_printer_type");
      if (savedType === "BLUETOOTH" || savedType === "CABLE" || savedType === "USB_DIRECT") {
        setPrinterConnectionType(savedType as any);
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
    void fetchSettings();
  }, [router]);

  async function fetchSettings() {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<SettingsData>("/pos-terminal/settings");
      if (data) {
        setTwoFactorEnabled(data.twoFactorEnabled ?? true);
        if (data.printer) {
          setPrinterName(data.printer.name || "Thermal Receipt Printer (80mm)");
          setPrinterIp(data.printer.ipAddress || "192.168.1.100");
          setPaperWidth(data.printer.paperWidth || "80mm");
          setAutoCut(data.printer.autoCut ?? true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle2FA() {
    try {
      setMessage("");
      setError("");
      const nextState = !twoFactorEnabled;
      const res = await apiRequest<{ twoFactorEnabled: boolean; message: string }>(
        "/pos-terminal/settings/2fa",
        {
          method: "PATCH",
          body: { enabled: nextState },
        }
      );
      setTwoFactorEnabled(res.twoFactorEnabled);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update 2FA setting");
    }
  }

  async function handleConnectUsb() {
    try {
      setError("");
      setMessage("");
      const name = await connectUsbPrinter();
      setUsbDeviceName(name);
      setPrinterConnectionType("USB_DIRECT");
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_printer_type", "USB_DIRECT");
      }
      setMessage(`Successfully connected to USB Cable Thermal Printer: ${name}`);
    } catch (err: any) {
      if (err?.message?.includes("No port selected") || err?.name === "NotFoundError") {
        setMessage("No raw serial port was selected. In the Desktop App, simply select your printer from the Windows Driver list below!");
        return;
      }
      setError(err.message || "Failed to pair USB printer");
    }
  }

  async function handleConnectBluetooth() {
    try {
      setError("");
      setMessage("");
      const name = await connectBluetoothPrinter();
      setBtDeviceName(name);
      setPrinterConnectionType("BLUETOOTH");
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_printer_type", "BLUETOOTH");
      }
      setMessage(`Successfully paired with Bluetooth Thermal Printer: ${name}`);
    } catch (err: any) {
      setError(err.message || "Failed to pair Bluetooth printer");
    }
  }

  async function handleSavePrinterSettings() {
    try {
      setMessage("");
      setError("");
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_printer_type", printerConnectionType);
        localStorage.setItem("pos_printer_name", printerName);
        localStorage.setItem("pos_printer_ip", printerIp);
        localStorage.setItem("pos_printer_paper", paperWidth);
      }
      const res = await apiRequest<{ message: string; printer: SettingsData["printer"] }>(
        "/pos-terminal/settings/printer",
        {
          method: "PATCH",
          body: {
            name: printerName,
            ipAddress: printerIp,
            paperWidth,
            autoCut,
          },
        }
      );
      setMessage(`${res.message} (${printerConnectionType === "USB_DIRECT" ? "Direct USB Cable Mode (0ms/Zero Flash)" : printerConnectionType === "BLUETOOTH" ? "Bluetooth Wireless Mode" : "Windows Spooler Mode"})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save printer settings");
    }
  }

  async function handleTestPrinterConnection() {
    setTestingPrinter(true);
    setTestResult("");
    setError("");

    try {
      if (printerConnectionType === "USB_DIRECT") {
        const kotBytes = buildEscPosKotReceipt(
          "TEST-1",
          "TAKEAWAY",
          [{ name: "Pista Falooda (Test)", quantity: 1, notes: "Direct USB Receipt Test" }]
        );
        await sendEscPosToUsb(kotBytes);
        setTestResult(`🟢 Direct USB Cable test receipt printed instantly (0 preview dialog)!`);
      } else if (printerConnectionType === "BLUETOOTH") {
        if (!btDeviceName) {
          setError("No Bluetooth printer paired. Please click 'Pair Bluetooth Thermal Printer' first.");
          return;
        }
        const kotBytes = buildEscPosKotReceipt(
          "TEST-1",
          "TAKEAWAY",
          [{ name: "Pista Falooda (Test)", quantity: 1, notes: "Bluetooth Receipt Test" }]
        );
        await sendEscPosToBluetooth(kotBytes);
        setTestResult(`🟢 Bluetooth test receipt sent successfully to ${btDeviceName}`);
      } else {
        setTestResult("🟢 Triggering Windows driver print spooler...");
        setTimeout(() => window.print(), 250);
      }
    } catch (err: any) {
      setTestResult(`🔴 Hardware test print failed: ${err.message || "Unknown error"}`);
    } finally {
      setTestingPrinter(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans">
      {/* Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to POS</span>
          </Link>
          <div className="h-5 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-900 text-white">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">POS Terminal Settings & Real 2FA</h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Outlet: {context?.outlet.name} ({context?.outlet.code})
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Reload</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto p-4 md:p-6 space-y-6">
        {message && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Real 2FA Security Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b pb-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900">Two-Factor Authentication (2FA)</h2>
                  <p className="text-[11px] text-slate-500">Real TOTP / OTP Verification for POS Cashier Login</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-800">Require 2FA Code on Login</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {twoFactorEnabled
                      ? "2FA is active. Staff must enter OTP upon session login."
                      : "2FA is disabled. Staff log in with PIN only."}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggle2FA}
                  className={`w-12 h-6 rounded-full p-1 transition duration-200 ease-in-out ${twoFactorEnabled ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition transform ${twoFactorEnabled ? "translate-x-6" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-400 font-medium border-t border-slate-100">
              Database Synced • Persisted to Outlet Admin User Security Settings
            </div>
          </div>

          {/* Thermal Printer Config Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2.5 rounded-xl bg-slate-900 text-white">
                <Printer className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900">Thermal Printer & KOT Config</h2>
                <p className="text-[11px] text-slate-500">Dual Hardware Integration (USB Cable vs Bluetooth Wireless)</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Connection Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Printer Connection Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterConnectionType("USB_DIRECT");
                      if (typeof window !== "undefined") localStorage.setItem("pos_printer_type", "USB_DIRECT");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      printerConnectionType === "USB_DIRECT"
                        ? "border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold shadow-2xs"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">⚡ USB Direct</span>
                      {printerConnectionType === "USB_DIRECT" && <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">0ms / Zero Flash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrinterConnectionType("BLUETOOTH");
                      if (typeof window !== "undefined") localStorage.setItem("pos_printer_type", "BLUETOOTH");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      printerConnectionType === "BLUETOOTH"
                        ? "border-blue-600 bg-blue-50/90 text-blue-950 font-bold shadow-2xs"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">📶 Bluetooth</span>
                      {printerConnectionType === "BLUETOOTH" && <Check className="h-3.5 w-3.5 text-blue-600 font-bold" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Wireless ESC/POS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrinterConnectionType("CABLE");
                      if (typeof window !== "undefined") localStorage.setItem("pos_printer_type", "CABLE");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      printerConnectionType === "CABLE"
                        ? "border-slate-700 bg-slate-100 text-slate-950 font-bold shadow-2xs"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">🖨️ Windows</span>
                      {printerConnectionType === "CABLE" && <Check className="h-3.5 w-3.5 text-slate-800 font-bold" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">System Driver</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Connection Options */}
              {printerConnectionType === "USB_DIRECT" ? (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Direct USB Status:</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${usbDeviceName ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-blue-100 text-blue-800 border border-blue-300"}`}>
                      {usbDeviceName ? `🟢 Connected: ${usbDeviceName}` : "Ready to Pair (USB Cable)"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleConnectUsb()}
                    className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    <span>{usbDeviceName ? "Change / Re-pair USB Cable Printer" : "Pair USB Cable Printer (One-Click)"}</span>
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">Bypasses Chrome print preview window completely for 100% silent zero-flash printing.</p>
                </div>
              ) : printerConnectionType === "BLUETOOTH" ? (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Bluetooth Status:</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${btDeviceName ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                      {btDeviceName ? `🟢 Paired: ${btDeviceName}` : "🔴 Disconnected"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleConnectBluetooth()}
                    className="w-full py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bluetooth className="h-4 w-4" />
                    <span>{btDeviceName ? "Re-pair Bluetooth Thermal Printer" : "Connect with Bluetooth"}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800">Windows Desktop Native Driver</p>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      {isDesktopApp ? "⚡ Desktop Native (.exe)" : "🟢 Active"}
                    </span>
                  </div>

                  {desktopPrinters.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-bold text-slate-600 block">
                        Select Installed Thermal Printer:
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
                        Orders & receipts will print 100% silently to this thermal printer with zero dialogs.
                      </p>
                    </div>
                  ) : (
                    <p>
                      Connect thermal printer via USB cable to PC. Automatically sends print jobs to the selected Windows printer driver.
                    </p>
                  )}
                </div>
              )}

              {desktopPrinters.length === 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Printer Device Model Name</label>
                  <input
                    type="text"
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-800 outline-none focus:border-[#b82e46]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Network Printer IP Address</label>
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[#b82e46]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Paper Roll Width</label>
                  <select
                    value={paperWidth}
                    onChange={(e) => setPaperWidth(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-300 px-2 text-xs font-medium text-slate-800 outline-none"
                  >
                    <option value="80mm">80mm (3-inch Standard)</option>
                    <option value="58mm">58mm (2-inch Compact)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Auto-Cut Paper</label>
                  <button
                    type="button"
                    onClick={() => setAutoCut(!autoCut)}
                    className={`w-full h-9 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${autoCut
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                      }`}
                  >
                    {autoCut ? <Check className="h-4 w-4 stroke-[3]" /> : <X className="h-4 w-4" />}
                    <span>{autoCut ? "Auto-Cut Enabled" : "Manual Cut"}</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
                  {testResult}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={testingPrinter}
                  onClick={handleTestPrinterConnection}
                  className="py-2.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wifi className="h-3.5 w-3.5 text-slate-500" />
                  <span>Test Connection</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePrinterSettings}
                  className="py-2.5 px-3 rounded-lg bg-[#b82e46] hover:bg-[#a8253b] text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Printer Config</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 80MM / 58MM TEST THERMAL RECEIPT (VISIBLE ON PRINT) */}
      {typeof document !== "undefined"
        ? createPortal(
            <div id="print-ticket-root">
              <div style={{ textAlign: "center", lineHeight: "1.25" }}>
                <div style={{ fontWeight: "700", fontSize: "16px", marginBottom: "2px" }}>
                  Bombay Falooda
                </div>
                <div style={{ fontSize: "11px", fontWeight: "700" }}>
                  Thermal Receipt Hardware Test
                </div>
                <div style={{ fontSize: "10px", fontWeight: "500", marginTop: "2px" }}>
                  M. 9574754173 | Surat Branch
                </div>
              </div>

              <div style={{ borderTop: "1px solid #000", margin: "6px 0 4px 0" }} />

              <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Date: {new Date().toLocaleDateString("en-GB")}</span>
                  <span style={{ fontWeight: "700" }}>TEST RECEIPT</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Time: {new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>Driver: {printerName || "Windows Spooler"}</span>
                </div>
                <div style={{ fontWeight: "700", marginTop: "2px" }}>
                  Status: 🟢 Connected & Active
                </div>
              </div>

              <div style={{ borderTop: "1px solid #000", margin: "6px 0 4px 0" }} />

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #000" }}>
                    <th style={{ textAlign: "left", paddingBottom: "2px" }}>Item</th>
                    <th style={{ textAlign: "center", paddingBottom: "2px", width: "15%" }}>Qty</th>
                    <th style={{ textAlign: "right", paddingBottom: "2px", width: "20%" }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "left", paddingTop: "4px" }}>Royal Falooda (Sample)</td>
                    <td style={{ textAlign: "center", paddingTop: "4px" }}>1</td>
                    <td style={{ textAlign: "right", paddingTop: "4px", fontWeight: "700" }}>₹90</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ borderTop: "1px solid #000", margin: "6px 0 4px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700" }}>
                <span>Total Amount:</span>
                <span>₹90.00</span>
              </div>

              <div style={{ borderTop: "1px solid #000", margin: "6px 0 4px 0" }} />

              <div style={{ textAlign: "center", paddingTop: "4px", fontSize: "11px", fontWeight: "800", lineHeight: "1.4" }}>
                <div>Printer Hardware Test Successful</div>
                <div style={{ fontSize: "10px", marginTop: "2px", fontWeight: "600" }}>
                  100% Silent Background Printing Ready
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
