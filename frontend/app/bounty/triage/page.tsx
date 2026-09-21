"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, CheckCircle2, Clock, AlertCircle, DollarSign, MessageSquare, Plus, ArrowLeft, Filter } from "lucide-react";

export default function OrgTriageDashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showCreateProgramModal, setShowCreateProgramModal] = useState(false);

  // Triage update form state
  const [triageStatus, setTriageStatus] = useState("triaging");
  const [confirmedSeverity, setConfirmedSeverity] = useState("high");
  const [cvssScore, setCvssScore] = useState<number>(7.5);
  const [rewardAmount, setRewardAmount] = useState<number>(500);
  const [updating, setUpdating] = useState(false);

  // Comment Thread state
  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  // New Program Modal state
  const [programName, setProgramName] = useState("");
  const [programDesc, setProgramDesc] = useState("");
  const [targetScope, setTargetScope] = useState("");
  const [safeHarbor, setSafeHarbor] = useState("We guarantee safe harbor for security researchers operating in good faith under these terms.");
  const [creatingProgram, setCreatingProgram] = useState(false);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
    ? "https://api.cyberguardian.ai"
    : "http://127.0.0.1:8000";

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiHost}/api/v1/bounty/reports`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error("Failed to load triage reports", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [apiHost]);

  const handleOpenReportModal = async (report: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiHost}/api/v1/bounty/reports/${report.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const detail = await res.json();
        setSelectedReport(detail);
        setTriageStatus(detail.status || "triaging");
        setConfirmedSeverity(detail.severity_confirmed || detail.severity_claimed || "high");
        setCvssScore(detail.cvss_score || 7.5);
        setRewardAmount(detail.reward_amount || 500);
      }
    } catch (err) {
      console.error("Failed to load report detail", err);
    }
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    setUpdating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiHost}/api/v1/bounty/reports/${selectedReport.id}/triage`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: triageStatus,
          severity_confirmed: confirmedSeverity,
          cvss_score: Number(cvssScore),
          reward_amount: Number(rewardAmount),
        }),
      });

      if (res.ok) {
        fetchReports();
        setSelectedReport(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !commentBody.trim()) return;

    setSendingComment(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiHost}/api/v1/bounty/reports/${selectedReport.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          body: commentBody,
          is_internal: isInternal,
        }),
      });

      if (res.ok) {
        setCommentBody("");
        handleOpenReportModal(selectedReport);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingComment(false);
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingProgram(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiHost}/api/v1/bounty/programs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: programName,
          description: programDesc,
          visibility: "public",
          safe_harbor_text: safeHarbor,
          scopes: [
            { asset_type: "domain", target: targetScope || "*.yourcompany.com", in_scope: true, notes: "Primary in-scope target" },
            { asset_type: "domain", target: "staging.yourcompany.com", in_scope: false, notes: "Explicitly out of scope" }
          ],
          reward_tiers: [
            { severity: "critical", min_amount: 1000, max_amount: 5000, currency: "USD" },
            { severity: "high", min_amount: 500, max_amount: 1500, currency: "USD" },
            { severity: "medium", min_amount: 100, max_amount: 500, currency: "USD" }
          ]
        }),
      });

      if (res.ok) {
        setShowCreateProgramModal(false);
        setProgramName("");
        setProgramDesc("");
        setTargetScope("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingProgram(false);
    }
  };

  const columns = [
    { id: "submitted", title: "Submitted Queue", color: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
    { id: "triaging", title: "Under Triage", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
    { id: "accepted", title: "Accepted / Bountied", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
    { id: "resolved", title: "Resolved / Remediated", color: "border-purple-500/40 text-purple-400 bg-purple-500/10" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-sans p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link href="/bounty" className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Triage &amp; Bounty Operations Queue</h1>
              <p className="text-xs text-slate-400">Review submissions, validate severity, award bounties, and communicate with researchers</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateProgramModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Bug Bounty Program
          </button>
        </header>

        {/* Kanban Board */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">Loading triage queue...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {columns.map((col) => {
              const colReports = reports.filter((r) => {
                if (col.id === "accepted") return ["accepted", "rewarded"].includes(r.status);
                if (col.id === "resolved") return ["resolved", "disclosed"].includes(r.status);
                return r.status === col.id;
              });

              return (
                <div key={col.id} className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 space-y-3 min-h-[500px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-extrabold border ${col.color}`}>
                      {col.title}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{colReports.length}</span>
                  </div>

                  <div className="space-y-3">
                    {colReports.map((rep) => (
                      <div
                        key={rep.id}
                        onClick={() => handleOpenReportModal(rep)}
                        className="bg-slate-950 border border-slate-800 hover:border-blue-500/50 p-4 rounded-xl space-y-2 cursor-pointer transition-all hover:shadow-lg group"
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Target: {rep.target}
                        </span>
                        <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                          {rep.title}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-800/60">
                          <span className="text-slate-400 font-semibold">{rep.researcher_name}</span>
                          <span className="text-emerald-400 font-bold">
                            {rep.reward_amount ? `$${rep.reward_amount}` : rep.severity_claimed?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Triage Report Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 md:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Report #{selectedReport.id.slice(0, 8)}</span>
                  <h3 className="text-lg font-bold text-white">{selectedReport.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="text-slate-400 hover:text-white font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Triage Decision Form */}
              <form onSubmit={handleSaveTriage} className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
                  <select
                    value={triageStatus}
                    onChange={(e) => setTriageStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  >
                    <option value="submitted">Submitted</option>
                    <option value="triaging">Under Triage</option>
                    <option value="accepted">Accepted</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="informative">Informative</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Confirmed Severity</label>
                  <select
                    value={confirmedSeverity}
                    onChange={(e) => setConfirmedSeverity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CVSS Score</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={cvssScore}
                    onChange={(e) => setCvssScore(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reward ($)</label>
                  <input
                    type="number"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-emerald-400 font-bold"
                  />
                </div>

                <div className="col-span-2 md:col-span-4 flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                  >
                    {updating ? "Saving..." : "Save Triage Decision"}
                  </button>
                </div>
              </form>

              {/* Technical Proof of Concept */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Vulnerability Details &amp; Steps to Reproduce</h4>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {selectedReport.steps_to_reproduce || selectedReport.description}
                </div>
              </div>

              {/* Threaded Comments & Internal Notes */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-400" /> Triage Communication Thread
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedReport.comments?.map((c: any) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-lg text-xs ${
                        c.is_internal
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-200"
                          : "bg-slate-950 border border-slate-800 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span>{c.is_internal ? "🔒 INTERNAL TRIAGER NOTE" : "PUBLIC RESEARCHER COMMENT"}</span>
                        <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Type message to researcher or internal note..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold px-2">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    Internal Only
                  </label>
                  <button
                    type="submit"
                    disabled={sendingComment}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white"
                  >
                    Post
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Create Program Modal */}
        {showCreateProgramModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white">Create New Bug Bounty Program</h3>

              <form onSubmit={handleCreateProgram} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Program Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp Web & API Bounty"
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Program description..."
                    value={programDesc}
                    onChange={(e) => setProgramDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Primary Target Scope *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. *.acme.com"
                    value={targetScope}
                    onChange={(e) => setTargetScope(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateProgramModal(false)}
                    className="px-3 py-1.5 rounded text-xs bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingProgram}
                    className="px-4 py-1.5 rounded text-xs font-bold bg-blue-600 text-white"
                  >
                    {creatingProgram ? "Creating..." : "Launch Program"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
