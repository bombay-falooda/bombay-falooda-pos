"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GstComplianceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/terminal/bill-printing");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-500 font-medium text-xs">
      Loading print queue...
    </div>
  );
}
