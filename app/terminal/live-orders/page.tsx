"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Radio,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Bike,
  Utensils,
  User,
  Phone,
  Check,
  Globe,
} from "lucide-react";
import { apiRequest, type AcceptedDigitalOrder, type DigitalOrder } from "@/lib/api";
import { getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";

export default function PosLiveOrdersPage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    const token = getPosToken();
    const savedContext = getSavedPosContext();
    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }
    setContext(savedContext);
    void fetchLiveOrders();
  }, [router]);

  async function fetchLiveOrders() {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<DigitalOrder[]>("/pos-terminal/orders");
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live orders");
    } finally {
      setLoading(false);
    }
  }

  const [selectedDriver, setSelectedDriver] = useState<Record<string, { id: string; name: string; phone: string }>>({});
  const [acceptedLinks, setAcceptedLinks] = useState<Record<string, { customer: string; driver: string }>>({});

  const driversList = [
    { id: "tm-1", name: "Sahir Qureshi", phone: "9876543210" },
    { id: "tm-2", name: "Zahid Qureshi", phone: "9876543211" },
    { id: "tm-3", name: "Ramesh Sharma", phone: "9876543212" },
  ];

  async function acceptOrder(orderId: string, orderType: string) {
    try {
      setActionMessage("");
      const driver = selectedDriver[orderId] || driversList[0];
      const result = await apiRequest<AcceptedDigitalOrder & { customerTrackingUrl?: string; driverNavUrl?: string }>(
        `/pos-terminal/orders/${orderId}/accept`,
        {
          method: "POST",
          body: orderType === "DELIVERY" ? { driverId: driver.id, driverName: driver.name, driverPhone: driver.phone } : {},
        }
      );

      if (result.customerTrackingUrl && result.driverNavUrl) {
        setAcceptedLinks((prev) => ({
          ...prev,
          [orderId]: { customer: result.customerTrackingUrl!, driver: result.driverNavUrl! },
        }));
      }

      setActionMessage(result.message);
      await fetchLiveOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept order");
    }
  }

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setActionMessage(`Copied ${label} to clipboard!`);
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
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700 animate-pulse">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Live Incoming Orders Board</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold">
                  {orders.length} Active
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Outlet: {context?.outlet.name} ({context?.outlet.code})
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchLiveOrders}
          className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Sync Orders</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto p-4 md:p-6 space-y-6">
        {actionMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3 shadow-2xs">
            <div className="h-16 w-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Radio className="h-8 w-8 stroke-[1.75]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Pending Live Orders</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All digital orders from Website, Zomato, Swiggy & EasyCater have been processed into the POS terminal.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded bg-purple-100 text-purple-800 text-xs font-extrabold uppercase flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      {order.source}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="font-bold text-xs text-slate-900">
                          {order.customerName || "Walk-in Customer"}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" />
                          <span>{order.customerPhone || "No Phone"}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.type === "DELIVERY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {order.type}
                      </span>
                    </div>

                    {/* Delivery Driver Selection (Only for Delivery orders) */}
                    {order.type === "DELIVERY" && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1">
                        <label className="block text-[10px] font-bold text-emerald-800 uppercase">
                          Assign Present Delivery Staff / Driver:
                        </label>
                        <select
                          value={selectedDriver[order.id]?.id || "tm-1"}
                          onChange={(e) => {
                            const found = driversList.find((d) => d.id === e.target.value);
                            if (found) {
                              setSelectedDriver((prev) => ({ ...prev, [order.id]: found }));
                            }
                          }}
                          className="w-full h-8 rounded border border-emerald-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none"
                        >
                          {driversList.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.phone})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Generated Links Display */}
                    {acceptedLinks[order.id] && (
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 space-y-2 text-xs">
                        <div className="font-bold text-blue-900 text-[11px]">Generated Delivery Links:</div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(acceptedLinks[order.id].customer, "Customer Tracking Link")}
                          className="w-full text-left p-1.5 rounded bg-white hover:bg-blue-100 border border-blue-200 text-[10px] font-mono text-blue-800 truncate block"
                        >
                          🔗 Customer: {acceptedLinks[order.id].customer}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(acceptedLinks[order.id].driver, "Driver Navigation Link")}
                          className="w-full text-left p-1.5 rounded bg-white hover:bg-blue-100 border border-blue-200 text-[10px] font-mono text-emerald-800 truncate block"
                        >
                          🚚 Driver: {acceptedLinks[order.id].driver}
                        </button>
                      </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="font-mono text-slate-600">₹{Number(item.total).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Order Total</span>
                    <span className="font-mono text-base font-black text-emerald-700">₹{Number(order.total).toFixed(0)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void acceptOrder(order.id, order.type)}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span>Accept & Assign Driver</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

