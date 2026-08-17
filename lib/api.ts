"use client";

import { clearPosSession, getPosToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

function redirectToLoginOnUnauthorized() {
  if (typeof window === "undefined") {
    return;
  }

  clearPosSession();

  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (options.auth !== false) {
    const token = getPosToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) {
      redirectToLoginOnUnauthorized();
    }

    const message =
      data?.message instanceof Array
        ? data.message.join(", ")
        : data?.message || "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export type MenuAddon = {
  id: string;
  name: string;
  price: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  categoryId: string;
  addonGroups: Array<{
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    isRequired: boolean;
    addons: MenuAddon[];
  }>;
};

export type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

export type Bill = {
  id: string;
  billNumber: string;
  status: "HELD" | "FINALIZED" | "CANCELLED";
  orderType?: string | null;
  paymentMethod?: string | null;
  createdAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  notePrintEnabled?: boolean;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  outlet?: {
    id: string;
    name: string;
    code: string;
    address: string;
  };
  posDevice?: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: string | number;
    total: string | number;
    addons?: Array<{ addonId: string; name: string; price: number }> | null;
    notes?: string | null;
  }>;
  kotTickets: Array<{
    id: string;
    kotNumber: string;
    notes?: string | null;
    createdAt: string;
    items?: Array<{
      id: string;
      billItemId: string;
      quantity: number;
      notes?: string | null;
      billItem?: {
        id: string;
        name: string;
        quantity: number;
        total: string | number;
        addons?: Array<{ addonId: string; name: string; price: number }> | null;
        notes?: string | null;
      };
    }>;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: string | number;
    reference?: string | null;
  }>;
};

export type KotTicket = Bill["kotTickets"][number] & {
  bill: Bill;
};

export type DigitalOrder = {
  id: string;
  source: string;
  type: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  total: string | number;
  createdAt: string;
  items: Array<{ id: string; name: string; quantity: number; total: string | number }>;
};

export type AcceptedDigitalOrder = {
  order: DigitalOrder;
  bill: Bill;
  kot: Bill["kotTickets"][number] | null;
  message: string;
};
