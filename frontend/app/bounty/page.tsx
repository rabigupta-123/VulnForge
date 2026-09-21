"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Search, DollarSign, Globe, Award, ArrowRight, ExternalLink } from "lucide-react";

export default function PublicBountyPortal() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("all");

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
    ? "https://api.cyberguardian.ai"
    : "http://127.0.0.1:8000";

  useEffect(() => {
    const fetchPrograms = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiHost}/api/v1/bounty/programs/public`);
        if (res.ok) {
          const data = await res.json();
          setPrograms(data);
        }
      } catch (err) {
        console.error("Failed to load public bounty programs", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
  }, [apiHost]);

  const filteredPrograms = programs.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-sans p-6 md:p-10">
      {/* Header Navigation */}
      <header className="max-w-7xl mx-auto flex items-center justify-between pb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">CyberGuardian Bug Bounty Platform</h1>
            <p className="text-xs text-slate-400">Coordinated Vulnerability Disclosure &amp; Researcher Rewards</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/bounty/triage"
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
          >
            Org Triage Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-10 space-y-8">
        {/* Banner */}
        <div className="relative rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/20 p-8 overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Award className="w-3.5 h-3.5" /> Authorized Researcher Workspace
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              Discover Vulnerabilities, Protect Assets, Earn Bounties
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Submit verified security reports for active targets in full compliance with owner-published Safe Harbor statements. Every submission is triaged by security engineers.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search programs by company or target domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="text-xs text-slate-400">
            Showing <strong className="text-white">{filteredPrograms.length}</strong> active programs
          </div>
        </div>

        {/* Program Cards Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">Loading active bug bounty programs...</div>
        ) : filteredPrograms.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-slate-800/80 space-y-3">
            <Globe className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No active public bounty programs found</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Organization administrators can create new programs from the Org Triage Dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrograms.map((program) => {
              const maxReward = program.reward_tiers?.reduce((acc: number, r: any) => Math.max(acc, r.max_amount || 0), 0) || 0;
              return (
                <div
                  key={program.id}
                  className="rounded-xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/40 transition-all p-6 flex flex-col justify-between space-y-4 hover:shadow-xl group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                        {program.name}
                      </h3>
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {program.description || "Public bounty program for target domain assets."}
                    </p>

                    {/* Scopes Overview */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[11px] font-semibold text-slate-400">In-Scope Targets ({program.scopes_count}):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {program.scopes?.slice(0, 3).map((sc: any) => (
                          <span
                            key={sc.id}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              sc.in_scope
                                ? "bg-slate-800 text-slate-300 border-slate-700"
                                : "bg-red-500/10 text-red-400 border-red-500/20 line-through"
                            }`}
                          >
                            {sc.target}
                          </span>
                        ))}
                        {program.scopes?.length > 3 && (
                          <span className="text-[10px] text-slate-500 self-center">+{program.scopes.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Stats & Button */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold block">Bounty Reward Up To</span>
                      <span className="text-base font-extrabold text-emerald-400 flex items-center gap-0.5">
                        <DollarSign className="w-4 h-4" /> {maxReward > 0 ? maxReward.toLocaleString() : "1,000+"}
                      </span>
                    </div>

                    <Link
                      href={`/bounty/${program.id}`}
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20"
                    >
                      View Program <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
