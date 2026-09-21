"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Shield, DollarSign, CheckCircle2, AlertTriangle, ArrowLeft, Send, Lock, FileText, Check } from "lucide-react";

export default function BountyProgramDetail() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [safeHarborAccepted, setSafeHarborAccepted] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Submission Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [affectedScopeId, setAffectedScopeId] = useState("");
  const [severityClaimed, setSeverityClaimed] = useState("high");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
    ? "https://api.cyberguardian.ai"
    : "http://127.0.0.1:8000";

  useEffect(() => {
    if (!programId) return;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiHost}/api/v1/bounty/programs/${programId}`);
        if (res.ok) {
          const data = await res.json();
          setProgram(data);
          // Auto select first in-scope target if available
          const firstInScope = data.scopes?.find((s: any) => s.in_scope);
          if (firstInScope) setAffectedScopeId(firstInScope.id);
        }
      } catch (err) {
        console.error("Failed to load program details", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [programId, apiHost]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!safeHarborAccepted) {
      setErrorMsg("You must accept the Safe Harbor Legal Terms before submitting a report.");
      return;
    }

    if (!affectedScopeId) {
      setErrorMsg("Please select an affected in-scope target.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiHost}/api/v1/bounty/programs/${programId}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          description,
          steps_to_reproduce: stepsToReproduce,
          affected_scope_id: affectedScopeId,
          severity_claimed: severityClaimed,
        }),
      });

      if (res.ok) {
        setSuccessMsg("Vulnerability report submitted successfully! Redirecting to triage dashboard...");
        setTimeout(() => {
          router.push("/bounty/triage");
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.detail || "Report submission failed.");
      }
    } catch (err) {
      setErrorMsg("Network Error: Failed to reach backend bounty submission API.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0A0D14] text-slate-400 p-10 text-center">Loading program rules...</div>;
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-slate-200 p-10 text-center space-y-4">
        <p>Bounty Program not found.</p>
        <Link href="/bounty" className="text-blue-400 underline">← Return to Bug Bounty Portal</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-sans p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/bounty"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Bounty Portal
          </Link>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
            ● Active Program
          </span>
        </div>

        {/* Program Title Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 space-y-4">
          <h1 className="text-3xl font-extrabold text-white">{program.name}</h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
            {program.description || "Public Coordinated Vulnerability Disclosure & Bug Bounty Program."}
          </p>
        </div>

        {/* Scope Matrix & Reward Tiers Split */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Scope & Safe Harbor */}
          <div className="md:col-span-2 space-y-6">
            {/* Scope Matrix */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> Target Asset Scope Matrix
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                      <th className="py-2.5 px-3">Asset Type</th>
                      <th className="py-2.5 px-3">Target Endpoint</th>
                      <th className="py-2.5 px-3">Scope Status</th>
                      <th className="py-2.5 px-3">Rules &amp; Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {program.scopes?.map((sc: any) => (
                      <tr key={sc.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 capitalize font-semibold text-slate-300">{sc.asset_type}</td>
                        <td className="py-3 px-3 font-mono font-bold text-white">{sc.target}</td>
                        <td className="py-3 px-3">
                          {sc.in_scope ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> In Scope
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded text-[10px] border border-red-500/20 line-through">
                              <AlertTriangle className="w-3 h-3" /> Out of Scope
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 italic">{sc.notes || "Standard rules apply"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Safe Harbor Legal Agreement */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> Safe Harbor Authorization Statement
              </h2>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed max-h-48 overflow-y-auto">
                {program.safe_harbor_text}
              </div>

              <label className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={safeHarborAccepted}
                  onChange={(e) => setSafeHarborAccepted(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-700 focus:ring-0 bg-slate-900"
                />
                <span className="text-xs font-semibold text-blue-200">
                  I accept the Safe Harbor Authorization Terms and agree to test strictly within specified in-scope targets.
                </span>
              </label>
            </div>
          </div>

          {/* Right Column: Reward Matrix & Submit Action */}
          <div className="space-y-6">
            {/* Reward Tiers Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Reward Tiers
              </h2>

              <div className="space-y-2.5">
                {program.reward_tiers?.map((rt: any) => (
                  <div key={rt.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{rt.severity}</span>
                    <span className="text-sm font-extrabold text-emerald-400">
                      ${rt.min_amount.toLocaleString()} - ${rt.max_amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Box */}
            <div className="bg-gradient-to-b from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl p-6 space-y-4 text-center">
              <Shield className="w-10 h-10 text-blue-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Ready to Submit a Finding?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Accept Safe Harbor terms and submit your detailed Proof of Concept for triage verification.
              </p>

              <button
                type="button"
                onClick={() => {
                  if (!safeHarborAccepted) {
                    alert("Please accept the Safe Harbor Terms before submitting.");
                    return;
                  }
                  setShowSubmitModal(true);
                }}
                className="w-full py-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" /> Submit Vulnerability Report
              </button>
            </div>
          </div>
        </div>

        {/* Submit Report Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 md:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" /> Submit Vulnerability Report
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="text-slate-400 hover:text-white font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-400">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
                  ✅ {successMsg}
                </div>
              )}

              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Select Target Affected Scope Item *
                  </label>
                  <select
                    value={affectedScopeId}
                    onChange={(e) => setAffectedScopeId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choose Affected Target --</option>
                    {program.scopes?.map((sc: any) => (
                      <option
                        key={sc.id}
                        value={sc.id}
                        disabled={!sc.in_scope}
                        className={!sc.in_scope ? "text-slate-500 line-through" : ""}
                      >
                        {sc.target} ({sc.asset_type}) {!sc.in_scope ? "[OUT OF SCOPE - REJECTED]" : "[IN SCOPE]"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Claimed Severity *
                  </label>
                  <select
                    value={severityClaimed}
                    onChange={(e) => setSeverityClaimed(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Vulnerability Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IDOR in User Account Parameter Endpoint"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Vulnerability Summary &amp; Impact *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the vulnerability, root cause, and potential security impact..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Detailed Steps to Reproduce (PoC) *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="1. Send HTTP GET request to endpoint...&#10;2. Modify user_id parameter...&#10;3. Observe response exposing unauthorized records..."
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 font-mono resize-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5"
                  >
                    {submitting ? "Submitting..." : "Submit Report"}
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
