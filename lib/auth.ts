"use client";

const POS_TOKEN_KEY = "bombay_falooda_pos_token";
const POS_CONTEXT_KEY = "bombay_falooda_pos_context";

export type PosContext = {
  posDevice: {
    id: string;
    name: string;
    type: "PERMANENT" | "TEMPORARY";
    status: string;
    accessKey: string;
    eventName?: string | null;
    eventLocation?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
  };
  outlet: {
    id: string;
    name: string;
    code: string;
    address: string;
  };
  franchise?: {
    id: string;
    name: string;
  } | null;
};

export function getPosToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(POS_TOKEN_KEY);
}

export function savePosSession(token: string, context: PosContext) {
  window.localStorage.setItem(POS_TOKEN_KEY, token);
  window.localStorage.setItem(POS_CONTEXT_KEY, JSON.stringify(context));
}

export function getSavedPosContext(): PosContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(POS_CONTEXT_KEY);
  return value ? (JSON.parse(value) as PosContext) : null;
}

export function clearPosSession() {
  window.localStorage.removeItem(POS_TOKEN_KEY);
  window.localStorage.removeItem(POS_CONTEXT_KEY);
}
