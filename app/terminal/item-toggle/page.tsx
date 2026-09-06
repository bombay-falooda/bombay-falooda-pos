"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  SlidersHorizontal,
  Search,
  CheckCircle2,
  RefreshCw,
  Globe,
  Bike,
  ShoppingBag,
  Store,
  Check,
  X,
  Layers,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";

type ItemChannel = {
  id: string;
  name: string;
  category: string;
  price: number;
  channels: {
    pos: boolean;
    website: boolean;
    zomato: boolean;
    swiggy: boolean;
    easycater: boolean;
  };
};

export default function PosItemTogglePage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [items, setItems] = useState<ItemChannel[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const token = getPosToken();
    const savedContext = getSavedPosContext();
    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }
    setContext(savedContext);
    void fetchItemChannels();
  }, [router]);

  async function fetchItemChannels() {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<ItemChannel[]>("/pos-terminal/item-channels");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channel availability");
    } finally {
      setLoading(false);
    }
  }

  async function toggleChannel(itemId: string, channel: "pos" | "website" | "zomato" | "swiggy" | "easycater") {
    const currentItem = items.find((i) => i.id === itemId);
    if (!currentItem) return;

    const updatedChannels = {
      ...currentItem.channels,
      [channel]: !currentItem.channels[channel],
    };

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, channels: updatedChannels } : i))
    );

    try {
      setToast("");
      const res = await apiRequest<{ message: string; channels: ItemChannel["channels"] }>(
        `/pos-terminal/item-channels/${itemId}`,
        {
          method: "PATCH",
          body: { channel, enabled: updatedChannels[channel] },
        }
      );
      setToast(`Updated ${currentItem.name} (${channel.toUpperCase()}: ${updatedChannels[channel] ? "ON" : "OFF"})`);
    } catch (err) {
      setError("Failed to sync channel status to database");
      await fetchItemChannels(); // revert on failure
    }
  }

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category)));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        !search.trim() || item.name.toLowerCase().includes(search.toLowerCase().trim());
      return matchesCat && matchesSearch;
    });
  }, [items, selectedCategory, search]);

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
            <div className="p-2 rounded-lg bg-[#b82e46] text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Multi-Channel Item Availability (On/Off)</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                  {items.length} Menu Items
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Toggle item availability for Website, Zomato, Swiggy, EasyCater & POS
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchItemChannels}
          className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-4">
        {toast && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[#b82e46]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                selectedCategory === "all"
                  ? "bg-[#b82e46] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                  selectedCategory === cat
                    ? "bg-[#b82e46] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Item Channels Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 font-mono">Price</th>
                  <th className="py-3 px-4 text-center">POS Terminal</th>
                  <th className="py-3 px-4 text-center">Website</th>
                  <th className="py-3 px-4 text-center">Zomato</th>
                  <th className="py-3 px-4 text-center">Swiggy</th>
                  <th className="py-3 px-4 text-center">EasyCater</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{item.category}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">₹{item.price}</td>

                    {/* POS Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleChannel(item.id, "pos")}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition inline-flex items-center gap-1 ${
                          item.channels.pos
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.channels.pos ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3" />}
                        <span>{item.channels.pos ? "POS ON" : "POS OFF"}</span>
                      </button>
                    </td>

                    {/* Website Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleChannel(item.id, "website")}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition inline-flex items-center gap-1 ${
                          item.channels.website
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.channels.website ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3" />}
                        <span>{item.channels.website ? "WEB ON" : "WEB OFF"}</span>
                      </button>
                    </td>

                    {/* Zomato Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleChannel(item.id, "zomato")}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition inline-flex items-center gap-1 ${
                          item.channels.zomato
                            ? "bg-rose-100 text-rose-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.channels.zomato ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3" />}
                        <span>{item.channels.zomato ? "ZOMATO ON" : "OFF"}</span>
                      </button>
                    </td>

                    {/* Swiggy Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleChannel(item.id, "swiggy")}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition inline-flex items-center gap-1 ${
                          item.channels.swiggy
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.channels.swiggy ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3" />}
                        <span>{item.channels.swiggy ? "SWIGGY ON" : "OFF"}</span>
                      </button>
                    </td>

                    {/* EasyCater Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleChannel(item.id, "easycater")}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition inline-flex items-center gap-1 ${
                          item.channels.easycater
                            ? "bg-purple-100 text-purple-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.channels.easycater ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3" />}
                        <span>{item.channels.easycater ? "CATER ON" : "OFF"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
