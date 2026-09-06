"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  UserCheck,
  Shield,
  Phone,
  Mail,
  Clock,
  RefreshCw,
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getPosToken, getSavedPosContext, type PosContext } from "@/lib/auth";

type TeamMember = {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  checkInTime: string;
};

export default function PosTeamMembersPage() {
  const router = useRouter();
  const [context, setContext] = useState<PosContext | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getPosToken();
    const savedContext = getSavedPosContext();
    if (!token || !savedContext) {
      router.replace("/login");
      return;
    }
    setContext(savedContext);
    void fetchTeamMembers();
  }, [router]);

  async function fetchTeamMembers() {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<TeamMember[]>("/pos-terminal/team-members");
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team members");
    } finally {
      setLoading(false);
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
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Team Members Present Today</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                  {members.length} Staff Online
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
          onClick={fetchTeamMembers}
          className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto p-4 md:p-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-[#b82e46] text-white font-black text-sm flex items-center justify-center shadow-2xs">
                    {member.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{member.fullName}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Shield className="h-3 w-3 text-slate-400" />
                      <span className="text-[11px] font-semibold text-slate-500">{member.role}</span>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  <span>{member.status}</span>
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                {member.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> Mobile
                    </span>
                    <span className="font-mono font-medium">{member.phone}</span>
                  </div>
                )}
                {member.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </span>
                    <span className="font-medium text-slate-700">{member.email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Shift Check-in
                  </span>
                  <span className="font-mono font-bold text-slate-800">{member.checkInTime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
