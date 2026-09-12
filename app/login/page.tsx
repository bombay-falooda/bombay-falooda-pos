"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiRequest } from "@/lib/api";
import { savePosSession, type PosContext } from "@/lib/auth";

type LoginResponse = PosContext & {
  accessToken: string;
};

export default function PosLoginPage() {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState("");
  const [pin, setPin] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const GOOGLE_CLIENT_ID =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "594662082129-hoq7tdd4hpjl50kn12sjnl5bqvg27e26.apps.googleusercontent.com";

  useState(() => {
    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if ((window as any).google?.accounts?.id) {
          (window as any).google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
          });
        }
      };
      document.body.appendChild(script);
    }
  });

  async function handleGoogleCredentialResponse(googleResponse: { credential?: string }) {
    setError("");
    setLoading(true);

    try {
      const response = await apiRequest<LoginResponse>("/pos-auth/google", {
        method: "POST",
        auth: false,
        body: {
          credential: googleResponse.credential,
          deviceCode: deviceCode || undefined,
        },
      });

      savePosSession(response.accessToken, {
        posDevice: response.posDevice,
        outlet: response.outlet,
        franchise: response.franchise,
      });
      router.push("/terminal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google terminal login failed");
    } finally {
      setLoading(false);
    }
  }

  function continueWithGoogle() {
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          void handleGoogleCredentialResponse({ credential: "" });
        }
      });
    } else {
      void handleGoogleCredentialResponse({ credential: "" });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiRequest<LoginResponse>("/pos-auth/login", {
        method: "POST",
        auth: false,
        body: { accessKey, pin, deviceCode: deviceCode || undefined },
      });
      savePosSession(response.accessToken, {
        posDevice: response.posDevice,
        outlet: response.outlet,
        franchise: response.franchise,
      });
      router.push("/terminal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[#fff8f3]">
      <section className="mx-auto grid h-screen max-h-screen max-w-[1320px] overflow-hidden lg:grid-cols-[1.02fr_0.98fr]">
        <aside className="relative hidden h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_90%,rgba(243,179,61,0.22),transparent_22%),radial-gradient(circle_at_82%_92%,rgba(194,65,93,0.16),transparent_18%),linear-gradient(135deg,#fffdf9_0%,#fff4ed_58%,#f8f1ea_100%)] px-8 py-6 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(15,118,110,0.08),transparent_30%)]" />
          <div className="relative z-10 flex items-center gap-3">
            <Image src="/bombay-falooda-logo.jpeg" width={42} height={42} alt="Bombay Falooda" className="object-cover shadow-sm" />
            <span className="font-display text-xl font-bold text-[#17110f]">Bombay Falooda POS</span>
          </div>

          <div className="relative z-10 mt-8 max-w-lg">
            <div className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-[#c2415d] shadow-[0_12px_32px_rgba(42,32,27,0.06)]">
              KOT. Billing. Orders. Counter speed.
            </div>
            <h1 className="font-display mt-5 text-[36px] font-bold leading-[1.06] tracking-tight text-[#17110f]">
              Everything your counter needs to serve with flow
            </h1>
            <p className="mt-3 max-w-md text-[12px] font-semibold leading-5 text-[#7d6b62]">
              Open the assigned outlet terminal, create bills, print KOTs, hold orders and process website orders in one focused workspace.
            </p>
          </div>

          <div className="relative z-10 mt-6 w-full max-w-[445px] rounded-[16px] border border-white bg-white/86 p-3 shadow-[0_20px_54px_rgba(42,32,27,0.1)] backdrop-blur-xl">
            <div className="grid grid-cols-[62px_1fr] gap-3">
              <div className="rounded-[12px] bg-[#17110f] p-2.5 text-white">
                <div className="h-8 w-8 overflow-hidden rounded-[9px] bg-white p-1">
                  <Image src="/bombay-falooda-logo.jpeg" width={36} height={36} alt="Bombay Falooda" className="h-full w-full rounded-[8px] object-cover" />
                </div>
                <div className="mt-5 space-y-2">
                  {["B", "K", "O", "P"].map((item, index) => (
                    <div key={item} className={`flex h-8 items-center justify-center rounded-[9px] text-[11px] font-bold ${index === 0 ? "bg-[#f3b33d] text-[#17110f]" : "bg-white/10 text-white/68"}`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#c2415d]">Overview</p>
                    <p className="mt-1 text-sm font-bold text-[#17110f]">Welcome back, Counter</p>
                  </div>
                  <span className="rounded-full bg-[#fff4e1] px-3 py-1 text-[10px] font-bold text-[#9a6512]">Today</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    ["₹18.4K", "Sales"],
                    ["26", "Bills"],
                    ["9", "Held"],
                    ["4", "Queue"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-[11px] border border-[#f0dfd3] bg-white p-2.5">
                      <p className="text-xs font-black text-[#17110f]">{value}</p>
                      <p className="mt-1 text-[10px] font-bold text-[#9b8d85]">{label}</p>
                      <div className="mt-2 h-4 rounded-full bg-[linear-gradient(90deg,#c2415d,#f3b33d)] opacity-45" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[12px] border border-[#f0dfd3] bg-[#fffaf6] p-3">
                  <div className="mb-3 flex items-center justify-between text-xs font-bold text-[#7d6b62]">
                    <span>Live bill flow</span>
                    <span>POS-Ready</span>
                  </div>
                  <div className="space-y-2">
                    {[82, 58, 74, 46].map((width, index) => (
                      <div key={index} className="h-2 rounded-full bg-[#f2e4dc]">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#f3b33d)]" style={{ width: `${width}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-5 flex max-w-[445px] items-center justify-center gap-5 text-[10px] font-bold text-[#9b8d85]">
            <span>Trusted by Bombay Falooda outlets</span>
            <span>KOT</span>
            <span>Billing</span>
            <span>Digital Orders</span>
          </div>
        </aside>

        <div className="flex h-screen items-center justify-center overflow-hidden bg-white px-6 py-5">
          <div className="w-full max-w-[350px]">
            <div className="mb-4 text-right text-xs font-semibold text-[#7d6b62]">
              Assigned outlet device? <span className="font-bold text-[#c2415d]">Sign in</span>
            </div>
            <form onSubmit={onSubmit} className="rounded-[16px] border border-[#eadbd1] bg-white p-5 shadow-[0_20px_54px_rgba(42,32,27,0.09)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff4e1]">
                <span className="text-lg font-black text-[#c2415d]">BF</span>
              </div>
              <div className="mt-4 text-center">
                <h2 className="font-display text-xl font-bold text-[#17110f]">Welcome back</h2>
                <p className="mt-2 text-xs font-semibold text-[#7d6b62]">
                  Sign in to continue to Bombay Falooda POS.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#5f4f47]">Access key</span>
                  <input className="h-9 w-full rounded-[9px] border border-[#eadbd1] bg-white px-3 text-xs font-semibold text-[#17110f] outline-none transition placeholder:text-[#9b8d85] focus:border-[#c2415d] focus:shadow-[0_0_0_4px_rgba(194,65,93,0.1)]" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} placeholder="POS-XXXXXXXXXXXX" required />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#5f4f47]">PIN</span>
                  <input className="h-9 w-full rounded-[9px] border border-[#eadbd1] bg-white px-3 text-xs font-semibold text-[#17110f] outline-none transition placeholder:text-[#9b8d85] focus:border-[#c2415d] focus:shadow-[0_0_0_4px_rgba(194,65,93,0.1)]" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Enter your POS PIN" type="password" required />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#5f4f47]">Device code</span>
                  <input className="h-9 w-full rounded-[9px] border border-[#eadbd1] bg-white px-3 text-xs font-semibold text-[#17110f] outline-none transition placeholder:text-[#9b8d85] focus:border-[#c2415d] focus:shadow-[0_0_0_4px_rgba(194,65,93,0.1)]" value={deviceCode} onChange={(event) => setDeviceCode(event.target.value)} placeholder="Optional device identifier" />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                <label className="flex items-center gap-2 text-[#7d6b62]">
                  <input className="h-3.5 w-3.5 accent-[#c2415d]" type="checkbox" defaultChecked />
                  Remember me
                </label>
                <span className="text-[#c2415d]">Forgot PIN?</span>
              </div>

              {error ? (
                <div className="mt-5 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}

              <button type="submit" disabled={loading} className="mt-5 flex h-9 w-full items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#c2415d,#f3b33d)] text-xs font-bold text-white shadow-[0_16px_30px_rgba(194,65,93,0.2)] transition hover:-translate-y-0.5 disabled:opacity-60">
                {loading ? "Checking terminal..." : "Sign In"}
              </button>

              <div className="my-4 flex items-center gap-4">
                <span className="h-px flex-1 bg-[#eadbd1]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9b8d85]">or continue with</span>
                <span className="h-px flex-1 bg-[#eadbd1]" />
              </div>

              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={loading}
                className="flex h-10 w-full items-center justify-center gap-3 rounded-[9px] border border-[#eadbd1] bg-white text-xs font-bold text-[#17110f] shadow-2xs hover:bg-slate-50 transition active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
              <p className="mt-4 text-center text-[11px] font-semibold text-[#9b8d85]">
                Your terminal session is secured and outlet-linked.
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
