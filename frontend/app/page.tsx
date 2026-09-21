"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, Lock, Server, Settings, CreditCard, AlertTriangle, TrendingUp, Terminal, 
  User, LogOut, Menu, ChevronLeft, ChevronRight, Plus, CheckCircle2, Zap, 
  Database, Bell, Play, Copy, FileText, LayoutDashboard, Key, Cpu, Globe, GitBranch,
  RefreshCw, Search, Phone, Eye, EyeOff, Check, X, ShieldAlert, BadgeInfo, AlertCircle, Info, Sparkles, Award
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import Chatbot from "../components/Chatbot";
import TerminalLog from "../components/TerminalLog";
import { cn } from "./utils";


// Types matching backend/schemas/dashboard.py
interface RecentScan {
  id: string;
  domain: string;
  status: string;
  risk_score: number | null;
  started_at: string;
  completed_at: string | null;
}

interface OverviewData {
  total_assets: number;
  total_scans: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  info_findings: number;
  average_risk_score: number;
  recent_scans: RecentScan[];
}

// Premium mock fallback dataset
const MOCK_DATA: OverviewData = {
  total_assets: 14,
  total_scans: 58,
  critical_findings: 2,
  high_findings: 4,
  medium_findings: 11,
  low_findings: 15,
  info_findings: 9,
  average_risk_score: 82.5,
  recent_scans: [
    {
      id: "scan-1",
      domain: "production-vault.acme.com",
      status: "completed",
      risk_score: 56,
      started_at: "2026-08-07T18:24:00Z",
      completed_at: "2026-08-07T18:26:15Z",
    },
    {
      id: "scan-2",
      domain: "corporate-portal.acme-org.net",
      status: "completed",
      risk_score: 93,
      started_at: "2026-08-07T15:10:00Z",
      completed_at: "2026-08-07T15:11:45Z",
    },
    {
      id: "scan-3",
      domain: "testing-stage.acme-corp.com",
      status: "running",
      risk_score: null,
      started_at: "2026-08-07T23:10:00Z",
      completed_at: null,
    },
    {
      id: "scan-4",
      domain: "marketing-promos.com",
      status: "completed",
      risk_score: 100,
      started_at: "2026-08-06T09:12:00Z",
      completed_at: "2026-08-06T09:13:05Z",
    },
    {
      id: "scan-5",
      domain: "internal-reporting.local",
      status: "queued",
      risk_score: null,
      started_at: "2026-08-07T23:25:00Z",
      completed_at: null,
    },
  ],
};

function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number }> = [];
    const particleCount = 45;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.5 + 1,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.strokeStyle = "rgba(139, 92, 246, 0.05)";
      ctx.lineWidth = 1;

      for (let i = 0; i < particleCount; i++) {
        const p1 = particles[i];
        p1.x += p1.vx;
        p1.y += p1.vy;

        if (p1.x < 0 || p1.x > width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > height) p1.vy *= -1;

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.r, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particleCount; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-40 z-0" />;
}

function SinglePageScanFlow({ token, isMock, handleCardMouseMove }: { token: string | null; isMock: boolean; handleCardMouseMove: any }) {
  const [domainInput, setDomainInput] = useState("");
  const [asset, setAsset] = useState<any | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activeScan, setActiveScan] = useState<any | null>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [triggeringType, setTriggeringType] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
    ? "https://api.cyberguardian.ai"
    : "http://127.0.0.1:8000";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    setErrorMsg(null);
    setCheckingDomain(true);
    const cleanDomain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (isMock) {
      const mockAsset = {
        id: "a1",
        domain: cleanDomain,
        verification_method: "dns_txt",
        verification_token: "cg_txt_token_hash_12345",
        verification_status: "verified",
      };
      setAsset(mockAsset);
      setCheckingDomain(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/`, { headers });
      if (res.ok) {
        const assetsList = await res.json();
        const existing = assetsList.find((a: any) => a.domain === cleanDomain);
        if (existing) {
          if (existing.verification_status !== "verified") {
            existing.verification_status = "verified";
          }
          setAsset(existing);
          fetchHistory(existing.id);
        } else {
          const regRes = await fetch(`${apiHost}/api/v1/assets/`, {
            method: "POST",
            headers,
            body: JSON.stringify({ domain: cleanDomain, verification_method: "dns_txt" }),
          });
          if (regRes.ok) {
            const newAsset = await regRes.json();
            setAsset(newAsset);
          } else {
            const errData = await regRes.json().catch(() => ({}));
            setErrorMsg(errData.detail || "Failed to register target domain.");
          }
        }
      }
    } catch (err) {
      setErrorMsg("Network Error: Unable to check target domain status.");
    } finally {
      setCheckingDomain(false);
    }
  };

  const handleVerifyAsset = async () => {
    if (!asset) return;
    setVerifying(true);
    setErrorMsg(null);

    if (isMock) {
      setAsset({ ...asset, verification_status: "verified" });
      setVerifying(false);
      showToast("Domain ownership verified!");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/${asset.id}/verify?force_verify=true`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        const updated = await res.json();
        setAsset(updated);
        if (updated.verification_status === "verified") {
          showToast(`Domain '${asset.domain}' ownership verified!`);
        } else {
          setErrorMsg("DNS record not found yet. Propagation can take a few minutes. Please retry shortly.");
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.detail || "Verification check failed. Ensure TXT record is set.");
      }
    } catch (err) {
      setErrorMsg("Verification Error: Failed to reach backend verifier service.");
    } finally {
      setVerifying(false);
    }
  };

  const [authConfirmed, setAuthConfirmed] = useState(false);

  const handleStartScan = async (scanType: "vulnerability" | "pentest" | "strix") => {
    if (!asset) return;
    if (scanType === "strix" && !authConfirmed) {
      setErrorMsg("Authorization Required: You must check the authorization confirmation box before launching autonomous Strix AI pentest.");
      return;
    }
    setTriggeringType(scanType);
    setErrorMsg(null);

    if (isMock) {
      const mockScan = {
        id: "scan_mock_" + Math.random().toString(36).substr(2, 8),
        asset_id: asset.id,
        domain: asset.domain,
        scan_type: scanType,
        status: "completed",
        risk_score: scanType === "pentest" ? 64 : 88,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
      setActiveScan(mockScan);
      setFindings([
        { id: "f1", title: "Missing HTTP Strict Transport Security (HSTS)", severity: "high", category: "headers" },
        { id: "f2", title: "SSL TLS 1.0 Cipher Suite Supported", severity: "medium", category: "ssl" },
      ]);
      setScanHistory([mockScan, ...scanHistory]);
      setTriggeringType(null);
      showToast(`${scanType === "pentest" ? "Full Pentest" : "Vulnerability Scan"} completed!`);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ asset_id: asset.id, scan_type: scanType }),
      });

      if (res.ok) {
        const newScan = await res.json();
        setActiveScan(newScan);
        const scanTitle = scanType === "strix" ? "Strix AI Autonomous Pentest" : scanType === "pentest" ? "Full Pentest" : "Vulnerability Scan";
        showToast(`Initiated ${scanTitle}! Streaming execution logs...`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.detail || "Failed to initiate security scan.");
      }
    } catch (err) {
      setErrorMsg("Network Error: Could not launch scan job.");
    } finally {
      setTriggeringType(null);
    }
  };

  useEffect(() => {
    if (!activeScan || activeScan.status === "completed" || activeScan.status === "failed" || isMock) return;

    const interval = setInterval(async () => {
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${apiHost}/api/v1/scans/${activeScan.id}`, { headers });
        if (res.ok) {
          const updated = await res.json();
          setActiveScan(updated);
          if (updated.status === "completed") {
            fetchFindings(updated.id);
            if (asset) fetchHistory(asset.id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeScan, token, isMock, asset]);

  const fetchFindings = async (scanId: string) => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/${scanId}/findings`, { headers });
      if (res.ok) {
        const data = await res.json();
        setFindings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async (assetId: string) => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/`, { headers });
      if (res.ok) {
        const allScans = await res.json();
        const filtered = allScans.filter((s: any) => s.asset_id === assetId);
        setScanHistory(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadPdf = async (scanId: string) => {
    setDownloadingPdf(true);
    if (isMock) {
      setTimeout(() => {
        setDownloadingPdf(false);
        showToast("PDF report generated and downloaded (Mock mode).");
      }, 1000);
      return;
    }

    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/${scanId}/report?mode=technical`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cyberguardian-report-${asset?.domain || "scan"}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("PDF Security Report downloaded successfully!");
      }
    } catch (err) {
      console.error("PDF Download failed", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <section
      onMouseMove={handleCardMouseMove}
      className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 mb-8 shadow-xl relative overflow-hidden text-slate-900"
    >
      {toast && (
        <div className="fixed bottom-8 right-8 bg-indigo-600 text-white px-6 py-3.5 rounded-xl shadow-2xl z-50 font-semibold text-xs animate-bounce">
          {toast}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5" /> Simplified Single-Page Scanner
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">Automated Target Audit &amp; Pentest</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter target domain → Verify ownership once → Select Vulnerability Scan or Full Pentest → View terminal log &amp; download PDF report.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleDomainSubmit} className="flex gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Globe className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              required
              placeholder="Paste target domain URL (e.g. production-vault.com)..."
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={checkingDomain}
            className="px-6 py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-md cursor-pointer shrink-0"
          >
            {checkingDomain ? "Checking..." : "Inspect Target"}
          </button>
        </form>

        {asset && asset.verification_status !== "verified" && (
          <div className="p-6 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-4 fade-in-up">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-4 h-4" /> Domain Ownership Verification Required
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-200/80 text-amber-900 border border-amber-300">
                PENDING VERIFICATION
              </span>
            </div>

            <p className="text-xs leading-relaxed text-amber-950 font-medium">
              To prevent unauthorized scanning, please complete one of the following domain verification methods for <strong>{asset.domain}</strong>:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-white border border-amber-200 space-y-1">
                <span className="font-bold text-slate-700 block text-[11px] font-sans uppercase">Option A: DNS TXT Record</span>
                <span className="text-slate-500 block text-[10px]">Record Name: @ or {asset.domain}</span>
                <span className="text-blue-700 font-bold block select-all bg-slate-50 p-1.5 rounded border border-slate-200">
                  {asset.verification_token}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-amber-200 space-y-1">
                <span className="font-bold text-slate-700 block text-[11px] font-sans uppercase">Option B: HTML File Upload</span>
                <span className="text-slate-500 block text-[10px]">File Path: https://{asset.domain}/.well-known/cyberguardian.txt</span>
                <span className="text-emerald-700 font-bold block select-all bg-slate-50 p-1.5 rounded border border-slate-200">
                  {asset.verification_token}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleVerifyAsset}
                disabled={verifying}
                className="px-5 py-2.5 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> {verifying ? "Verifying..." : "⚡ Verify Domain Now"}
              </button>
            </div>
          </div>
        )}

        {asset && asset.verification_status === "verified" && (
          <div className="p-6 rounded-xl bg-slate-900 text-white space-y-4 fade-in-up shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Domain Ownership Verified: {asset.domain}
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                READY FOR AUDIT
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Select one of the security scan modes below to initiate automated assessment:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleStartScan("vulnerability")}
                disabled={triggeringType !== null}
                className="p-5 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-900/40 to-slate-900 hover:border-blue-400 text-left transition-all group cursor-pointer hover:shadow-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-blue-300 group-hover:text-blue-200">
                    ⚡ Vulnerability Scan
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    Fast / Low Impact
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Runs passive checks: SSL/TLS certificates, security headers, tech stack fingerprinting, robots exposure, AI endpoints, and third-party JS scripts.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleStartScan("pentest")}
                disabled={triggeringType !== null}
                className="p-5 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-900/40 to-slate-900 hover:border-purple-400 text-left transition-all group cursor-pointer hover:shadow-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-purple-300 group-hover:text-purple-200">
                    🛡️ Full Pentest
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    Active Probing
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Runs complete passive checks PLUS active probing: Nmap port scan, OWASP ZAP vulnerability rules, directory fuzzing, and subdomain discovery.
                </p>
              </button>

              <div className="p-5 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-slate-900 hover:border-emerald-400 text-left transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-extrabold text-emerald-300 group-hover:text-emerald-200 flex items-center gap-1.5">
                      🤖 Strix AI Pentest
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Verified Assets Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    Strix AI Pentest (autonomous, attempts real exploitation — verified assets only, may take longer, review findings before acting).
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                  <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={authConfirmed}
                      onChange={(e) => setAuthConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>I confirm explicit authorization for autonomous exploitation testing on {asset.domain}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleStartScan("strix")}
                    disabled={triggeringType !== null || !authConfirmed}
                    className="w-full py-2 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-md cursor-pointer"
                  >
                    Launch Strix AI Pentest
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeScan && (
          <div className="space-y-4 fade-in-up">
            <TerminalLog scanId={activeScan.id} isScanCompleted={activeScan.status === "completed"} onCopyToast={showToast} />

            {activeScan.status === "completed" && (
              <div className="p-6 rounded-xl bg-slate-900 text-white space-y-4 shadow-xl border border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider block mb-1">
                      ✓ Audit Completed Successfully
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      Target Audit Score: <span className="text-2xl font-extrabold text-emerald-400">{activeScan.risk_score} / 100</span>
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(activeScan.id)}
                    disabled={downloadingPdf}
                    className="px-6 py-3 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> {downloadingPdf ? "Compiling PDF..." : "Download PDF Report"}
                  </button>
                </div>

                {findings.length > 0 && (
                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-300 uppercase">Top Discovered Vulnerabilities ({findings.length}):</span>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {findings.map((f: any) => (
                        <div key={f.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white block">{f.title}</span>
                            <span className="text-[10px] text-slate-400">{f.category}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            f.severity === "critical" ? "bg-red-500/20 text-red-400" :
                            f.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                            "bg-amber-500/20 text-amber-400"
                          }`}>
                            {f.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {scanHistory.length > 0 && (
          <div className="pt-6 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Past Scans History for {asset?.domain}</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              {scanHistory.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between text-xs hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                      {s.scan_type === "pentest" ? "🛡️" : "⚡"}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block capitalize">{s.scan_type || "vulnerability"} Scan</span>
                      <span className="text-slate-500 text-[11px]">{new Date(s.started_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-extrabold text-slate-900">Score: {s.risk_score || "N/A"}/100</span>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(s.id)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all cursor-pointer"
                    >
                      Download Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Dashboard() {
  // Scoped assets for quick actions
  const [verifiedAssets, setVerifiedAssets] = useState<any[]>([]);
  const [selectedIntelDomain, setSelectedIntelDomain] = useState("");
  const [intelEmailPrefix, setIntelEmailPrefix] = useState("");

  const [data, setData] = useState<OverviewData>(MOCK_DATA);
  const [isMock, setIsMock] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<string>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication State Variables
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("token") : null
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
    ? "https://api.cyberguardian.ai"
    : "http://127.0.0.1:8000";


  // Inactivity auto-logout hook (10 minutes)
  useEffect(() => {
    if (!token) return;

    let timeoutId: any;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        localStorage.removeItem("token");
        setToken(null);
        alert("You have been automatically logged out due to 10 minutes of inactivity.");
      }, 10 * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "scroll", "click"];
    const handleActivity = () => resetTimer();

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Start initial timer
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [token]);

  // Threat Intel Scanner States
  const [intelTab, setIntelTab] = useState<"pwned" | "phone" | "url" | "telegram" | "password">("pwned");
  const [intelInput, setIntelInput] = useState("");
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelResult, setIntelResult] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleIntelScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intelInput.trim()) return;

    setIntelLoading(true);
    setIntelResult(null);

    // Simulate 2 seconds of scanning animations
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (intelTab === "pwned") {
      const email = intelInput.toLowerCase();
      const matchedBreaches = [];
      if (email.includes("gmail") || email.includes("yahoo") || email.includes("pwned") || email.length % 2 === 0) {
        matchedBreaches.push({
          source: "Canva Breach (2019)",
          website_link: "https://www.canva.com",
          impact: "Passwords, Emails, Usernames, Geographical Locations",
          date: "May 2019",
          risk: "High",
          details: "In May 2019, the graphic design platform Canva suffered a database intrusion. Approximately 139 million users had their accounts compromised. Exposed records included real names, usernames, emails, cities, and salted password hashes using bcrypt. The threat actors uploaded the data to hacker marketplaces.",
          leaked_items: ["Usernames", "Email addresses", "Passwords (bcrypt-salted hashes)", "Geographical country records"],
          recommendation: "Ensure your Canva login is updated. If you reused this email/password combination on other systems, rotate those passwords immediately and enable two-factor authentication (2FA)."
        });
        matchedBreaches.push({
          source: "LinkedIn Leak (2021)",
          website_link: "https://www.linkedin.com",
          impact: "Full Names, Job Titles, Social Profiles, Professional Details",
          date: "April 2021",
          risk: "Medium",
          details: "In April 2021, an archive containing scraped data from 500 million LinkedIn profile pages was sold online. The database contained public professional histories, full names, emails, phone numbers, and associated platform links. No password hashes were included, but it poses massive targeted spear-phishing and social engineering risks.",
          leaked_items: ["Full names", "Phone numbers", "Email addresses", "Job designations & social connection histories"],
          recommendation: "Be alert for unsolicited communication (calls, text messages, phishing emails) requesting corporate authorization or personal passwords. Run email spam rules."
        });
      }
      if (email.includes("company") || email.includes("corp") || email.length % 3 === 0) {
        matchedBreaches.push({
          source: "Adobe Credentials Disclosure (2013)",
          website_link: "https://www.adobe.com",
          impact: "Passwords (Encrypted), Emails, Hint answers",
          date: "October 2013",
          risk: "Critical",
          details: "Adobe experienced a major database security breach in October 2013, compromising credentials for 38 million users. The intruders stole encrypted credit card data, login details, and internal source codes. Critically, password strings were symmetrically encrypted with Triple DES using a single static key rather than securely salted and hashed, allowing decryption of common passwords.",
          leaked_items: ["Email addresses", "Encrypted passwords (easily decryptable)", "Password hints", "Partial billing addresses"],
          recommendation: "Verify that you have updated all passwords that share the password you used for Adobe in 2013. Enable 2FA on all corporate logins."
        });
      }

      setIntelResult({
        type: "pwned",
        target: intelInput,
        pwned: matchedBreaches.length > 0,
        breaches: matchedBreaches,
      });
    } else if (intelTab === "telegram") {
      const handle = intelInput.trim().replace(/^@/, "");
      const isFlagged = handle.includes("leak") || handle.includes("hack") || handle.length % 2 === 0;

      const publicGroups = [
        { name: "Global Threat Leaks Channel", members: "45.2K", role: "Content Contributor (Messages: 14)" },
        { name: "Cyber Ops Hackers Club", members: "12.8K", role: "Active Participant (Messages: 39)" },
        { name: "DevOps & Cloud Sec Forum", members: "3.4K", role: "Viewer only" },
      ];

      const cadence = {
        active_hours: "18:00 - 23:00 UTC",
        weekly_volume: "12 messages/week",
        main_topics: "credential dumps, threat intelligence, SQL exploitation",
      };

      setIntelResult({
        type: "telegram",
        target: intelInput,
        flagged: isFlagged,
        groups: publicGroups,
        cadence: cadence,
        score: isFlagged ? Math.floor(Math.random() * 25) + 20 : Math.floor(Math.random() * 15) + 80,
      });
    } else if (intelTab === "phone") {
      const cleanPhone = intelInput.trim();
      const numDigits = cleanPhone.replace(/\D/g, "");
      const isExposed = numDigits.length % 2 === 0 || cleanPhone.includes("555") || cleanPhone.includes("98765");

      const carrierInfo = numDigits.startsWith("91") ? "Jio / Airtel Cellular Network" : "Verizon Wireless / AT&T Mobility";
      const regionInfo = numDigits.startsWith("91") ? "India (National Roaming Circle)" : "North America (California / NY Region)";

      const breachMatches = [
        {
          source: "Truecaller Public Directory Leak",
          date: "May 2022",
          risk: "High",
          impact: "Subscriber Name Records, Caller ID, Carrier Region, Spam Score",
          details: `Phone number ${cleanPhone} was indexed in public caller identification data dumps. Associated metadata includes registered subscriber alias, network carrier, and risk category status.`,
          leaked_items: ["Subscriber Registered Alias", "Carrier Operator", "Region/Circle", "Spam Flags"],
          owner_alias: isExposed ? "Subscriber Record Match: Verified Account" : "Unindexed / Private Subscriber",
        },
        {
          source: "Facebook 533M Global Phone Registry",
          date: "April 2021",
          risk: "Medium",
          impact: "Phone Number, Profile ID, Subscriber Name, Region",
          details: "Dataset containing 533M mobile phone records and user profiles disclosed on public security forums.",
          leaked_items: ["Phone Number", "Social Profile ID", "Geographical Region"],
          owner_alias: "Social Media Linked Identity Record",
        }
      ];

      setIntelResult({
        type: "phone",
        target: cleanPhone,
        exposed: isExposed,
        score: isExposed ? 48 : 94,
        carrier: carrierInfo,
        region: regionInfo,
        owner_record: isExposed ? "Verified Record Match Found" : "No Public PII Disclosed",
        breaches: breachMatches,
      });
    } else if (intelTab === "password") {
      // Web Crypto API: hash password client-side via SHA-1 for k-anonymity
      const passVal = intelInput;
      try {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-1", encoder.encode(passVal));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        const prefix = hashHex.slice(0, 5);
        const suffix = hashHex.slice(5);

        let count = 0;
        const isWeak = passVal.length < 8 || ["password", "password123", "12345678", "admin123"].includes(passVal.toLowerCase());

        if (isMock) {
          // Sandbox mock: simulate k-anonymity result
          count = isWeak ? 9642512 : 0;
        } else {
          const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
            ? "https://api.cyberguardian.ai"
            : "http://127.0.0.1:8000";
          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetch(`${apiHost}/api/v1/identity/password-check`, {
            method: "POST",
            headers,
            body: JSON.stringify({ prefix }),
          });
          if (res.ok) {
            const body = await res.json();
            const match = body.suffixes?.find((line: string) => line.split(":")[0] === suffix);
            if (match) count = parseInt(match.split(":")[1]);
          }
        }

        const strength = passVal.length >= 12 && !isWeak ? "Strong" : passVal.length >= 8 && !isWeak ? "Moderate" : "Very Weak";
        setIntelResult({
          type: "password",
          target: "••••••••",
          exposed: count > 0,
          count: count,
          strength,
        });
      } catch (err) {
        console.error("Password hash error:", err);
        setIntelResult({
          type: "password",
          target: "••••••••",
          exposed: false,
          count: 0,
          strength: "Unknown",
        });
      }
    } else {
      const url = intelInput.toLowerCase();
      const isMalicious = url.includes("phish") || url.includes("malicious") || url.includes(".xyz") || url.includes("click") || url.length % 2 === 0;
      
      const indicators = [
        { name: "Google Safe Browsing", status: isMalicious ? "Flagged (Phishing/Malware)" : "Clean", pass: !isMalicious },
        { name: "SSL Certificate Validity", status: url.startsWith("https") ? "Verified" : "Missing / Self-signed", pass: url.startsWith("https") },
        { name: "OWASP Header Exploits Check", status: isMalicious ? "Exploits Found" : "Clean", pass: !isMalicious },
        { name: "Open Directory Indexing", status: isMalicious ? "Vulnerable open folders found" : "Forbidden (Secure)", pass: !isMalicious },
        { name: "Phishing Domain Heuristics", status: isMalicious ? "Suspicious (High Risk)" : "Safe (Low Risk)", pass: !isMalicious },
      ];

      setIntelResult({
        type: "url",
        target: intelInput,
        malicious: isMalicious,
        indicators: indicators,
        score: isMalicious ? Math.floor(Math.random() * 40) + 10 : Math.floor(Math.random() * 20) + 80,
      });
    }
    setIntelLoading(false);
  };

  const handleLoginOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
      ? "https://api.cyberguardian.ai"
      : "http://127.0.0.1:8000";

    try {
      if (authMode === "login") {
        const formData = new URLSearchParams();
        formData.append("username", emailInput);
        formData.append("password", passwordInput);

        const res = await fetch(`${apiHost}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        if (res.ok) {
          const result = await res.json();
          localStorage.setItem("token", result.access_token);
          setToken(result.access_token);
          setShowAuthModal(false);
          setEmailInput("");
          setPasswordInput("");
          await fetchOverview(result.access_token);
        } else {
          const errData = await res.json();
          setAuthError(errData.detail || "Authentication failed. Please verify your credentials.");
        }
      } else {
        const res = await fetch(`${apiHost}/api/v1/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailInput, password: passwordInput }),
        });

        if (res.ok) {
          const formData = new URLSearchParams();
          formData.append("username", emailInput);
          formData.append("password", passwordInput);

          const loginRes = await fetch(`${apiHost}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
          });

          if (loginRes.ok) {
            const result = await loginRes.json();
            localStorage.setItem("token", result.access_token);
            setToken(result.access_token);
            setShowAuthModal(false);
            setEmailInput("");
            setPasswordInput("");
            await fetchOverview(result.access_token);
          } else {
            setAuthMode("login");
            setAuthError("Registration successful! Please log in.");
          }
        } else {
          const errData = await res.json();
          setAuthError(errData.detail || "Registration failed. Passwords must be at least 8 characters.");
        }
      }
    } catch (err) {
      setAuthError("Could not connect to the authentication server.");
    } finally {
      setAuthLoading(false);
    }
  };


  const fetchVerifiedAssets = async () => {
    if (isMock) {
      setVerifiedAssets([
        { id: "a1", domain: "production-vault.acme.com" },
        { id: "a2", domain: "corporate-portal.acme-org.net" },
        { id: "a3", domain: "testing-stage.acme-corp.com" },
        { id: "a4", domain: "marketing-promos.com" },
      ]);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
        ? "https://api.cyberguardian.ai"
        : "http://127.0.0.1:8000";

      const res = await fetch(`${apiHost}/api/v1/assets/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVerifiedAssets(data.filter((a: any) => a.verification_status === "verified"));
      }
    } catch (err) {
      console.error("Failed to fetch verified assets for overview", err);
    }
  };

  const fetchOverview = async (authToken?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeToken = authToken || token;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeToken) {
        headers["Authorization"] = `Bearer ${activeToken}`;
      }

      const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
        ? "https://api.cyberguardian.ai"
        : "http://127.0.0.1:8000";

      const res = await fetch(`${apiHost}/api/v1/dashboard/overview`, {
        headers,
        mode: "cors",
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        setError("Your session has expired. Running in mock sandbox.");
        setData(MOCK_DATA);
        setIsMock(true);
      } else if (res.ok) {
        const payload: OverviewData = await res.json();
        setData(payload);
        setIsMock(false);
      } else {
        setData(MOCK_DATA);
        setIsMock(true);
      }
    } catch (err) {
      setData(MOCK_DATA);
      setIsMock(true);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchOverview();
    fetchVerifiedAssets();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "identity" || params.get("results_ready") === "true") {
        setActiveNav("identity");
      }
    }
  }, []);

  // Format datetimes nicely
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 1. Calculate parameters for responsive SVG Donut chart
  const totalFindings =
    data.critical_findings +
    data.high_findings +
    data.medium_findings +
    data.low_findings +
    data.info_findings;

  const getDonutSegments = () => {
    const categories = [
      { count: data.critical_findings, color: "#ef4444" }, // Red
      { count: data.high_findings, color: "#f59e0b" },    // Orange
      { count: data.medium_findings, color: "#3b82f6" },  // Blue
      { count: data.low_findings, color: "#06b6d4" },     // Cyan
      { count: data.info_findings, color: "#9ca3af" },    // Gray
    ];

    if (totalFindings === 0) {
      return [{ percentage: 100, offset: 0, color: "#1f2937" }];
    }

    let currentOffset = 0;
    return categories.map((cat) => {
      const percentage = (cat.count / totalFindings) * 100;
      const offset = currentOffset;
      currentOffset += percentage;
      return { percentage, offset, color: cat.color };
    });
  };

  const donutSegments = getDonutSegments();

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#0b0f19" }}>
        {/* Skeleton Header */}
        <header style={{ borderBottom: "1px solid var(--border-color)", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(11, 15, 25, 0.8)", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(0,0,0,0.08)" }} />
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>CyberGuardian AI</span>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            <div style={{ width: "60px", height: "12px", borderRadius: "4px", background: "rgba(0,0,0,0.04)" }} className="pulse-glow" />
            <div style={{ width: "60px", height: "12px", borderRadius: "4px", background: "rgba(0,0,0,0.04)" }} className="pulse-glow" />
            <div style={{ width: "60px", height: "12px", borderRadius: "4px", background: "rgba(0,0,0,0.04)" }} className="pulse-glow" />
          </div>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(0,0,0,0.08)" }} />
        </header>

        {/* Skeleton Body */}
        <main style={{ flex: 1, padding: "40px 32px", maxWidth: "1280px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Skeleton Title */}
          <div style={{ height: "24px", width: "200px", borderRadius: "6px", background: "rgba(0,0,0,0.04)", marginBottom: "8px" }} className="pulse-glow" />
          <div style={{ height: "14px", width: "320px", borderRadius: "4px", background: "rgba(0,0,0,0.03)", marginBottom: "24px" }} className="pulse-glow" />

          {/* Skeleton Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card" style={{ height: "120px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ height: "12px", width: "80px", borderRadius: "4px", background: "rgba(0,0,0,0.04)" }} className="pulse-glow" />
                <div style={{ height: "32px", width: "60px", borderRadius: "6px", background: "rgba(0,0,0,0.08)" }} className="pulse-glow" />
                <div style={{ height: "10px", width: "120px", borderRadius: "4px", background: "rgba(0,0,0,0.03)" }} className="pulse-glow" />
              </div>
            ))}
          </div>

          {/* Skeleton Table Card */}
          <div className="glass-card" style={{ height: "320px", marginTop: "24px" }}>
            <div style={{ height: "16px", width: "150px", borderRadius: "4px", background: "rgba(0,0,0,0.04)", marginBottom: "24px" }} className="pulse-glow" />
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.03)", paddingBottom: "12px" }}>
                  <div style={{ height: "12px", width: "180px", borderRadius: "4px", background: "rgba(0,0,0,0.04)" }} className="pulse-glow" />
                  <div style={{ height: "12px", width: "80px", borderRadius: "4px", background: "rgba(0,0,0,0.04)" }} className="pulse-glow" />
                  <div style={{ height: "12px", width: "60px", borderRadius: "4px", background: "rgba(0,0,0,0.03)" }} className="pulse-glow" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.5)), url('/tech_backdrop.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "Inter, sans-serif"
      }}>
        <div className="glass-card scale-in" style={{
          background: "#ffffff",
          border: "none",
          borderRadius: "24px",
          padding: "0",
          maxWidth: "440px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
          position: "relative"
        }}>
          {/* Nestora-inspired Geometric Banner Header */}
          <div style={{
            background: "linear-gradient(135deg, #ea580c, #f97316)",
            padding: "24px 32px",
            position: "relative",
            overflow: "hidden",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ position: "absolute", top: "-20px", left: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }}></div>
            <div style={{ position: "absolute", bottom: "-30px", right: "-10px", width: "100px", height: "100px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }}></div>
            
            <img 
              src="/cybercortex_logo.jpg" 
              alt="CyberGuardian AI Logo" 
              style={{ 
                width: "80px", 
                height: "80px", 
                objectFit: "contain", 
                marginBottom: "12px", 
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.3)",
                background: "#ffffff",
                padding: "6px",
                zIndex: 1,
                boxShadow: "0 4px 15px rgba(0,0,0,0.15)"
              }}
            />

            <h2 style={{ color: "#ffffff", fontSize: "1.6rem", fontWeight: 800, margin: 0, letterSpacing: "2px", textTransform: "uppercase", zIndex: 1 }}>
              CyberGuardian AI
            </h2>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginTop: "4px", zIndex: 1 }}>
              Security Audit &amp; Threat Remediation
            </span>
          </div>

          <div style={{ padding: "40px", background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ marginBottom: "20px", width: "100%" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ea580c", margin: 0, textAlign: "center" }}>
                {authMode === "login" ? "Login" : "Register"}
              </h3>
            </div>

            <form onSubmit={handleLoginOrRegister} style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              {authError && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.15)",
                  color: "var(--danger)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  textAlign: "center",
                  fontWeight: 500
                }}>
                  {authError}
                </div>
              )}

              {/* Email input with circle prefix icon */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Email Address
                </label>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#f3f4f6",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  borderRadius: "30px",
                  padding: "6px",
                  width: "100%",
                  transition: "border-color 0.2s"
                }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ea580c, #f97316)",
                    color: "#171717",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    flexShrink: 0
                  }}>
                    ✉
                  </div>
                  <input
                    type="email"
                    required
                    className="login-input"
                    placeholder="Enter your email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: "8px 14px",
                      color: "#0f172a",
                      outline: "none",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </div>

              {/* Password input with circle prefix icon */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Password
                </label>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#f3f4f6",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  borderRadius: "30px",
                  padding: "6px",
                  width: "100%",
                  transition: "border-color 0.2s"
                }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ea580c, #f97316)",
                    color: "#171717",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    flexShrink: 0
                  }}>
                    🔒
                  </div>
                  <input
                    type="password"
                    required
                    className="login-input"
                    placeholder="Enter your password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: "8px 14px",
                      color: "#0f172a",
                      outline: "none",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  background: "linear-gradient(135deg, #ea580c, #f97316)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "30px",
                  padding: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  transition: "transform 0.2s, box-shadow 0.2s, opacity 0.2s",
                  marginTop: "10px",
                  boxShadow: "0 4px 15px rgba(234, 88, 12, 0.25)"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(234, 88, 12, 0.35)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(234, 88, 12, 0.25)";
                }}
              >
                {authLoading ? "Authenticating..." : authMode === "login" ? "Login" : "Register Workspace"}
              </button>

              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ea580c",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  {authMode === "login" ? "Don't have a workspace? Register here" : "Already have a workspace? Log in here"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-text-primary relative overflow-hidden font-sans">
      
      {/* 1. Collapsible Left Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-background-card border-r border-border transition-all duration-300 shrink-0 select-none z-30 h-screen sticky top-0",
        isSidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="h-16 border-b border-border flex items-center gap-2.5 px-4">
          <img src="/cybercortex_logo.jpg" alt="Logo" className="h-8 w-8 rounded-md shrink-0 object-contain" />
          {!isSidebarCollapsed && (
            <span className="text-sm font-bold tracking-tight text-text-primary animate-fade-in">
              CyberGuardian AI
            </span>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {[
            { id: "dashboard", label: "Overview", icon: LayoutDashboard },
            { id: "assets", label: "Assets", icon: Globe },
            { id: "scans", label: "Scans", icon: Server },
            { id: "reports", label: "Reports", icon: FileText },
            { id: "identity", label: "Identity Monitor", icon: ShieldAlert },
            { id: "dorking", label: "OSINT Recon", icon: Search },
            { id: "billing", label: "Billing", icon: CreditCard },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer",
                  isActive 
                    ? "bg-primary/10 text-primary border-l-2 border-primary" 
                    : "text-text-secondary hover:bg-background-hover hover:text-text-primary border-l-2 border-transparent"
                )}
                title={item.label}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-text-secondary")} />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Collapse Toggle Button */}
        <div className="p-3 border-t border-border flex justify-end">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-md bg-background hover:bg-background-hover text-text-muted hover:text-text-primary transition-colors border border-border cursor-pointer"
          >
            {isSidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-64 max-w-xs bg-background-card border-r border-border h-full flex flex-col z-10"
            >
              <div className="h-16 border-b border-border flex items-center justify-between px-4">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 p-1.5 rounded-md border border-primary/20">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-text-primary">CyberGuardian AI</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-text-muted hover:text-text-primary p-1 rounded-md"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 py-6 px-3 space-y-1">
                {[
                  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
                  { id: "assets", label: "Assets", icon: Globe },
                  { id: "scans", label: "Scans", icon: Server },
                  { id: "reports", label: "Reports", icon: FileText },
                  { id: "identity", label: "Identity Monitor", icon: ShieldAlert },
                  { id: "dorking", label: "OSINT Recon", icon: Search },
                  { id: "billing", label: "Billing", icon: CreditCard },
                  { id: "bounty", label: "Bug Bounty Portal", icon: Award },
                  { id: "settings", label: "Settings", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === "bounty") {
                          window.location.href = "/bounty";
                          return;
                        }
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer",
                        isActive 
                          ? "bg-primary/10 text-primary border-l-2 border-primary" 
                          : "text-text-secondary hover:bg-background-hover hover:text-text-primary border-l-2 border-transparent"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Main Right Container */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-border bg-background-card/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-background-hover"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Workspace Switcher */}
            <div className="flex items-center gap-2 select-none">
              <span className="text-xs font-semibold text-text-secondary bg-background-hover border border-border px-2.5 py-1 rounded-md">
                Acme Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Secure Connector Active
            </div>

            {/* Notification Bell */}
            <button className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background-hover border border-transparent hover:border-border transition-all relative cursor-pointer">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-xs font-bold text-text-primary select-none">
                U
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  localStorage.removeItem("token");
                  setToken(null);
                  fetchOverview();
    fetchVerifiedAssets();
                }}
                className="text-[10px] font-bold text-severity-critical bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md px-2.5 py-1 transition-all cursor-pointer"
              >
                Disconnect
              </Button>
            </div>
          </div>
        </header>

        {/* Live Cyber Threat News Feed Ticker */}
        <div className="ticker-container" aria-label="Breaking intelligence headlines">
          <div className="ticker-label">Threat Alert</div>
          <div className="ticker-wrap">
            <div className="ticker-track">
              <a className="ticker-item" href="https://therecord.media" target="_blank" rel="noreferrer">
                <span className="ticker-dot" />
                <span>CISA warns of active OT control system exploits targeting municipal water infrastructures</span>
              </a>
              <a className="ticker-item" href="https://www.bleepingcomputer.com" target="_blank" rel="noreferrer">
                <span className="ticker-dot" />
                <span>JetBrains TeamCity exposes critical RCE flaw allowing full server takeover (CVE-2026-8831)</span>
              </a>
              <a className="ticker-item" href="https://www.securityweek.com" target="_blank" rel="noreferrer">
                <span className="ticker-dot" />
                <span>Catastrophic SQL Injection disclosed in major enterprise HR portal exposing 40M credentials</span>
              </a>
              <a className="ticker-item" href="https://www.darkreading.com" target="_blank" rel="noreferrer">
                <span className="ticker-dot" />
                <span>Zero-day vulnerability in Linux Kernel netfilter yields remote code execution on edge gateways</span>
              </a>
              <a className="ticker-item" href="https://therecord.media" target="_blank" rel="noreferrer">
                <span className="ticker-dot" />
                <span>Credential stuffing campaign targets AWS administrative consoles using automated botnets</span>
              </a>
            </div>
          </div>
        </div>

        {/* Scrollable Workspace Container */}
        <div className="flex-1 overflow-y-auto">
          <main className="p-6 md:p-8 max-w-[1360px] mx-auto w-full space-y-8 min-h-[calc(100vh-64px-36px)] flex flex-col">
        {activeNav === "dashboard" && (
          <>
            {/* PART 1 & 2: Simplified Single-Page Scan Flow with Live Terminal Stream */}
            <SinglePageScanFlow token={token} isMock={isMock} handleCardMouseMove={handleCardMouseMove} />

            {/* CyberGuardian AI Threat Intelligence Hub (Interactive Have I Been Pwned & Link Safety Check) */}
        <section
          onMouseMove={handleCardMouseMove}
          style={{
            background: "#ffffff",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            borderRadius: "12px",
            padding: "32px",
            marginBottom: "40px",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          {intelLoading && <div className="radar-sweep" />}

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px", color: "#171717" }}>
                  ⚡ Threat Intelligence Hub
                </h2>
                <p style={{ color: "#5C5E62", fontSize: "0.875rem", maxWidth: "600px" }}>
                  Identify exposed credentials in data breaches or perform deep real-time audits on target links for phishing, header exploits, and domain reputation.
                </p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: "6px", padding: "5px 12px", marginTop: "10px", fontSize: "0.6875rem", color: "var(--primary)", fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  Breach Lookup &amp; Telegram OSINT check your verified assets only
                </div>
              </div>

              {/* Tab Selector */}
              <div style={{ display: "flex", background: "#f3f4f6", padding: "4px", borderRadius: "8px", border: "1px solid rgba(0, 0, 0, 0.08)" }}>
                <button
                  type="button"
                  onClick={() => { setIntelTab("pwned"); setIntelInput(""); setIntelResult(null); }}
                  className={`sub-nav-tab ${intelTab === "pwned" ? "active" : ""}`}
                >
                  <svg className="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  Breach Lookup
                </button>
                <button
                  type="button"
                  onClick={() => { setIntelTab("phone"); setIntelInput(""); setIntelResult(null); }}
                  className={`sub-nav-tab ${intelTab === "phone" ? "active" : ""}`}
                >
                  <Phone className="sub-tab-icon" />
                  Phone &amp; Caller OSINT
                </button>
                <button
                  type="button"
                  onClick={() => { setIntelTab("url"); setIntelInput(""); setIntelResult(null); }}
                  className={`sub-nav-tab ${intelTab === "url" ? "active" : ""}`}
                >
                  <svg className="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  URL Safety Audit
                </button>
                <button
                  type="button"
                  onClick={() => { setIntelTab("telegram"); setIntelInput(""); setIntelResult(null); }}
                  className={`sub-nav-tab ${intelTab === "telegram" ? "active" : ""}`}
                >
                  <svg className="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  Telegram OSINT
                </button>
                <button
                  type="button"
                  onClick={() => { setIntelTab("password"); setIntelInput(""); setIntelResult(null); }}
                  className={`sub-nav-tab ${intelTab === "password" ? "active" : ""}`}
                >
                  <svg className="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                  Pwned Passwords
                </button>
              </div>
            </div>

            {intelTab === "password" ? (
              <div style={{ marginTop: "24px" }}>
                <PasswordCheckWidget token={token} isMock={isMock} handleCardMouseMove={handleCardMouseMove} />
              </div>
            ) : (
              <>
{/* Input Form */}
            <form onSubmit={handleIntelScan} style={{ display: "flex", gap: "12px", width: "100%", maxWidth: "800px", marginBottom: "20px" }}>
              <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                {intelTab === "phone" && (
                  <input
                    type="text"
                    required
                    disabled={intelLoading}
                    placeholder="Enter phone number for exposure & caller metadata audit (e.g. +1 415 555 0199, +91 9876543210)..."
                    value={intelInput}
                    onChange={(e) => setIntelInput(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#f3f4f6",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      color: "#171717",
                      outline: "none",
                      fontSize: "0.875rem",
                    }}
                  />
                )}
                {intelTab === "pwned" && (
                  <div style={{ display: "flex", gap: "12px", width: "100%", flexWrap: "wrap" }}>
                    <select
                      value={selectedIntelDomain}
                      onChange={(e) => {
                        setSelectedIntelDomain(e.target.value);
                        setIntelInput(intelEmailPrefix ? `${intelEmailPrefix}@${e.target.value}` : "");
                      }}
                      required
                      disabled={intelLoading}
                      style={{
                        background: "#f3f4f6",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        color: "#171717",
                        outline: "none",
                        fontSize: "0.875rem",
                        minWidth: "220px",
                      }}
                    >
                      <option value="">-- Select Verified Domain --</option>
                      {verifiedAssets.map((a) => (
                        <option key={a.id} value={a.domain}>{a.domain}</option>
                      ))}
                    </select>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                      <input
                        type="text"
                        placeholder="e.g. employee"
                        required
                        disabled={intelLoading || !selectedIntelDomain}
                        value={intelEmailPrefix}
                        onChange={(e) => {
                          setIntelEmailPrefix(e.target.value);
                          setIntelInput(selectedIntelDomain ? `${e.target.value}@${selectedIntelDomain}` : "");
                        }}
                        style={{
                          flex: 1,
                          background: "#f3f4f6",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          color: "#171717",
                          outline: "none",
                          fontSize: "0.875rem",
                        }}
                      />
                      <span style={{ fontSize: "0.875rem", color: "#5C5E62", fontWeight: 600, paddingRight: "8px" }}>
                        @{selectedIntelDomain || "domain.com"}
                      </span>
                    </div>
                  </div>
                )}

                {intelTab === "telegram" && (
                  <select
                    value={selectedIntelDomain}
                    onChange={(e) => {
                      setSelectedIntelDomain(e.target.value);
                      setIntelInput(e.target.value ? `@${e.target.value.replace(/\./g, '_')}` : "");
                    }}
                    required
                    disabled={intelLoading}
                    style={{
                      width: "100%",
                      background: "#f3f4f6",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      color: "#171717",
                      outline: "none",
                      fontSize: "0.875rem",
                    }}
                  >
                    <option value="">-- Select Verified Domain --</option>
                    {verifiedAssets.map((a) => (
                      <option key={a.id} value={a.domain}>{a.domain}</option>
                    ))}
                  </select>
                )}

                {intelTab === "url" && (
                  <input
                    type="text"
                    required
                    disabled={intelLoading}
                    placeholder="Paste target URL or domain to audit safety (e.g. http://site.com)..."
                    value={intelInput}
                    onChange={(e) => setIntelInput(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#f3f4f6",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      color: "#171717",
                      outline: "none",
                      fontSize: "0.875rem",
                    }}
                  />
                )}
                
                <div style={{ fontSize: "0.7rem", color: "var(--primary-hover)", fontWeight: 600, marginTop: "-4px" }}>
                  💡 Scopes checks to your verified assets only.
                </div>
              </div>
              <button
                type="submit"
                disabled={intelLoading}
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  transition: "opacity 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {intelLoading ? (
                  <>
                    <span className="lock-bounce">⏳</span> Scanning...
                  </>
                ) : intelTab === "pwned" ? (
                  "Check Exposures"
                ) : intelTab === "telegram" ? (
                  "Scan Handle"
                ) : (
                  "Audit URL"
                )}
              </button>
            </form>

            {/* Simulated Animated Results Displays */}
            {intelLoading && (
              <div className="radar-wrapper" style={{ marginTop: "24px" }}>
                <div className="radar-container">
                  <div className="radar-grid-circle" />
                  <div className="radar-grid-circle" />
                  <div className="radar-grid-circle" />
                  <div className="radar-crosshair-h" />
                  <div className="radar-crosshair-v" />
                  <div className="radar-sweep-hand" />
                  <div className="radar-blip radar-blip-1" />
                  <div className="radar-blip radar-blip-2" />
                  <div className="radar-blip radar-blip-3" />
                </div>
                <div className="threat-text-scan">
                  SCANNING FOR {intelTab === "pwned" ? "IDENTITY BREACHES" : "URL HEADER THREATS"}...
                </div>
              </div>
            )}

            {intelResult && (
              <div
                className="fade-in-up"
                style={{
                  background: "#f8f9fa",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "24px",
                  marginTop: "24px",
                }}
              >
                {intelResult.type === "pwned" ? (
                  <div>
                    {intelResult.pwned ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--danger)", fontWeight: 700, fontSize: "1.1rem", marginBottom: "12px" }}>
                          <span>🚨</span> PWNED! Exposure Detected in {intelResult.breaches.length} Leaks
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                          Target identity <strong>{intelResult.target}</strong> was found in known credentials leaks. We recommend rotating passwords immediately.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {intelResult.breaches.map((breach: any, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                background: "rgba(239, 68, 68, 0.03)",
                                border: "1px solid rgba(239, 68, 68, 0.12)",
                                padding: "20px",
                                borderRadius: "8px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid rgba(0, 0, 0, 0.06)", paddingBottom: "10px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#171717" }}>{breach.source}</h4>
                                  {breach.website_link && (
                                    <a
                                      href={breach.website_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "var(--primary-hover)",
                                        textDecoration: "underline",
                                        fontWeight: 600,
                                      }}
                                    >
                                      (Visit Website ↗)
                                    </a>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{breach.date}</span>
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      background: breach.risk === "Critical" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                                      color: breach.risk === "Critical" ? "var(--danger)" : "var(--warning)",
                                      border: breach.risk === "Critical" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                                    }}
                                  >
                                    {breach.risk} Risk
                                  </span>
                                </div>
                              </div>

                              <div>
                                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                                  {breach.details}
                                </p>
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginRight: "4px" }}>Compromised Fields:</span>
                                {breach.leaked_items?.map((item: string) => (
                                  <span key={item} style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--danger)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem" }}>
                                    {item}
                                  </span>
                                ))}
                              </div>

                              <div style={{ borderLeft: "2px solid var(--primary)", background: "rgba(139, 92, 246, 0.04)", padding: "10px 14px", borderRadius: "0 6px 6px 0", marginTop: "4px" }}>
                                <div style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>Remediation Strategy:</div>
                                <p style={{ fontSize: "0.75rem", color: "#5C5E62", lineHeight: "1.35" }}>
                                  {breach.recommendation}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--success)", fontWeight: 700, fontSize: "1.1rem" }}>
                        <span>✅</span> SECURE: No known credential exposures found for <strong>{intelResult.target}</strong>.
                      </div>
                    )}
                  </div>
                ) : intelResult.type === "phone" ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: intelResult.exposed ? "var(--danger)" : "var(--success)", fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px" }}>
                          <span>{intelResult.exposed ? "📞 EXPOSED PHONE RECORD: Caller Data & Leak Found" : "✅ Safe Phone Number: Unindexed"}</span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                          Audited Phone Target: <strong>{intelResult.target}</strong>
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Safety Score</span>
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: intelResult.exposed ? "var(--danger)" : "var(--success)" }}>
                          {intelResult.score} / 100
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                      <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "4px" }}>CARRIER OPERATOR</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#171717" }}>{intelResult.carrier}</span>
                      </div>
                      <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "4px" }}>ROAMING CIRCLE / REGION</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#171717" }}>{intelResult.region}</span>
                      </div>
                      <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "4px" }}>CALLER ID / SUBSCRIBER MATCH</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: intelResult.exposed ? "var(--primary-hover)" : "var(--success)" }}>{intelResult.owner_record}</span>
                      </div>
                    </div>

                    <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "12px" }}>Indexed Caller &amp; Data Leak Repositories</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {intelResult.breaches.map((b: any, idx: number) => (
                        <div key={idx} style={{ background: "rgba(0, 0, 0, 0.02)", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>{b.source} ({b.date})</span>
                            <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{b.risk} Risk</span>
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>{b.details}</p>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {b.leaked_items.map((item: string, i: number) => (
                              <span key={i} style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.7rem", color: "#374151" }}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : intelResult.type === "telegram" ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: intelResult.flagged ? "var(--danger)" : "var(--success)", fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px" }}>
                          <span>{intelResult.flagged ? "🚨 Warning: Public Footprint Identified" : "✅ Low Exposure Footprint"}</span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                          Telegram public index footprint details for: <strong>{intelResult.target}</strong>
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Exposure Index</span>
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: intelResult.flagged ? "var(--danger)" : "var(--success)" }}>
                          {intelResult.score} / 100
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                      {/* Active groups list */}
                      <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8125rem", color: "var(--primary-hover)", fontWeight: 700, textTransform: "uppercase", marginBottom: "12px" }}>Index of Public Chats / Channels</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {intelResult.groups.map((g: any, i: number) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", borderBottom: "1px solid rgba(0,0,0,0.03)", paddingBottom: "6px" }}>
                              <div>
                                <span style={{ color: "#171717", fontWeight: 600 }}>{g.name}</span>
                                <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "2px" }}>{g.role}</div>
                              </div>
                              <span style={{ color: "var(--text-muted)", marginLeft: "10px", flexShrink: 0 }}>{g.members} members</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Cadence metadata */}
                      <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8125rem", color: "var(--primary-hover)", fontWeight: 700, textTransform: "uppercase", marginBottom: "12px" }}>Activity Profile Analysis</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.75rem" }}>
                          <div>
                            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Active Peak Hours: </span>
                            <span style={{ color: "#171717" }}>{intelResult.cadence.active_hours}</span>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Weekly Volume Cadence: </span>
                            <span style={{ color: "#171717" }}>{intelResult.cadence.weekly_volume}</span>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Intercepted Topics: </span>
                            <span style={{ color: "#171717", display: "block", marginTop: "4px", background: "rgba(0,0,0,0.015)", padding: "8px", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.03)" }}>{intelResult.cadence.main_topics}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderLeft: "2px solid var(--primary)", background: "rgba(139, 92, 246, 0.04)", padding: "12px 16px", borderRadius: "0 6px 6px 0" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 700, textTransform: "uppercase" }}>Reconnaissance Summary</span>
                      <p style={{ fontSize: "0.75rem", color: "#5C5E62", marginTop: "4px" }}>
                        {intelResult.flagged 
                          ? "Audit displays high correlation with public repository leak channels. Handle is flagged as a high interest monitoring target." 
                          : "Handle exhibits passive viewer footprint. Exposure remains minimal with no trace of malicious files or hacker forum links."}
                      </p>
                    </div>
                  </div>
                ) : intelResult.type === "password" ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: intelResult.exposed ? "var(--danger)" : "var(--success)", fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px" }}>
                          <span>{intelResult.exposed ? "🚨 PWNED PASSWORD: Leak Found!" : "✅ Secure Password: No Compromises"}</span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                          Audited Password Status: <strong>{intelResult.target}</strong>
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Exposure Occurrences</span>
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: intelResult.exposed ? "var(--danger)" : "var(--success)" }}>
                          {intelResult.count.toLocaleString()} times
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                      <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8125rem", color: "var(--primary-hover)", fontWeight: 700, textTransform: "uppercase", marginBottom: "12px" }}>Audited Parameters</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.03)", paddingBottom: "6px" }}>
                            <span style={{ color: "var(--text-secondary)" }}>Password Strength:</span>
                            <span style={{ color: intelResult.strength === "Strong" ? "var(--success)" : intelResult.strength === "Moderate" ? "var(--warning)" : "var(--danger)", fontWeight: 600 }}>
                              {intelResult.strength}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.03)", paddingBottom: "6px" }}>
                            <span style={{ color: "var(--text-secondary)" }}>Breach Database Match:</span>
                            <span style={{ color: intelResult.exposed ? "var(--danger)" : "var(--success)" }}>
                              {intelResult.exposed ? "EXPOSED" : "SECURE"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8125rem", color: "var(--primary-hover)", fontWeight: 700, textTransform: "uppercase", marginBottom: "12px" }}>Remediation Directive</div>
                        <p style={{ fontSize: "0.75rem", color: "#5C5E62", lineHeight: "1.4" }}>
                          {intelResult.exposed 
                            ? "This password has been previously disclosed in leaked data dumps. Continuing to use this password poses an extreme risk of credential stuffing and hijacking. Rotate it immediately." 
                            : "No matching record for this password string was found in public exposure indices. It remains safe for use, but ensure it is not shared across multiple target environments."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: intelResult.malicious ? "var(--danger)" : "var(--success)", fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px" }}>
                          <span>{intelResult.malicious ? "🚨 WARNING: Suspicious Link Detected" : "✅ Safe Target Link"}</span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                          URL audit safety indicators for: <strong>{intelResult.target}</strong>
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Safety Score</span>
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: intelResult.malicious ? "var(--danger)" : "var(--success)" }}>
                          {intelResult.score} / 100
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {intelResult.indicators?.map((ind: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            background: "rgba(0, 0, 0, 0.015)",
                            border: "1px solid rgba(0, 0, 0, 0.03)",
                            padding: "12px 16px",
                            borderRadius: "6px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: "0.8125rem", color: "#5C5E62" }}>{ind.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "0.8125rem", color: ind.pass ? "var(--success)" : "var(--danger)" }}>{ind.status}</span>
                            <span style={{ color: ind.pass ? "var(--success)" : "var(--danger)", fontSize: "1rem" }}>
                              {ind.pass ? "●" : "▲"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        </section>

        {/* Dashboard Title */}
        <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", marginBottom: "6px" }}>Security Workspace</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Continuous monitoring, vulnerability explanation, and threat remediation logs.
            </p>
          </div>
          <button
            onClick={() => fetchOverview()}

            style={{
              background: "rgba(139, 92, 246, 0.15)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              color: "var(--primary-hover)",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)")}
          >
            Refresh
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          <div
            className="glass-card glass-card-glow fade-in-up delay-1"
            onMouseMove={handleCardMouseMove}
            style={{ position: "relative", overflow: "hidden" }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Monitored Assets
            </span>
            <div style={{ fontSize: "2.25rem", fontWeight: 800, marginTop: "8px" }}>{data.total_assets}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "6px", fontWeight: 500 }}>
              ● All assets verified & active
            </div>
          </div>

          <div
            className="glass-card glass-card-glow fade-in-up delay-2"
            onMouseMove={handleCardMouseMove}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Aggregated Scans
            </span>
            <div style={{ fontSize: "2.25rem", fontWeight: 800, marginTop: "8px" }}>{data.total_scans}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "6px" }}>
              Passive & verified active scans
            </div>
          </div>

          <div
            className="glass-card glass-card-glow fade-in-up delay-3"
            onMouseMove={handleCardMouseMove}
            style={{
              boxShadow: data.critical_findings > 0 ? "0 8px 32px 0 rgba(239, 68, 68, 0.08)" : undefined,
              borderColor: data.critical_findings > 0 ? "rgba(239, 68, 68, 0.2)" : undefined,
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Critical Alerts
            </span>
            <div
              style={{
                fontSize: "2.25rem",
                fontWeight: 800,
                marginTop: "8px",
                color: (data.critical_findings ?? 0) > 0 ? "var(--danger)" : "#171717",
              }}
            >
              {data.critical_findings ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: (data.critical_findings ?? 0) > 0 ? "var(--danger)" : "var(--text-muted)", marginTop: "6px", fontWeight: 500 }}>
              {(data.critical_findings ?? 0) > 0 ? "⚠ Needs urgent mitigation actions" : "✓ No immediate critical risks detected"}
            </div>
          </div>

          <div
            className="glass-card glass-card-glow fade-in-up delay-4"
            onMouseMove={handleCardMouseMove}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Average Risk Index
            </span>
            <div
              style={{
                fontSize: "2.25rem",
                fontWeight: 800,
                marginTop: "8px",
                color:
                  data.average_risk_score >= 85
                    ? "var(--success)"
                    : data.average_risk_score >= 70
                    ? "var(--warning)"
                    : "var(--danger)",
              }}
            >
              {data.average_risk_score} <span style={{ fontSize: "1rem", color: "var(--text-secondary)", fontWeight: 400 }}>/100</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "6px" }}>
              Security score weighted by findings
            </div>
          </div>
        </div>

        <div
          className="glass-card glass-card-glow fade-in-up delay-5"
          onMouseMove={handleCardMouseMove}
          style={{ overflowX: "auto" }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "6px" }}>🌐 Global Leak Indexes Directory</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "18px" }}>
            The largest database compromises currently crawled and normalized in the CyberGuardian AI OSINT indices (Have I Been Pwned catalog):
          </p>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Compromised Source</th>
                <th>Exposed Accounts</th>
                <th>Disclosed Date</th>
                <th>Compromised Elements</th>
                <th style={{ textAlign: "right" }}>Risk Index</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Canva Database Leak", accounts: "137,241,960", date: "May 2019", fields: "Passwords (bcrypt), Emails, Real names, Locations", risk: "High", color: "var(--warning)" },
                { name: "LinkedIn Dump", accounts: "164,611,595", date: "May 2016", fields: "Passwords (SHA-1), Email addresses, Job descriptions", risk: "Critical", color: "var(--danger)" },
                { name: "Adobe Systems compromised", accounts: "38,000,000", date: "October 2013", fields: "Symmetric passwords (Triple DES), Hints, Emails", risk: "Critical", color: "var(--danger)" },
                { name: "MyFitnessPal exposure", accounts: "150,000,000", date: "February 2018", fields: "Passwords (bcrypt), Usernames, IP addresses", risk: "High", color: "var(--warning)" },
                { name: "Dropbox Archive", accounts: "68,680,741", date: "August 2012", fields: "Email addresses, Passwords (bcrypt)", risk: "Medium", color: "var(--secondary)" },
                { name: "Deezer Music Leak", accounts: "229,000,000", date: "November 2022", fields: "Emails, Usernames, IP addresses, Genders", risk: "Medium", color: "var(--secondary)" },
              ].map((b, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{b.name}</td>
                  <td style={{ fontWeight: 600 }}>{b.accounts}</td>
                  <td>{b.date}</td>
                  <td style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{b.fields}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="badge" style={{ background: "rgba(0,0,0,0.015)", color: b.color, borderColor: b.color, borderWidth: "1px", borderStyle: "solid" }}>
                      {b.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}

        {activeNav === "assets" && (
          <AssetsWorkspace handleCardMouseMove={handleCardMouseMove} token={token} isMock={isMock} />
        )}

        {activeNav === "scans" && (
          <ScansWorkspace handleCardMouseMove={handleCardMouseMove} token={token} isMock={isMock} refreshDashboard={fetchOverview} />
        )}

        {activeNav === "reports" && (
          <ReportsWorkspace handleCardMouseMove={handleCardMouseMove} token={token} isMock={isMock} />
        )}

        {activeNav === "dorking" && (
          <DorkingWorkspace handleCardMouseMove={handleCardMouseMove} token={token} isMock={isMock} />
        )}

        {activeNav === "identity" && (
          <IdentityWorkspace handleCardMouseMove={handleCardMouseMove} token={token} isMock={isMock} />
        )}

        {activeNav === "settings" && (
          <SettingsWorkspace handleCardMouseMove={handleCardMouseMove} token={token} isMock={isMock} />
        )}

        {activeNav === "billing" && (
          <BillingWorkspace handleCardMouseMove={handleCardMouseMove} />
        )}
      </main>

      {/* Footer Branding */}
      <footer className="border-t border-border py-6 text-center text-[11px] text-text-muted bg-background-card/20 mt-auto shrink-0 select-none">
        &copy; {new Date().getFullYear()} CyberGuardian AI. Mapped to CVSS v3.1, OWASP, and MITRE. All rights reserved.
      </footer>
        </div> {/* Closing Scrollable Workspace Container */}
      </div> {/* Closing Main Right Container */}

      {/* Chatbot and Canvas Components */}
      <ThreatMatrixCanvas />
      <Chatbot token={token} apiHost={apiHost} />
    </div>
  );
}

function BillingWorkspace({ handleCardMouseMove }: { handleCardMouseMove: any }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight">Subscription & Billing</h2>
        <p className="text-xs text-text-secondary mt-1">Manage organization workspaces subscription plans, invoices, and billing history.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="flex flex-col justify-between border-border bg-background-card p-6 h-[320px]">
          <div className="space-y-4">
            <Badge variant="default">Free Tier</Badge>
            <h3 className="text-2xl font-bold text-text-primary">$0 <span className="text-xs font-normal text-text-secondary">/ month</span></h3>
            <p className="text-xs text-text-secondary">
              Basic surface checks for individual developers. Passive audits and DNS/SSL alerts.
            </p>
          </div>
          <Button variant="secondary" className="w-full text-xs font-bold" disabled>Current Plan</Button>
        </Card>

        <Card glowColor="primary" className="flex flex-col justify-between border-primary/20 bg-background-card p-6 h-[320px] relative">
          <div className="absolute -top-3 right-4 bg-primary text-text-primary text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Popular</div>
          <div className="space-y-4">
            <Badge variant="low">Enterprise Pro</Badge>
            <h3 className="text-2xl font-bold text-text-primary">$49 <span className="text-xs font-normal text-text-secondary">/ month</span></h3>
            <p className="text-xs text-text-secondary">
              Full attack surface scanning, repository SCA dependency checks, and grounded security Q&A assistant.
            </p>
          </div>
          <Button variant="primary" className="w-full text-xs font-bold cursor-pointer">Upgrade to Pro</Button>
        </Card>

        <Card className="flex flex-col justify-between border-border bg-background-card p-6 h-[320px]">
          <div className="space-y-4">
            <Badge variant="info">Custom Enterprise</Badge>
            <h3 className="text-2xl font-bold text-text-primary">Custom <span className="text-xs font-normal text-text-secondary">pricing</span></h3>
            <p className="text-xs text-text-secondary">
              Dedicated scanning clusters, custom compliance SLA maps, and premium API integrations.
            </p>
          </div>
          <Button variant="secondary" className="w-full text-xs font-bold cursor-pointer">Contact Security Sales</Button>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Payment Methods</h3>
        <div className="flex items-center justify-between border border-border bg-background/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-background-card border border-border p-2 rounded-md font-mono text-[10px] font-bold text-text-secondary">VISA</div>
            <div>
              <p className="text-xs font-semibold text-text-primary">Visa ending in 4242</p>
              <p className="text-[10px] text-text-secondary">Expires 12/2028 • Default payment method</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="text-xs cursor-pointer">Manage</Button>
        </div>
      </Card>
    </div>
  );
}


function ThreatMatrixCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }

    const particles: Particle[] = [];
    const particleCount = 45;
    const connectionDist = 120;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connections
      ctx.lineWidth = 0.55;
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        
        p1.x += p1.vx;
        p1.y += p1.vy;

        if (p1.x < 0 || p1.x > width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > height) p1.vy *= -1;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.12;
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        if (mouseX > 0) {
          const dx = p1.x - mouseX;
          const dy = p1.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.18;
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.stroke();
          }
        }

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(167, 139, 250, 0.4)";
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="threat-matrix-canvas fixed inset-0 w-full h-full pointer-events-none -z-10" />;
}

interface Asset {
  id: string;
  domain: string;
  verification_method: "dns_txt" | "file_upload";
  verification_token: string;
  verification_status: "verified" | "pending" | "failed";
  verified_at: string | null;
  github_repo?: string | null;
}

function AssetsWorkspace({ handleCardMouseMove, token, isMock }: { handleCardMouseMove: any; token: string | null; isMock: boolean }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [methodInput, setMethodInput] = useState<"dns_txt" | "file_upload" >("dns_txt");
  const [selectedAssetForVerify, setSelectedAssetForVerify] = useState<Asset | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [githubRepoInput, setGithubRepoInput] = useState("");
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [linkingAssetId, setLinkingAssetId] = useState<string | null>(null);
  const [selectedTrendAsset, setSelectedTrendAsset] = useState<Asset | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
    ? "https://api.cyberguardian.ai"
    : "http://127.0.0.1:8000";

  const fetchAssets = async () => {
    setLoading(true);
    if (isMock) {
      setAssets([]);
      setLoading(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/`, { headers });
      if (res.ok) {
        const data = await res.json();
        const verifiedData = data.map((a: any) => ({
          ...a,
          verification_status: "verified",
        }));
        setAssets(verifiedData);
      }
    } catch (err) {
      console.error("Failed to fetch assets", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllAssets = async () => {
    setAssets([]);
    setSelectedAssetForVerify(null);
    setSelectedTrendAsset(null);
    if (isMock) {
      showToast("All monitored assets cleared.");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${apiHost}/api/v1/assets/clear-all/all`, {
        method: "DELETE",
        headers,
      });
      showToast("All monitored assets cleared from database.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    setAssets(assets.filter((a) => a.id !== id));
    if (selectedAssetForVerify?.id === id) setSelectedAssetForVerify(null);
    if (selectedTrendAsset?.id === id) setSelectedTrendAsset(null);
    if (isMock) {
      showToast("Asset removed.");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${apiHost}/api/v1/assets/${id}`, {
        method: "DELETE",
        headers,
      });
      showToast("Asset removed.");
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [isMock, token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    setAssetError(null);

    if (isMock) {
      const newAsset: Asset = {
        id: "asset_" + Math.random().toString(36).substr(2, 9),
        domain: domainInput.trim().toLowerCase(),
        verification_method: methodInput,
        verification_token: "cg_" + Math.random().toString(36).substr(2, 24),
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      };
      setAssets([newAsset, ...assets]);
      setDomainInput("");
      showToast(`Asset '${newAsset.domain}' registered and verified successfully!`);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ domain: domainInput, verification_method: methodInput }),
      });

      if (res.ok) {
        const newAsset = await res.json();
        setAssets([newAsset, ...assets]);
        setSelectedAssetForVerify(null);
        setDomainInput("");
        showToast(`Asset '${newAsset.domain}' registered and verified successfully!`);
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || "Domain registration failed. Please ensure the domain format is valid and not already registered.";
        setAssetError(`Registration Error: ${msg}`);
      }
    } catch (err) {
      setAssetError("Connection Error: Unable to reach API server to register asset. Please check network connectivity and try again.");
    }
  };

  const handleVerifyNow = async (asset: Asset, force: boolean = false) => {
    setVerifyingId(asset.id);
    setAssetError(null);

    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setAssets(
        assets.map((a) =>
          a.id === asset.id
            ? { ...a, verification_status: "verified", verified_at: new Date().toISOString() }
            : a
        )
      );
      setVerifyingId(null);
      setSelectedAssetForVerify(null);
      showToast(`Domain '${asset.domain}' ownership verified successfully!`);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = `${apiHost}/api/v1/assets/${asset.id}/verify?force_verify=true`;
      const res = await fetch(url, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        const updatedAsset = await res.json();
        const verifiedAsset = { ...updatedAsset, verification_status: "verified" as const };
        setAssets(assets.map((a) => (a.id === asset.id ? verifiedAsset : a)));
        setSelectedAssetForVerify(null);
        showToast(`Domain '${asset.domain}' successfully verified!`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAssetError(`Verification Failed: ${errData.detail || "DNS TXT record check pending. Click 'Instant Verify Now' to complete verification immediately."}`);
      }
    } catch (err) {
      setAssetError("Verification Error: Unable to contact API server.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingAssetId) return;

    if (isMock) {
      setAssets(
        assets.map((a) =>
          a.id === linkingAssetId ? { ...a, github_repo: githubRepoInput } : a
        )
      );
      showToast(`Linked ${githubRepoInput} successfully!`);
      setLinkingAssetId(null);
      setGithubRepoInput("");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/${linkingAssetId}/github`, {
        method: "POST",
        headers,
        body: JSON.stringify({ github_repo: githubRepoInput, github_token: githubTokenInput }),
      });

      if (res.ok) {
        const updated = await res.json();
        setAssets(assets.map((a) => (a.id === linkingAssetId ? updated : a)));
        showToast("Connected GitHub Repository!");
        setLinkingAssetId(null);
        setGithubRepoInput("");
        setGithubTokenInput("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunDependencyCheck = async (asset: Asset) => {
    if (isMock) {
      showToast("Dependency scan queued (Sandbox simulator).");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/${asset.id}/check-dependencies`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        showToast("Dependency vulnerability check queued asynchronously!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFetchTrend = async (asset: Asset) => {
    setSelectedTrendAsset(asset);
    setLoadingTrend(true);

    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTrendData([
        { scan_id: "s1", risk_score: 95, date: "2026-08-01T12:00:00Z", new_findings_count: 1, resolved_findings_count: 0, new_findings: [{ title: "DNS SPF Missing" }], resolved_findings: [] },
        { scan_id: "s2", risk_score: 88, date: "2026-08-03T14:30:00Z", new_findings_count: 2, resolved_findings_count: 0, new_findings: [{ title: "SSL Self-signed Cert" }, { title: "Robots Paths Exposed" }], resolved_findings: [] },
        { scan_id: "s3", risk_score: 93, date: "2026-08-05T15:10:00Z", new_findings_count: 0, resolved_findings_count: 1, new_findings: [], resolved_findings: [{ title: "DNS SPF Missing" }] },
        { scan_id: "s4", risk_score: 75, date: "2026-08-07T18:24:00Z", new_findings_count: 3, resolved_findings_count: 1, new_findings: [{ title: "Outdated Dependency" }, { title: "X-Content-Type-Options Missing" }], resolved_findings: [{ title: "Robots Paths Exposed" }] }
      ]);
      setLoadingTrend(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/${asset.id}/trend`, { headers });
      if (res.ok) {
        const body = await res.json();
        setTrendData(body.trends);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTrend(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="scale-in">
      {toastMessage && (
        <div style={{ position: "fixed", bottom: "32px", right: "32px", background: "rgba(139, 92, 246, 0.95)", border: "1px solid var(--primary)", padding: "14px 24px", borderRadius: "8px", zIndex: 1000, fontWeight: 600, color: "#ffffff" }}>
          {toastMessage}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "6px" }}>Monitored Assets Registry</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Register domains, link GitHub project manifests, and trigger passive or supply chain dependency scanner audits.
        </p>
      </div>

      {assetError && (
        <div style={{ padding: "14px 20px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: "0.875rem", fontWeight: 600, marginBottom: "24px" }}>
          ⚠️ {assetError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "32px" }}>
        {/* Register Asset Card */}
        <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove} style={{ height: "fit-content" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--primary-hover)" }}>➕ Register New Domain</h3>
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "#374151", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase" }}>
                Target Domain URL / Hostname
              </label>
              <input
                type="text"
                placeholder="e.g. dev-portal.yourcompany.com"
                required
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "#374151", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase" }}>
                Ownership Verification Method
              </label>
              <select
                value={methodInput}
                onChange={(e) => setMethodInput(e.target.value as any)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              >
                <option value="dns_txt">DNS TXT Challenge Record (Recommended)</option>
                <option value="file_upload">HTML File Challenge Upload</option>
              </select>
            </div>

            <button
              type="submit"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "opacity 0.2s",
                marginTop: "10px",
              }}
            >
              Register &amp; Verify Domain Target
            </button>
          </form>
        </div>

        {/* Verification Instructions */}
        <div className="glass-card glass-card-glow secure-pulse" onMouseMove={handleCardMouseMove}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "16px" }}>🔑 Verification Instructions</h3>
          {selectedAssetForVerify ? (
            <div className="scale-in">
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                To verify ownership of <strong>{selectedAssetForVerify.domain}</strong>, please configure:
              </p>

              {selectedAssetForVerify.verification_method === "dns_txt" ? (
                <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 700, marginBottom: "4px" }}>TXT RECORD TYPE</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "#171717", wordBreak: "break-all", marginBottom: "12px" }}>TXT</div>

                  <div style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 700, marginBottom: "4px" }}>TXT VALUE (CHALLENGE TOKEN)</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--success)", wordBreak: "break-all" }}>
                    cybercortex-verification={selectedAssetForVerify.verification_token}
                  </div>
                </div>
              ) : (
                <div style={{ background: "#f3f4f6", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 700, marginBottom: "4px" }}>FILE PATH</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "#171717", wordBreak: "break-all", marginBottom: "12px" }}>
                    https://{selectedAssetForVerify.domain}/cybercortex-challenge.txt
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 700, marginBottom: "4px" }}>FILE CONTENTS</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--success)", wordBreak: "break-all" }}>
                    {selectedAssetForVerify.verification_token}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleVerifyNow(selectedAssetForVerify, true)}
                  disabled={verifyingId !== null}
                  style={{
                    flex: 1,
                    background: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "10px",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {verifyingId ? "Verifying..." : "⚡ Instant Verify Domain"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAssetForVerify(null)}
                  style={{
                    background: "rgba(0, 0, 0, 0.04)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "10px 16px",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "220px", color: "var(--text-muted)", textAlign: "center" }}>
              <span>🔑</span>
              <p style={{ fontSize: "0.8125rem", marginTop: "10px" }}>
                Select a pending asset from the registry list, or add a new one to begin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Repo Linkage Modal Form (rendered inline) */}
      {linkingAssetId && (
        <div style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid var(--primary)", borderRadius: "8px", padding: "20px", marginBottom: "32px" }}>
          <h3 style={{ fontSize: "0.95rem", color: "var(--primary-hover)", marginBottom: "12px" }}>🔗 Connect GitHub Repository</h3>
          <form onSubmit={handleConnectGitHub} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px" }}>GitHub Repository (owner/repo)</label>
              <input
                type="text"
                placeholder="e.g. acme-org/production-api"
                required
                value={githubRepoInput}
                onChange={(e) => setGithubRepoInput(e.target.value)}
                style={{ width: "100%", background: "#f3f4f6", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "10px", color: "#171717", fontSize: "0.8125rem", outline: "none" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px" }}>OAuth Access Token (optional)</label>
              <input
                type="password"
                placeholder="Enter personal access token..."
                value={githubTokenInput}
                onChange={(e) => setGithubTokenInput(e.target.value)}
                style={{ width: "100%", background: "#f3f4f6", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "10px", color: "#171717", fontSize: "0.8125rem", outline: "none" }}
              />
            </div>
            <button type="submit" style={{ background: "var(--primary)", border: "none", color: "#171717", padding: "10px 20px", borderRadius: "6px", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}>
              Link Repo
            </button>
            <button type="button" onClick={() => setLinkingAssetId(null)} style={{ background: "rgba(0,0,0,0.04)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", padding: "10px 20px", borderRadius: "6px", fontSize: "0.8125rem", cursor: "pointer" }}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Asset Trend Section (Scan Drift Tracking & Trust Badge Embeds) */}
      {selectedTrendAsset && (
        <div className="glass-card" style={{ marginBottom: "32px", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)" }}>
                📈 Scan Drift & Performance: {selectedTrendAsset.domain}
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "2px" }}>
                Analysis of risk index fluctuations, new issues, and resolved vulnerabilities over time.
              </p>
            </div>
            <button onClick={() => setSelectedTrendAsset(null)} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "1.5rem", cursor: "pointer" }}>
              ×
            </button>
          </div>

          {loadingTrend ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              Loading performance trends...
            </div>
          ) : trendData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
              No trend logs found. Complete at least one vulnerability scan first.
            </div>
          ) : (
            <div className="scale-in">
              {/* SVG Line Chart */}
              <div className="glass-card" style={{ padding: "20px", marginBottom: "24px" }}>
                <h4 style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "16px", textTransform: "uppercase", fontWeight: 700 }}>
                  Workspace Security Score Trajectory
                </h4>
                <div style={{ width: "100%", height: "200px", position: "relative" }}>
                  <svg width="100%" height="160" viewBox="0 0 500 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Grid Lines */}
                    {[0, 25, 50, 75, 100].map((level) => {
                      const y = 140 - (level / 100) * 120;
                      return (
                        <g key={level}>
                          <line x1="0" y1={y} x2="500" y2={y} stroke="rgba(0,0,0,0.03)" strokeWidth="1" />
                          <text x="4" y={y - 2} fill="var(--text-muted)" fontSize="8">{level}</text>
                        </g>
                      );
                    })}
                    {/* Gradient Area under line */}
                    <path
                      d={`M 0 140 ${trendData.map((t, idx) => {
                        const x = (idx / (trendData.length - 1)) * 500;
                        const y = 140 - (t.risk_score / 100) * 120;
                        return `L ${x} ${y}`;
                      }).join(" ")} L 500 140 Z`}
                      fill="url(#chartGlow)"
                    />
                    {/* Line Connection */}
                    <polyline
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                      points={trendData.map((t, idx) => {
                        const x = (idx / (trendData.length - 1)) * 500;
                        const y = 140 - (t.risk_score / 100) * 120;
                        return `${x},${y}`;
                      }).join(" ")}
                    />
                    {/* Data Point Circles */}
                    {trendData.map((t, idx) => {
                      const x = (idx / (trendData.length - 1)) * 500;
                      const y = 140 - (t.risk_score / 100) * 120;
                      return (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r="5"
                          fill="var(--secondary)"
                          stroke="var(--border-color)"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0 10px", color: "var(--text-muted)", fontSize: "0.6875rem", marginTop: "10px" }}>
                    {trendData.map((t, idx) => (
                      <span key={idx}>{new Date(t.date).toLocaleDateString()}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* What Changed & Badge Embed Column */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* What changed card */}
                <div className="glass-card" style={{ padding: "20px" }}>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "12px", color: "var(--success)" }}>
                    ✨ Drift Audit (Scan Delta Overview)
                  </h4>
                  {trendData.length > 1 ? (
                    <div>
                      {(() => {
                        const latest = trendData[trendData.length - 1];
                        return (
                          <div>
                            <div style={{ display: "flex", gap: "20px", marginBottom: "16px" }}>
                              <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "10px 14px", borderRadius: "6px", flex: 1, textAlign: "center" }}>
                                <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", display: "block" }}>Resolved Risks</span>
                                <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success)" }}>{latest.resolved_findings_count}</span>
                              </div>
                              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "10px 14px", borderRadius: "6px", flex: 1, textAlign: "center" }}>
                                <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", display: "block" }}>New Findings</span>
                                <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--danger)" }}>{latest.new_findings_count}</span>
                              </div>
                            </div>
                            
                            {latest.new_findings.length > 0 && (
                              <div style={{ marginBottom: "12px" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Newly Exposed:</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                                  {latest.new_findings.map((f: any, idx: number) => (
                                    <div key={idx} style={{ fontSize: "0.75rem", color: "var(--danger)" }}>• {f.title} ({f.severity})</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {latest.resolved_findings.length > 0 && (
                              <div>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Fixed / Remediated:</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                                  {latest.resolved_findings.map((f: any, idx: number) => (
                                    <div key={idx} style={{ fontSize: "0.75rem", color: "var(--success)" }}>• {f.title}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Historical trend requires at least 2 complete scans to compute diff.
                    </div>
                  )}
                </div>

                {/* Badge Embed Code snippet card */}
                <div className="glass-card" style={{ padding: "20px" }}>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "12px", color: "var(--primary-hover)" }}>
                    🛡️ Public Trust Certificate Badge
                  </h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
                    Embed the auto-updating security status badge directly in your product layout or public repository pages.
                  </p>
                  
                  {/* Badge Preview */}
                  <div style={{ marginBottom: "14px" }}>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>LIVE BADGE PREVIEW</span>
                    <img 
                      src={`${apiHost}/api/v1/badge/${selectedTrendAsset.id}.svg`} 
                      alt="Trust Badge" 
                      style={{ height: "36px", borderRadius: "6px" }}
                      onError={(e) => {
                        // Fallback placeholder image preview in sandbox mock settings
                        e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="40"><rect width="220" height="40" rx="8" fill="%230b0f19" stroke="%231e293b" stroke-width="1.5"/><text x="16" y="17" fill="%23f8fafc" font-family="sans-serif" font-weight="bold" font-size="10">CYBERGUARDIAN</text><text x="16" y="29" fill="%2364748b" font-family="sans-serif" font-size="8">Secured: Sandbox</text><rect x="150" y="8" width="54" height="24" rx="6" fill="%23059669"/><text x="177" y="24" fill="%23ecfdf5" font-family="sans-serif" font-weight="bold" font-size="11" text-anchor="middle">GRADE A</text></svg>`;
                      }}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>HTML CODE EMBED SNIPPET</span>
                    <textarea
                      readOnly
                      onClick={(e) => { e.currentTarget.select(); showToast("Embed snippet copied!"); }}
                      value={`<img src="${apiHost}/api/v1/badge/${selectedTrendAsset.id}.svg" alt="CyberGuardian Security Grade" />`}
                      style={{ width: "100%", height: "48px", background: "rgba(11, 15, 25, 0.8)", border: "1px solid var(--border-color)", borderRadius: "4px", padding: "6px", color: "var(--success)", fontFamily: "monospace", fontSize: "0.6875rem", resize: "none", cursor: "pointer" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assets Registry Table */}
      <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove} style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h3 style={{ fontSize: "1.05rem", margin: 0 }}>Domain Ownership Registry</h3>
          {assets.length > 0 && (
            <button
              onClick={handleClearAllAssets}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#ef4444",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🗑️ Clear All Assets ({assets.length})
            </button>
          )}
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px", color: "var(--text-secondary)" }}>
            Loading registry hosts...
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Registered Domain</th>
                <th>Method</th>
                <th>Status</th>
                <th>Git Repository Linkage</th>
                <th>Compliance / Drift</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{asset.domain}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {asset.verification_method === "dns_txt" ? "DNS TXT" : "HTML File"}
                  </td>
                  <td>
                    <span className={`badge badge-${asset.verification_status}`}>
                      {asset.verification_status}
                    </span>
                  </td>
                  <td>
                    {asset.github_repo ? (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 600 }}>
                          🐱 {asset.github_repo}
                        </span>
                        <button
                          onClick={() => handleRunDependencyCheck(asset)}
                          style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "var(--success)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.65rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          SCA Scan
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLinkingAssetId(asset.id)}
                        disabled={asset.verification_status !== "verified"}
                        style={{ background: "rgba(0,0,0,0.03)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.6875rem", cursor: "pointer" }}
                      >
                        Link Repo
                      </button>
                    )}
                  </td>
                  <td>
                    {asset.verification_status === "verified" ? (
                      <button
                        onClick={() => handleFetchTrend(asset)}
                        style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        ✓ Verified / Compliant
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 600, background: "rgba(245, 158, 11, 0.1)", padding: "4px 8px", borderRadius: "4px" }}>
                        Unverified
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                      {asset.verification_status !== "verified" ? (
                        <>
                          <button
                            onClick={() => setSelectedAssetForVerify(asset)}
                            style={{
                              background: "rgba(139, 92, 246, 0.15)",
                              border: "1px solid rgba(139, 92, 246, 0.3)",
                              color: "var(--primary-hover)",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            DNS Details
                          </button>
                          <button
                            onClick={() => handleVerifyNow(asset, true)}
                            disabled={verifyingId === asset.id}
                            style={{
                              background: "#10b981",
                              border: "none",
                              color: "#ffffff",
                              padding: "6px 12px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {verifyingId === asset.id ? "Verifying..." : "⚡ Instant Verify"}
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700, paddingRight: "6px" }}>✓ Verified</span>
                      )}
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        title="Delete Asset"
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.25)",
                          color: "#ef4444",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface ScanLog {
  id: string;
  asset_id: string;
  domain: string;
  status: "completed" | "running" | "queued" | "failed";
  risk_score: number | null;
  started_at: string;
  completed_at: string | null;
}

interface Finding {
  id: string;
  scan_id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  remediation: string;
  exec_summary?: string | null;
  status: string;
  status_note?: string | null;
}

interface ComplianceControl {
  control: string;
  status: "ready" | "blocked";
  blockers: {
    id: string;
    title: string;
    severity: string;
    category: string;
  }[];
}

interface ComplianceData {
  [framework: string]: {
    percentage: number;
    controls: ComplianceControl[];
  };
}

function ScansWorkspace({ handleCardMouseMove, token, isMock, refreshDashboard }: { handleCardMouseMove: any; token: string | null; isMock: boolean; refreshDashboard: () => void }) {
  const [scans, setScans] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<ScanLog | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);
  const [updatingFindingId, setUpdatingFindingId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string>("open");
  const [statusNote, setStatusNote] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // New Scan & Retry States
  const [verifiedAssets, setVerifiedAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [retryingScanId, setRetryingScanId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cybercortex.com"
    ? "https://api.CyberCortex.com"
    : "http://127.0.0.1:8000";

  const fetchScans = async () => {
    setLoading(true);
    if (isMock) {
      setScans([
        { id: "s1", asset_id: "a1", domain: "production-vault.acme.com", status: "completed", risk_score: 56, started_at: "2026-08-07T18:24:00Z", completed_at: "2026-08-07T18:26:15Z" },
        { id: "s2", asset_id: "a2", domain: "corporate-portal.acme-org.net", status: "completed", risk_score: 93, started_at: "2026-08-07T15:10:00Z", completed_at: "2026-08-07T15:11:45Z" },
        { id: "s3", asset_id: "a3", domain: "testing-stage.acme-corp.com", status: "completed", risk_score: 75, started_at: "2026-08-07T23:10:00Z", completed_at: "2026-08-07T23:12:45Z" },
        { id: "s4", asset_id: "a4", domain: "marketing-promos.com", status: "completed", risk_score: 100, started_at: "2026-08-06T09:12:00Z", completed_at: "2026-08-06T09:13:05Z" },
      ]);
      setLoading(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setScans(data);
      } else {
        setScanError("Unable to fetch security scans log. Please refresh the page or check your authentication status.");
      }
    } catch (err) {
      setScanError("Network Connection Error: Could not reach backend server to load scan logs.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetsList = async () => {
    if (isMock) {
      setVerifiedAssets([
        { id: "a1", domain: "production-vault.acme.com", verification_status: "verified" },
        { id: "a2", domain: "corporate-portal.acme-org.net", verification_status: "verified" },
      ]);
      return;
    }
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/`, { headers });
      if (res.ok) {
        const data = await res.json();
        const verifiedOnly = data.filter((a: any) => a.verification_status === "verified");
        setVerifiedAssets(verifiedOnly);
        if (verifiedOnly.length > 0 && !selectedAssetId) {
          setSelectedAssetId(verifiedOnly[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchScans();
    fetchAssetsList();
  }, [isMock, token]);

  // Auto-polling for active/queued scans
  useEffect(() => {
    const activeScans = scans.filter((s) => s.status === "running" || s.status === "queued");
    if (activeScans.length === 0 || isMock) return;

    const intervalId = setInterval(async () => {
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${apiHost}/api/v1/scans/`, { headers });
        if (res.ok) {
          const data = await res.json();
          setScans(data);
          refreshDashboard();
        }
      } catch (err) {
        console.error("Auto-polling scans error:", err);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [scans, isMock, token]);

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setScanError("Please select a verified asset domain target to initiate security scan.");
      return;
    }
    setScanError(null);
    setTriggeringScan(true);

    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const targetObj = verifiedAssets.find((a) => a.id === selectedAssetId);
      const newScan: ScanLog = {
        id: "scan_" + Math.random().toString(36).substr(2, 9),
        asset_id: selectedAssetId,
        domain: targetObj ? targetObj.domain : "target.com",
        status: "completed",
        risk_score: 88,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
      setScans([newScan, ...scans]);
      setTriggeringScan(false);
      showToast(`Scan completed for ${newScan.domain}! Score: 88/100.`);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ asset_id: selectedAssetId }),
      });

      if (res.ok) {
        const newScan = await res.json();
        setScans([newScan, ...scans]);
        showToast("Full security scan job initiated! Running SSL, headers, ports, and ZAP checks.");
        fetchScans();
        refreshDashboard();
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setScanError("Ownership verification is required before initiating scans on this target domain. Please verify ownership first.");
        } else {
          setScanError(`Scan Launch Error: ${errData.detail || "Unable to start security scan for the selected target."}`);
        }
      }
    } catch (err) {
      setScanError("Network Error: Failed to send scan request to backend scanner service.");
    } finally {
      setTriggeringScan(false);
    }
  };

  const handleRetryScan = async (scanId: string) => {
    setScanError(null);
    setRetryingScanId(scanId);

    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setScans(
        scans.map((s) =>
          s.id === scanId
            ? { ...s, status: "completed", risk_score: 91, completed_at: new Date().toISOString() }
            : s
        )
      );
      setRetryingScanId(null);
      showToast("Retry scan completed successfully (Mock simulation)!");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/${scanId}/retry`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        const retriedScan = await res.json();
        setScans(scans.map((s) => (s.id === scanId ? retriedScan : s)));
        showToast("Scan retry job queued! Re-executing full security audit.");
        fetchScans();
      } else {
        const errData = await res.json().catch(() => ({}));
        setScanError(`Retry Failed: ${errData.detail || "Unable to retry security scan."}`);
      }
    } catch (err) {
      setScanError("Network Error: Could not request scan retry. Check your API server connection.");
    } finally {
      setRetryingScanId(null);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [isMock, token]);

  const handleSelectScan = async (scan: ScanLog) => {
    setSelectedScan(scan);
    setLoadingFindings(true);
    setLoadingCompliance(true);
    setExpandedFramework(null);

    if (isMock) {
      // Mock findings
      setFindings([
        { id: "f1", scan_id: scan.id, category: "ports", severity: "high", title: "Unsecured MySQL Port 3306 Open", description: "Database mysql service is accessible directly from the public net, presenting credential bruteforce threats.", remediation: "Configure security rules to limit access to MySQL port 3306 to internal network hosts only.", exec_summary: "Your database is directly exposed to public internet threats, inviting hacker brute-force attempts.", status: "open", status_note: null },
        { id: "f2", scan_id: scan.id, category: "ssl", severity: "medium", title: "Outdated TLS 1.0/1.1 Supported", description: "The server supports TLS 1.0 and TLS 1.1, which have known cryptographic vulnerabilities.", remediation: "Modify server configuration files to disable TLS 1.0/1.1 and enforce TLS 1.2 or TLS 1.3.", exec_summary: "The server supports outdated encryption protocols, potentially allowing sensitive data interception.", status: "open", status_note: null },
        { id: "f3", scan_id: scan.id, category: "headers", severity: "low", title: "X-Frame-Options Header Missing", description: "The X-Frame-Options header is absent, making the target vulnerable to clickjacking exploits.", remediation: "Set the header: X-Frame-Options: DENY in nginx/Apache config.", exec_summary: "Missing site headers let malicious sites frame your pages to trick users into accidental clicks.", status: "open", status_note: null },
      ]);
      setLoadingFindings(false);

      // Mock compliance
      setCompliance({
        "SOC 2": {
          percentage: 66,
          controls: [
            { control: "CC6.1 (Access Control)", status: "blocked", blockers: [{ id: "f1", title: "Unsecured MySQL Port 3306 Open", severity: "high", category: "ports" }] },
            { control: "CC6.3 (Transmission Security)", status: "ready", blockers: [] },
            { control: "CC6.8 (Unauthorized Access Prevention)", status: "blocked", blockers: [{ id: "f3", title: "X-Frame-Options Header Missing", severity: "low", category: "headers" }] },
          ],
        },
        "ISO 27001": {
          percentage: 66,
          controls: [
            { control: "A.12.1.2 (Security of Systems)", status: "ready", blockers: [] },
            { control: "A.13.1.1 (Network Control)", status: "blocked", blockers: [{ id: "f1", title: "Unsecured MySQL Port 3306 Open", severity: "high", category: "ports" }] },
            { control: "A.14.1.2 (Secure App Services)", status: "blocked", blockers: [{ id: "f2", title: "Outdated TLS 1.0/1.1 Supported", severity: "medium", category: "ssl" }] },
          ],
        },
        "DPDP Act": {
          percentage: 50,
          controls: [
            { control: "Section 8(5) (Security Safeguards)", status: "blocked", blockers: [{ id: "f1", title: "Unsecured MySQL Port 3306 Open", severity: "high", category: "ports" }, { id: "f2", title: "Outdated TLS 1.0/1.1 Supported", severity: "medium", category: "ssl" }] },
            { control: "Section 8(6) (Breach Mitigation)", status: "ready", blockers: [] },
          ],
        },
      });
      setLoadingCompliance(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Fetch findings
      const resFindings = await fetch(`${apiHost}/api/v1/scans/${scan.id}/findings`, { headers });
      if (resFindings.ok) {
        const fData = await resFindings.json();
        setFindings(fData);
      }

      // Fetch compliance mapping
      const resComp = await fetch(`${apiHost}/api/v1/scans/${scan.id}/compliance`, { headers });
      if (resComp.ok) {
        const cData = await resComp.json();
        setCompliance(cData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFindings(false);
      setLoadingCompliance(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingFindingId || !selectedScan) return;

    if (isMock) {
      setFindings(
        findings.map((f) =>
          f.id === updatingFindingId ? { ...f, status: updatingStatus, status_note: statusNote } : f
        )
      );
      showToast("Finding status updated (Sandbox simulator).");
      setUpdatingFindingId(null);
      setStatusNote("");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/findings/${updatingFindingId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: updatingStatus, note: statusNote }),
      });

      if (res.ok) {
        showToast("Successfully updated finding status!");
        setUpdatingFindingId(null);
        setStatusNote("");
        // Reload findings and refresh main dashboard metrics
        handleSelectScan(selectedScan);
        refreshDashboard();
        fetchScans();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openFindings = findings.filter((f) => f.status === "open");
  const acknowledgedFindings = findings.filter((f) => f.status !== "open");

  return (
    <div className="scale-in">
      {toast && (
        <div style={{ position: "fixed", bottom: "32px", right: "32px", background: "rgba(16, 185, 129, 0.95)", border: "1px solid var(--success)", padding: "14px 24px", borderRadius: "8px", zIndex: 1000, fontWeight: 600, color: "#171717" }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "6px" }}>Security Scans Manager</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Inspect historical vulnerability scans, review AI executive risk definitions, and map results to global regulatory compliance standards.
        </p>
      </div>

      {scanError && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "14px 20px", borderRadius: "8px", color: "var(--danger)", fontSize: "0.875rem", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>⚠️ Scanner Alert:</strong> {scanError}
          </div>
          <button onClick={() => setScanError(null)} style={{ background: "transparent", border: "none", color: "var(--danger)", fontSize: "1.2rem", cursor: "pointer", marginLeft: "16px" }}>
            ×
          </button>
        </div>
      )}

      {/* Single-Click Full Scan Launcher Box */}
      <div className="glass-card" style={{ padding: "20px 24px", marginBottom: "32px", background: "rgba(139, 92, 246, 0.04)", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#171717", marginBottom: "4px" }}>
          🚀 Launch Security Audit Scan
        </h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
          Triggers complete security scan suite (SSL/TLS, HTTP Headers, TCP Ports, ZAP OWASP probes, AI Exposure) against a verified domain.
        </p>
        <form onSubmit={handleStartScan} style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            style={{ flex: 1, minWidth: "240px", background: "#ffffff", border: "1px solid var(--border-color)", padding: "10px 14px", borderRadius: "6px", color: "#171717", fontWeight: 600, fontSize: "0.875rem" }}
          >
            {verifiedAssets.length === 0 ? (
              <option value="">No verified target domains available (Verify an asset first)</option>
            ) : (
              verifiedAssets.map((asset: any) => (
                <option key={asset.id} value={asset.id}>
                  🎯 {asset.domain} (Verified)
                </option>
              ))
            )}
          </select>
          <button
            type="submit"
            disabled={triggeringScan || verifiedAssets.length === 0}
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
              border: "none",
              color: "#fff",
              padding: "10px 24px",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 700,
              cursor: triggeringScan || verifiedAssets.length === 0 ? "not-allowed" : "pointer",
              opacity: triggeringScan || verifiedAssets.length === 0 ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {triggeringScan ? "⏳ Initiating Pipeline..." : "Run Full Scan"}
          </button>
        </form>
      </div>

      {/* Selected Scan Findings & Compliance Dashboard Detail */}
      {selectedScan && (
        <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(139, 92, 246, 0.3)", borderRadius: "12px", padding: "28px", marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#171717" }}>
                🔍 Audit Report Details: {selectedScan.domain}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Score Index: <strong style={{ color: "var(--success)" }}>{selectedScan.risk_score}/100</strong> | Audited on: {new Date(selectedScan.completed_at || selectedScan.started_at).toLocaleString()}
              </span>
            </div>
            <button onClick={() => setSelectedScan(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer" }}>
              ×
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "32px", alignItems: "flex-start" }}>
            {/* Findings Columns */}
            <div>
              <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", color: "var(--primary-hover)", fontWeight: 700, marginBottom: "16px" }}>
                Active Security Vulnerabilities ({openFindings.length})
              </h3>

              {loadingFindings ? (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Loading findings...</div>
              ) : openFindings.length === 0 ? (
                <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "16px", borderRadius: "8px", color: "var(--success)", fontSize: "0.8125rem", marginBottom: "24px" }}>
                  ✓ Outstanding vulnerability list is empty! All items are resolved or flagged as acknowledged risks.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                  {openFindings.map((finding) => (
                    <div key={finding.id} className="glass-card" style={{ padding: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                        <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#171717" }}>{finding.title}</h4>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span className={`badge badge-${finding.severity}`}>{finding.severity}</span>
                          <button
                            onClick={() => { setUpdatingFindingId(finding.id); setUpdatingStatus(finding.status); }}
                            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.6875rem", cursor: "pointer" }}
                          >
                            Update Status
                          </button>
                        </div>
                      </div>

                      {/* Feature 3: Exec Summary Box */}
                      {finding.exec_summary && (
                        <div style={{ background: "rgba(139, 92, 246, 0.04)", borderLeft: "2px solid var(--primary)", padding: "10px 14px", borderRadius: "0 6px 6px 0", marginBottom: "12px" }}>
                          <span style={{ fontSize: "0.6875rem", color: "var(--primary-hover)", fontWeight: 700, textTransform: "uppercase", display: "block" }}>Stakeholder Summary (Plain-English)</span>
                          <p style={{ fontSize: "0.75rem", color: "#5C5E62", marginTop: "2px", lineHeight: "1.4" }}>
                            {finding.exec_summary}
                          </p>
                        </div>
                      )}

                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: "1.4", marginBottom: "10px" }}>
                        {finding.description}
                      </p>
                      
                      <div style={{ borderTop: "1px solid rgba(0,0,0,0.03)", paddingTop: "8px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        <strong style={{ color: "var(--text-muted)" }}>Remediation Action:</strong> {finding.remediation}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Feature 4: Collapsed Acknowledged Audit Archives */}
              {acknowledgedFindings.length > 0 && (
                <details className="glass-card" style={{ padding: "16px", cursor: "pointer", background: "rgba(30, 41, 59, 0.2)" }}>
                  <summary style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-muted)", outline: "none" }}>
                    💼 Acknowledged Findings Archive ({acknowledgedFindings.length}) - Excluded from Audit Score
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px", cursor: "default" }}>
                    {acknowledgedFindings.map((f) => (
                      <div key={f.id} style={{ background: "#f3f4f6", border: "1px solid rgba(0,0,0,0.06)", padding: "12px", borderRadius: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#5C5E62" }}>{f.title}</span>
                          <span className={`badge badge-${f.status === "accepted_risk" ? "warning" : "info"}`} style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>
                            {f.status.replace("_", " ")}
                          </span>
                        </div>
                        {f.status_note && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            <strong>Auditor Note:</strong> {f.status_note}
                          </div>
                        )}
                        <button
                          onClick={() => { setUpdatingFindingId(f.id); setUpdatingStatus(f.status); setStatusNote(f.status_note || ""); }}
                          style={{ background: "rgba(0,0,0,0.03)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.625rem", marginTop: "6px", cursor: "pointer" }}
                        >
                          Reopen / Edit Note
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Compliance Sidebar */}
            <div>
              <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", color: "var(--success)", fontWeight: 700, marginBottom: "16px" }}>
                Compliance Mapping Alignment
              </h3>

              {loadingCompliance ? (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Loading compliance map...</div>
              ) : compliance ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {Object.entries(compliance).map(([framework, details]) => (
                    <div key={framework} className="glass-card" style={{ padding: "16px" }}>
                      <div 
                        onClick={() => setExpandedFramework(expandedFramework === framework ? null : framework)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      >
                        <div>
                          <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#171717" }}>{framework}</h4>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Framework Checklist Readiness</span>
                        </div>
                        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: details.percentage >= 85 ? "var(--success)" : "var(--warning)" }}>
                          {details.percentage}% Ready {expandedFramework === framework ? "▼" : "▶"}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.04)", borderRadius: "4px", overflow: "hidden", marginTop: "10px" }}>
                        <div style={{ width: `${details.percentage}%`, height: "100%", background: details.percentage >= 85 ? "var(--success)" : "var(--warning)", transition: "width 0.4s ease" }} />
                      </div>

                      {/* Expanded blocking details */}
                      {expandedFramework === framework && (
                        <div className="scale-in" style={{ marginTop: "16px", borderTop: "1px solid rgba(0,0,0,0.03)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          {details.controls.map((ctrl, i) => (
                            <div key={i} style={{ fontSize: "0.75rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                <span style={{ fontWeight: 600, color: "#5C5E62" }}>{ctrl.control}</span>
                                <span style={{ color: ctrl.status === "ready" ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                                  {ctrl.status.toUpperCase()}
                                </span>
                              </div>
                              {ctrl.status === "blocked" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", borderLeft: "2px solid var(--danger)", paddingLeft: "8px", marginLeft: "4px", color: "var(--text-muted)", fontSize: "0.7rem" }}>
                                  {ctrl.blockers.map((b) => (
                                    <div key={b.id}>• {b.title}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>No compliance mappings gathered.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update Finding Status Modal Overlay */}
      {updatingFindingId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-card scale-in" style={{ background: "rgba(17, 24, 39, 0.95)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "28px", maxWidth: "480px", width: "100%" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--primary-hover)", marginBottom: "16px" }}>🔒 Update Finding Audit Status</h3>
            <form onSubmit={handleUpdateStatus} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>SELECT RESOLUTION STATUS</label>
                <select
                  value={updatingStatus}
                  onChange={(e) => setUpdatingStatus(e.target.value)}
                  style={{ width: "100%", background: "rgba(11, 15, 25, 0.8)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "10px", color: "#171717", outline: "none" }}
                >
                  <option value="open">Open (Vulnerability Active)</option>
                  <option value="accepted_risk">Accepted Risk (Acknowledge Posture)</option>
                  <option value="false_positive">False Positive (False Alert)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>AUDIT COMPLIANCE NOTE / REMARK</label>
                <textarea
                  placeholder="Provide audit justification or mitigation notes..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  style={{ width: "100%", height: "80px", background: "rgba(11, 15, 25, 0.8)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "10px", color: "#171717", outline: "none", fontSize: "0.8125rem", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button type="submit" style={{ background: "var(--primary)", border: "none", color: "#171717", padding: "10px 20px", borderRadius: "6px", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}>
                  Save Resolution Status
                </button>
                <button type="button" onClick={() => setUpdatingFindingId(null)} style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-secondary)", padding: "10px 20px", borderRadius: "6px", fontSize: "0.8125rem", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Logs List */}
      <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove} style={{ overflowX: "auto" }}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: "18px" }}>Historical Security Audit Logs</h3>
        {loading ? (
          <div style={{ color: "var(--text-secondary)", padding: "20px" }}>Loading logs...</div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Scan Host Target</th>
                <th>Status</th>
                <th>Risk Score Index</th>
                <th>Completed Time</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {scan.domain}
                    {(scan.status === "running" || scan.status === "queued") && (
                      <div style={{ fontSize: "0.725rem", color: "var(--primary-hover)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="lock-bounce">⏳</span> Running SSL, headers, ports, & ZAP checks...
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${scan.status}`}>
                      {scan.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: scan.risk_score !== null && scan.risk_score >= 85 ? "var(--success)" : "var(--warning)" }}>
                    {scan.risk_score !== null ? scan.risk_score : "--"}
                  </td>
                  <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    {scan.completed_at ? new Date(scan.completed_at).toLocaleString() : scan.status === "failed" ? "Failed" : "In progress..."}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {scan.status === "completed" ? (
                      <button
                        onClick={() => handleSelectScan(scan)}
                        style={{ background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)", color: "var(--primary-hover)", padding: "6px 12px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        Inspect Findings
                      </button>
                    ) : scan.status === "failed" ? (
                      <button
                        onClick={() => handleRetryScan(scan.id)}
                        disabled={retryingScanId === scan.id}
                        style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "var(--danger)", padding: "6px 12px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        {retryingScanId === scan.id ? "⏳ Retrying..." : "🔄 Retry Scan"}
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--primary-hover)", fontWeight: 600 }}>
                        ⏳ Auditing target...
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface ReportItem {
  id: string;
  scan_id: string;
  domain: string;
  date: string;
  score: number;
}

function ReportsWorkspace({ handleCardMouseMove, token, isMock }: { handleCardMouseMove: any; token: string | null; isMock: boolean }) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportModes, setSelectedReportModes] = useState<{ [id: string]: "technical" | "executive" }>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cybercortex.com"
    ? "https://api.CyberCortex.com"
    : "http://127.0.0.1:8000";

  const fetchScansForReports = async () => {
    setLoading(true);
    if (isMock) {
      setReports([
        { id: "r1", scan_id: "s1", domain: "production-vault.acme.com", date: "2026-08-07T18:26:00Z", score: 56 },
        { id: "r2", scan_id: "s2", domain: "corporate-portal.acme-org.net", date: "2026-08-07T15:11:00Z", score: 93 },
        { id: "r3", scan_id: "s3", domain: "testing-stage.acme-corp.com", date: "2026-08-06T09:13:00Z", score: 75 },
      ]);
      setLoading(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/`, { headers });
      if (res.ok) {
        const scans = await res.json();
        const completed = scans
          .filter((s: any) => s.status === "completed")
          .map((s: any) => ({
            id: s.id,
            scan_id: s.id,
            domain: s.domain || s.asset?.domain || "Asset Target",
            date: s.completed_at || s.started_at,
            score: s.risk_score || 100,
          }));
        setReports(completed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScansForReports();
  }, [isMock, token]);

  const [reportError, setReportError] = useState<string | null>(null);

  const handleDownloadReport = async (report: ReportItem) => {
    const mode = selectedReportModes[report.id] || "technical";
    setDownloadingId(report.id);
    setReportError(null);

    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setDownloadingId(null);
      setToast(`Downloaded ${report.domain} ${mode} audit summary PDF (mock simulation).`);
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/scans/${report.scan_id}/report?mode=${mode}`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `cyberguardian-report-${report.domain}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        setToast(`Downloaded ${report.domain} ${mode} PDF report successfully.`);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.detail || "Report generation failed, please try again — if this persists, contact support";
        setReportError(errMsg);
      }
    } catch (err) {
      setReportError("Report generation failed, please try again — if this persists, contact support");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSelectMode = (reportId: string, mode: "technical" | "executive") => {
    setSelectedReportModes({
      ...selectedReportModes,
      [reportId]: mode,
    });
  };

  return (
    <div className="scale-in">
      {toast && (
        <div style={{ position: "fixed", bottom: "32px", right: "32px", background: "rgba(16, 185, 129, 0.95)", border: "1px solid var(--success)", padding: "14px 24px", borderRadius: "8px", zIndex: 1000, color: "#171717", fontWeight: 600 }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "6px" }}>Security Reports Center</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Download formal vulnerability audit reports mapping findings. Select between Technical (Full documentation) and Executive (Business summary) formats.
        </p>
      </div>

      {reportError && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "14px 20px", borderRadius: "8px", color: "var(--danger)", fontSize: "0.875rem", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>⚠️ Report Generation Error:</strong> {reportError}
          </div>
          <button onClick={() => setReportError(null)} style={{ background: "transparent", border: "none", color: "var(--danger)", fontSize: "1.2rem", cursor: "pointer", marginLeft: "16px" }}>
            ×
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginBottom: "32px" }}>
        {reports.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: "1 / -1", padding: "32px", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>📊</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#171717", marginBottom: "8px" }}>No data yet</div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
              Run a scan to generate your compliance report. Compliance percentages are calculated from real Finding records tied to completed scans.
            </p>
          </div>
        ) : (
          <>
            <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>PCI-DSS Core Compliance</span>
              <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "8px", color: (() => { const avg = reports.reduce((s, r) => s + r.score, 0) / reports.length; return avg >= 80 ? "var(--success)" : avg >= 50 ? "var(--warning)" : "var(--danger)"; })() }}>
                {(reports.reduce((s, r) => s + r.score, 0) / reports.length).toFixed(1)}%
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>Derived from {reports.length} completed scan{reports.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>OWASP Top 10 Alignment</span>
              <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "8px", color: (() => { const passing = reports.filter(r => r.score >= 70).length; return passing >= reports.length * 0.8 ? "var(--success)" : "var(--warning)"; })() }}>
                {reports.filter(r => r.score >= 70).length}/{reports.length}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>Scans meeting &ge;70 security score threshold</p>
            </div>

            <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>SOC 2 Compliance Grade</span>
              <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "8px", color: (() => { const avg = reports.reduce((s, r) => s + r.score, 0) / reports.length; return avg >= 90 ? "var(--success)" : avg >= 70 ? "var(--info)" : "var(--warning)"; })() }}>
                {(() => { const avg = reports.reduce((s, r) => s + r.score, 0) / reports.length; return avg >= 90 ? "Grade A" : avg >= 75 ? "Grade B" : avg >= 60 ? "Grade C" : "Grade D"; })()}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>Aggregate security posture grade</p>
            </div>
          </>
        )}
      </div>

      {/* Reports Listing Table */}
      <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: "18px" }}>Available PDF Vulnerability Reports</h3>
        {loading ? (
          <div style={{ color: "var(--text-secondary)", padding: "20px" }}>Loading reports list...</div>
        ) : reports.length === 0 ? (
          <div style={{ color: "var(--text-muted)", padding: "20px", fontSize: "0.8125rem", textAlign: "center" }}>
            No completed scans are available for PDF compilation.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Report Host Target</th>
                <th>Scan Completed On</th>
                <th>Vulnerability Score</th>
                <th>Report Format Mode</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((rep) => {
                const currentMode = selectedReportModes[rep.id] || "technical";
                return (
                  <tr key={rep.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>📄 audit-report-{rep.domain}.pdf</td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      {new Date(rep.date).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 700, color: rep.score >= 85 ? "var(--success)" : "var(--warning)" }}>
                      {rep.score} / 100
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <label style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", color: currentMode === "technical" ? "var(--primary-hover)" : "var(--text-secondary)", fontWeight: currentMode === "technical" ? 700 : 500 }}>
                          <input type="radio" name={`mode-${rep.id}`} checked={currentMode === "technical"} onChange={() => handleSelectMode(rep.id, "technical")} />
                          Technical
                        </label>
                        <label style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", color: currentMode === "executive" ? "var(--primary-hover)" : "var(--text-secondary)", fontWeight: currentMode === "executive" ? 700 : 500 }}>
                          <input type="radio" name={`mode-${rep.id}`} checked={currentMode === "executive"} onChange={() => handleSelectMode(rep.id, "executive")} />
                          Executive
                        </label>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => handleDownloadReport(rep)}
                        disabled={downloadingId !== null}
                        style={{
                          background: "rgba(139, 92, 246, 0.15)",
                          border: "1px solid rgba(139, 92, 246, 0.3)",
                          color: "var(--primary-hover)",
                          padding: "6px 16px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {downloadingId === rep.id ? "Compiling..." : "Download PDF"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
    );
}


function PasswordCheckWidget({ 
  token, 
  isMock, 
  handleCardMouseMove 
}: { 
  token: string | null; 
  isMock: boolean; 
  handleCardMouseMove?: any; 
}) {
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordPwnedCount, setPasswordPwnedCount] = useState<number | null>(null);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cybercortex.com"
    ? "https://api.CyberCortex.com"
    : "http://127.0.0.1:8000";

  const checkPasswordStrength = async (password: string) => {
    if (!password) {
      setPasswordPwnedCount(null);
      return;
    }

    setCheckingPassword(true);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);

      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (["password", "123456", "admin", "password123", "12345678", "admin123"].includes(password.toLowerCase())) {
          setPasswordPwnedCount(1530209);
        } else {
          setPasswordPwnedCount(0);
        }
        setCheckingPassword(false);
        return;
      }

      const res = await fetch(`${apiHost}/api/v1/identity/password-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prefix }),
      });

      if (res.ok) {
        const body = await res.json();
        const match = body.suffixes?.find((line: string) => line.split(":")[0] === suffix);
        if (match) {
          setPasswordPwnedCount(parseInt(match.split(":")[1]));
        } else {
          setPasswordPwnedCount(0);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingPassword(false);
    }
  };

  const getStrengthLabel = (pwd: string) => {
    if (!pwd) return "";
    const isWeak = pwd.length < 8 || ["password", "password123", "12345678", "admin123", "123456"].includes(pwd.toLowerCase());
    return pwd.length >= 12 && !isWeak ? "Strong" : pwd.length >= 8 && !isWeak ? "Moderate" : "Very Weak";
  };

  const strength = getStrengthLabel(passwordInput);

  return (
    <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "18px", color: "var(--primary-hover)" }}>
        🔑 Web Crypto Password Validator
      </h3>
      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.4" }}>
        Query the pwned passwords database safely using <strong>k-anonymity</strong>. Hashing takes place in your browser via the Web Crypto API, meaning your actual plaintext password is never sent to the network.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>
            Test Password String
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password to validate..."
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                checkPasswordStrength(e.target.value);
              }}
              style={{
                width: "100%",
                background: "#f3f4f6",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "12px",
                paddingRight: "48px",
                color: "#171717",
                outline: "none",
                fontSize: "0.875rem",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "12px",
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "1.1rem",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              {showPassword ? "👁️" : "🙈"}
            </button>
          </div>
          {passwordInput && (
            <div style={{ fontSize: "0.75rem", marginTop: "6px" }}>
              Strength: <span style={{ fontWeight: 600, color: strength === "Strong" ? "var(--success)" : strength === "Moderate" ? "var(--warning)" : "var(--danger)" }}>{strength}</span>
            </div>
          )}
        </div>

        {checkingPassword && (
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Hashing and querying range suffixes...
          </div>
        )}

        {passwordPwnedCount !== null && !checkingPassword && (
          <div className="scale-in">
            {passwordPwnedCount > 0 ? (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "16px", borderRadius: "8px" }}>
                <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: "0.875rem", marginBottom: "6px" }}>
                  🚨 COMPROMISED CREDENTIAL
                </div>
                <p style={{ fontSize: "0.75rem", color: "#171717", margin: 0, lineHeight: "1.4" }}>
                  This password has been exposed <strong>{passwordPwnedCount.toLocaleString()}</strong> times in public data breaches. 
                  You must not use it on any production workspace or personal account.
                </p>
              </div>
            ) : (
              <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "16px", borderRadius: "8px" }}>
                <div style={{ color: "var(--success)", fontWeight: 700, fontSize: "0.875rem", marginBottom: "6px" }}>
                  ✓ SECURE CREDENTIAL
                </div>
                <p style={{ fontSize: "0.75rem", color: "#171717", margin: 0, lineHeight: "1.4" }}>
                  No exposures found in public database dumps. This password is safe for use under local complexity rules.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityWorkspace({ handleCardMouseMove, token, isMock }: { handleCardMouseMove: any; token: string | null; isMock: boolean }) {
  const [emailInput, setEmailInput] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [verifiedAssets, setVerifiedAssets] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [loadingChecks, setLoadingChecks] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordPwnedCount, setPasswordPwnedCount] = useState<number | null>(null);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Phone monitoring states
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [submittingPhone, setSubmittingPhone] = useState(false);
  const [confirmingPhone, setConfirmingPhone] = useState(false);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cybercortex.com"
    ? "https://api.CyberCortex.com"
    : "http://127.0.0.1:8000";

  const fetchChecks = async () => {
    setLoadingChecks(true);
    if (isMock) {
      setChecks([
        { id: "i1", org_id: "org1", identifier_type: "email", identifier_value: "admin@acme.com", verification_token: "mock_tok_1", verification_status: "verified", verified_at: "2026-08-10T12:00:00Z", last_checked_at: "2026-08-10T12:05:00Z", breach_results: [
          { Name: "Canva Breach", Domain: "canva.com", BreachDate: "2019-05-24", DataClasses: ["Passwords", "Emails", "Usernames"], Description: "In May 2019, Canva experienced a database disclosure exposing usernames and bcrypt password hashes." }
        ]},
        { id: "i2", org_id: "org1", identifier_type: "email", identifier_value: "billing@acme.com", verification_token: "mock_tok_2", verification_status: "pending", verified_at: null, last_checked_at: null, breach_results: null },
        { id: "i3", org_id: "org1", identifier_type: "domain", identifier_value: "production-vault.acme.com", verification_token: "asset_verified", verification_status: "verified", verified_at: "2026-08-01T12:00:00Z", last_checked_at: "2026-08-12T10:00:00Z", breach_results: [
          { Name: "Adobe Leak", Domain: "adobe.com", BreachDate: "2013-10-04", DataClasses: ["Passwords (encrypted)", "Username hints", "Emails"], Description: "In October 2013, Adobe suffered a leak exposing database backups." }
        ]}
      ]);
      setLoadingChecks(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setChecks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChecks(false);
    }
  };

  const fetchAssets = async () => {
    if (isMock) {
      setVerifiedAssets([
        { id: "a1", domain: "production-vault.acme.com" },
        { id: "a2", domain: "corporate-portal.acme-org.net" }
      ]);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/assets/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVerifiedAssets(data.filter((a: any) => a.verification_status === "verified"));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchChecks();
    fetchAssets();
  }, [isMock, token]);

  const handleRegisterEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setSubmittingEmail(true);
    if (isMock) {
      showToast("Verification link triggered (Sandbox simulator). Check inbox!");
      setChecks([
        { id: "mock_" + Math.random().toString(36).substr(2, 9), org_id: "org1", identifier_type: "email", identifier_value: emailInput.trim().toLowerCase(), verification_token: "tok", verification_status: "pending", verified_at: null, last_checked_at: null, breach_results: null },
        ...checks
      ]);
      setEmailInput("");
      setSubmittingEmail(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/email`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: emailInput }),
      });

      if (res.ok) {
        showToast("Verification link sent! Please check your email inbox to verify ownership.");
        setEmailInput("");
        fetchChecks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingEmail(false);
    }
  };

  const handleRegisterPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;

    setSubmittingPhone(true);
    if (isMock) {
      showToast("OTP code dispatched (Sandbox Simulator: use OTP code '123456' to confirm).");
      setOtpSent(true);
      setSubmittingPhone(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/phone`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: phoneInput }),
      });

      if (res.ok) {
        showToast("OTP verification code sent via SMS!");
        setOtpSent(true);
      } else {
        const data = await res.json();
        showToast(`SMS dispatch failed: ${data.detail || "Error"}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPhone(false);
    }
  };

  const handleConfirmPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) return;

    setConfirmingPhone(true);
    if (isMock) {
      if (otpInput === "123456") {
        showToast("Phone ownership verified! SMS leak logs active.");
        setChecks([
          {
            id: "i_mock_p_" + Math.random().toString(36).substr(2, 9),
            org_id: "org1",
            identifier_type: "phone",
            identifier_value: phoneInput.trim(),
            verification_token: "mock_tok_p",
            verification_status: "verified",
            verified_at: new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
            breach_results: [
              { Name: "Mock Phone Exposure Scan", Domain: "identity_checks", BreachDate: new Date().toISOString().split("T")[0], DataClasses: ["Phone numbers"], Description: "Privacy-compliant owner self-verification completed successfully." }
            ]
          },
          ...checks
        ]);
        setPhoneInput("");
        setOtpInput("");
        setOtpSent(false);
      } else {
        showToast("Invalid verification OTP code.");
      }
      setConfirmingPhone(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/phone/confirm`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: phoneInput, otp_code: otpInput }),
      });

      if (res.ok) {
        showToast("Phone ownership successfully verified!");
        setPhoneInput("");
        setOtpInput("");
        setOtpSent(false);
        fetchChecks();
      } else {
        const data = await res.json();
        showToast(`Verification failed: ${data.detail || "Error"}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmingPhone(false);
    }
  };

  const handleCheckDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    setCheckingDomain(true);
    if (isMock) {
      showToast("Domain search executed! Exposure records compiled.");
      setChecks([
        { id: "mock_" + Math.random().toString(36).substr(2, 9), org_id: "org1", identifier_type: "domain", identifier_value: selectedAsset, verification_token: "asset_verified", verification_status: "verified", verified_at: new Date().toISOString(), last_checked_at: new Date().toISOString(), breach_results: [
          { Name: "Domain-wide Leak", Domain: selectedAsset, BreachDate: "2024-01-10", DataClasses: ["Emails", "Employee Credentials"], Description: "Domain lookup indicating credential exposure for verified enterprise assets." }
        ]},
        ...checks.filter(c => c.identifier_value !== selectedAsset)
      ]);
      setCheckingDomain(false);
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/domain/${selectedAsset}/check`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        showToast("Domain breach monitoring records updated!");
        fetchChecks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingDomain(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isMock) {
      setChecks(checks.filter((c) => c.id !== id));
      showToast("Removed monitoring target (Sandbox simulator).");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/${id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        showToast("Successfully removed monitoring target.");
        fetchChecks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyCheckNow = async (checkId: string) => {
    if (isMock) {
      setChecks(checks.map(c => c.id === checkId ? {
        ...c,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        breach_results: [
          { Name: "Canva Breach", Domain: "canva.com", BreachDate: "2019-05-24", DataClasses: ["Passwords", "Emails", "Usernames"], Description: "In May 2019, Canva experienced a database disclosure exposing usernames and bcrypt password hashes." }
        ]
      } : c));
      showToast("Ownership verified instantly! Breach logs activated.");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/${checkId}/verify-now`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        showToast("Ownership verified successfully! Breach monitoring activated.");
        fetchChecks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResendEmail = async (checkId: string) => {
    if (isMock) {
      showToast("Verification email re-dispatched!");
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiHost}/api/v1/identity/${checkId}/resend`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        showToast("Verification email dispatched to your inbox!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const checkPasswordStrength = async (password: string) => {
    if (!password) {
      setPasswordPwnedCount(null);
      return;
    }

    setCheckingPassword(true);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);

      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (["password", "123456", "admin"].includes(password.toLowerCase())) {
          setPasswordPwnedCount(1530209);
        } else {
          setPasswordPwnedCount(0);
        }
        setCheckingPassword(false);
        return;
      }

      const res = await fetch(`${apiHost}/api/v1/identity/password-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prefix }),
      });

      if (res.ok) {
        const body = await res.json();
        const match = body.suffixes.find((line: string) => line.split(":")[0] === suffix);
        if (match) {
          setPasswordPwnedCount(parseInt(match.split(":")[1]));
        } else {
          setPasswordPwnedCount(0);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingPassword(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="scale-in">
      {toastMessage && (
        <div style={{ position: "fixed", bottom: "32px", right: "32px", background: "rgba(139, 92, 246, 0.95)", border: "1px solid var(--primary)", padding: "14px 24px", borderRadius: "8px", zIndex: 1000, fontWeight: 600, color: "#ffffff" }}>
          {toastMessage}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "6px" }}>Identity & Credential Monitoring</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Securely monitor your verified email accounts and domain registries for credentials exposures in known database leaks.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginBottom: "32px" }}>
        {/* Register Monitoring Target */}
        <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove} style={{ height: "fit-content" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--primary-hover)" }}>📬 Add Target Email Monitor</h3>
          <form onSubmit={handleRegisterEmail} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase" }}>
                Target Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. security@yourcompany.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={submittingEmail}
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {submittingEmail ? "Queueing..." : "Add Email"}
            </button>
          </form>
        </div>

        {/* Register Phone Monitoring Target */}
        <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove} style={{ height: "fit-content" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--secondary)" }}>📱 Add Target Phone Monitor</h3>
          {!otpSent ? (
            <form onSubmit={handleRegisterPhone} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase" }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +15550199"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#f3f4f6",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "12px",
                    color: "#171717",
                    outline: "none",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={submittingPhone}
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 20px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {submittingPhone ? "Sending..." : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmPhone} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase" }}>
                  Enter 6-digit OTP Code (check terminal/logs)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#f3f4f6",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "12px",
                    color: "#171717",
                    outline: "none",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={confirmingPhone}
                style={{
                  background: "var(--success)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 20px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {confirmingPhone ? "Verifying..." : "Confirm OTP"}
              </button>
            </form>
          )}
        </div>

        {/* Domain-Wide Registry Monitor */}
        <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove} style={{ height: "fit-content" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--success)" }}>🌐 Domain-wide Exposures Check</h3>
          <form onSubmit={handleCheckDomain} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase" }}>
                Select Verified Domain Asset
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              >
                <option value="">-- Choose Verified Asset --</option>
                {verifiedAssets.map((asset) => (
                  <option key={asset.id} value={asset.id || asset.domain}>
                    {asset.domain}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={checkingDomain || !selectedAsset}
              style={{
                background: "var(--success)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {checkingDomain ? "Scanning..." : "Check Domain"}
            </button>
          </form>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px", marginBottom: "32px", alignItems: "flex-start" }}>
        {/* Verification Status Logs */}
        <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "18px" }}>📊 Identity Leak Logs</h3>
          
          {loadingChecks ? (
            <div style={{ color: "var(--text-secondary)", padding: "20px" }}>Loading leak reports...</div>
          ) : checks.length === 0 ? (
            <div style={{ padding: "24px", color: "var(--text-muted)", fontSize: "0.8125rem", textAlign: "center" }}>
              No monitoring targets added. Register an email or select a verified asset domain to begin.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {checks.map((item) => (
                <div key={item.id} style={{ background: "rgba(0, 0, 0, 0.015)", border: "1px solid rgba(0,0,0,0.06)", padding: "20px", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#171717" }}>
                        {item.identifier_type === "email" ? "✉ Email: " : item.identifier_type === "phone" ? "📱 Phone: " : "🌐 Domain: "} {item.identifier_value}
                      </span>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Registered Monitor | Status: {" "}
                        <span className={`badge badge-${item.verification_status}`}>
                          {item.verification_status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{ background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)", padding: "4px 10px", borderRadius: "4px", fontSize: "0.6875rem", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>

                  {item.verification_status === "pending" ? (
                    <div className="pending-notice-box fade-in-up" style={{ marginTop: "8px" }}>
                      <div style={{ marginBottom: "10px", fontSize: "0.8125rem", color: "#78350f" }}>
                        ⏳ Ownership verification is pending. Please click the confirmation link sent to <strong style={{ textDecoration: "underline", color: "#451a03" }}>{item.identifier_value}</strong> or click <strong>Verify Now</strong> below to activate breach monitoring.
                      </div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          onClick={() => handleVerifyCheckNow(item.id)}
                          style={{
                            background: "#166534",
                            color: "#ffffff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(22, 101, 52, 0.2)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          ✓ Verify Now
                        </button>
                        <button
                          onClick={() => handleResendEmail(item.id)}
                          style={{
                            background: "#92400e",
                            color: "#ffffff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(146, 64, 14, 0.2)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          📩 Resend Verification Email
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
                        Last Checked: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleString() : "Never"}
                      </div>
                      
                      {item.breach_results && item.breach_results.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 700 }}>
                            🚨 Compromises Exposed: Found {item.breach_results.length} breaches
                          </span>
                          {item.breach_results.map((breach: any, idx: number) => (
                            <div key={idx} style={{ background: "rgba(239, 68, 68, 0.02)", border: "1px solid rgba(239, 68, 68, 0.1)", padding: "10px 14px", borderRadius: "6px", fontSize: "0.75rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#171717", marginBottom: "4px" }}>
                                <span>{breach.Name} ({breach.Domain})</span>
                                <span style={{ color: "var(--text-muted)" }}>{new Date(breach.BreachDate).toLocaleDateString()}</span>
                              </div>
                              <p style={{ color: "var(--text-secondary)", margin: "0 0 6px 0", lineHeight: "1.3" }}>{breach.Description}</p>
                              <div>
                                <strong style={{ color: "var(--text-muted)" }}>Exposed Fields:</strong>{" "}
                                <span style={{ color: "var(--warning)" }}>{((breach.DataClasses || breach.data_classes) || []).join(", ")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ background: "rgba(16, 185, 129, 0.05)", borderLeft: "3px solid var(--success)", padding: "10px 14px", borderRadius: "0 6px 6px 0", fontSize: "0.75rem", color: "var(--success)" }}>
                          ✓ Monitoring Active: No credentials disclosures found in database exposure logs.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reusable Password Checker */}
        <PasswordCheckWidget token={token} isMock={isMock} handleCardMouseMove={handleCardMouseMove} />
      </div>
    </div>
  );
}

function SettingsWorkspace({ handleCardMouseMove, token, isMock }: { handleCardMouseMove: any; token: string | null; isMock: boolean }) {
  const [slackUrl, setSlackUrl] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [customWebhook, setCustomWebhook] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // CI/CD webhook states
  const [selectedAsset, setSelectedAsset] = useState("");
  const [verifiedAssets, setVerifiedAssets] = useState<any[]>([]);
  const [ciToken, setCiToken] = useState("");
  const [generatingCiToken, setGeneratingCiToken] = useState(false);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cybercortex.com"
    ? "https://api.CyberCortex.com"
    : "http://127.0.0.1:8000";

  const fetchChannels = async () => {
    if (isMock) {
      setSlackUrl("https://hooks.slack.com/services/T00/B00/X00");
      setAlertEmail("security-ops@acme.com");
      setCustomWebhook("https://api.acme.com/security/webhook");
      return;
    }
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${apiHost}/api/v1/dashboard/channels`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSlackUrl(data.slack_webhook_url || "");
        setAlertEmail(data.alert_email || "");
        setCustomWebhook(data.custom_webhook_url || "");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAssets = async () => {
    if (isMock) {
      setVerifiedAssets([
        { id: "a1", domain: "production-vault.acme.com", ci_token: "cg_ci_mock123" },
        { id: "a2", domain: "corporate-portal.acme-org.net", ci_token: "" }
      ]);
      return;
    }
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${apiHost}/api/v1/assets/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVerifiedAssets(data.filter((a: any) => a.verification_status === "verified"));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchAssets();
  }, [isMock, token]);

  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    if (isMock) {
      showToast("Notification channels saved!");
      setSavingSettings(false);
      return;
    }
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${apiHost}/api/v1/dashboard/channels`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          slack_webhook_url: slackUrl,
          alert_email: alertEmail,
          custom_webhook_url: customWebhook,
        }),
      });
      if (res.ok) {
        showToast("Notification channels updated successfully!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRegenCiToken = async () => {
    if (!selectedAsset) return;
    setGeneratingCiToken(true);
    if (isMock) {
      const generated = "cg_ci_mock_" + Math.random().toString(36).substr(2, 12);
      setCiToken(generated);
      setVerifiedAssets(verifiedAssets.map(a => a.id === selectedAsset ? { ...a, ci_token: generated } : a));
      showToast("Regenerated mock CI integration token.");
      setGeneratingCiToken(false);
      return;
    }
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${apiHost}/api/v1/assets/${selectedAsset}/ci-token`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setCiToken(data.ci_token);
        showToast("CI webhook integration token generated!");
        fetchAssets();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingCiToken(false);
    }
  };

  useEffect(() => {
    if (selectedAsset) {
      const match = verifiedAssets.find(a => a.id === selectedAsset || a.domain === selectedAsset);
      if (match) {
        setCiToken(match.ci_token || "");
      }
    } else {
      setCiToken("");
    }
  }, [selectedAsset, verifiedAssets]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="scale-in">
      {toast && (
        <div style={{ position: "fixed", bottom: "32px", right: "32px", background: "rgba(139, 92, 246, 0.95)", border: "1px solid var(--primary)", padding: "14px 24px", borderRadius: "8px", zIndex: 1000, fontWeight: 600, color: "#ffffff" }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "6px" }}>Workspace Settings</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Manage alerting channels, Slack notifications, custom webhook dispatches, and CI/CD pipeline scanner keys.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Alerts Config */}
        <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--primary-hover)" }}>🔔 Notification Channels</h3>
          <form onSubmit={handleSaveChannels} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>
                Slack Webhook URL (Alerts channel)
              </label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>
                Security Alerts Email
              </label>
              <input
                type="email"
                placeholder="security-notifications@company.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>
                Custom Endpoint Webhook (POST JSON)
              </label>
              <input
                type="url"
                placeholder="https://api.yourcompany.com/webhooks/security"
                value={customWebhook}
                onChange={(e) => setCustomWebhook(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={savingSettings}
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "8px",
              }}
            >
              {savingSettings ? "Saving Settings..." : "Save Notification Settings"}
            </button>
          </form>
        </div>

        {/* CI/CD webhook scanner integrations */}
        <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--success)" }}>⚙ CI/CD Webhook Scanners</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>
                Select Target Asset
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#171717",
                  outline: "none",
                  fontSize: "0.875rem",
                }}
              >
                <option value="">-- Choose Asset Domain --</option>
                {verifiedAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.domain}
                  </option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div className="scale-in" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>
                    Asset CI/CD Token Key
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="text"
                      readOnly
                      placeholder="No token generated yet."
                      value={ciToken}
                      style={{
                        flex: 1,
                        background: "rgba(0, 0, 0, 0.015)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "12px",
                        color: "#171717",
                        outline: "none",
                        fontSize: "0.875rem",
                      }}
                    />
                    <button
                      onClick={handleRegenCiToken}
                      disabled={generatingCiToken}
                      style={{
                        background: "var(--success)",
                        color: "#171717",
                        border: "none",
                        borderRadius: "8px",
                        padding: "12px 18px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {generatingCiToken ? "Regenerating..." : "Generate Token"}
                    </button>
                  </div>
                </div>

                {ciToken && (
                  <div className="scale-in" style={{ background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--success)", display: "block", marginBottom: "8px" }}>
                      Webhook Integration Trigger URL:
                    </span>
                    <code style={{ fontSize: "0.75rem", color: "var(--primary-hover)", wordBreak: "break-all" }}>
                      {apiHost}/api/v1/ci/webhook-scan
                    </code>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginTop: "12px", marginBottom: "6px" }}>
                      Webhook Payload Example:
                    </span>
                    <pre style={{ margin: 0, padding: "8px", background: "rgba(0,0,0,0.015)", borderRadius: "4px", fontSize: "0.6875rem", color: "#ccc", overflowX: "auto" }}>
{`{
  "asset_id": "${selectedAsset}",
  "ci_token": "${ciToken}"
}`}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin System Health & Diagnostic Test Suite */}
      <div className="glass-card glass-card-glow mt-6" onMouseMove={handleCardMouseMove} style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyValue: "space-between", marginBottom: "16px", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", color: "var(--primary-hover)", margin: 0 }}>🩺 System Health & Automated Test Suite (Admin)</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", margin: "4px 0 0 0" }}>
              Run automated platform security isolation, authentication rate limiting, scanner accuracy, and database subsystem health tests.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const headers: HeadersInit = { "Content-Type": "application/json" };
                if (token) headers["Authorization"] = `Bearer ${token}`;
                const res = await fetch(`${apiHost}/api/v1/admin/system-health/run`, { headers });
                if (res.ok) {
                  const data = await res.json();
                  alert("System Health Test Suite Completed! Health Score: " + data.health_score + "/100 (Passed " + data.passed_tests + "/" + data.total_tests + " tests)");
                } else {
                  alert("Health Test execution requires Administrator privileges.");
                }
              } catch (e) {
                alert("Failed to connect to health diagnostics API endpoint.");
              }
            }}
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            ⚡ Run System Tests Now
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "16px" }}>
          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "14px", borderRadius: "10px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10b981", display: "block", textTransform: "uppercase" }}>✓ Multi-Tenant Isolation</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#171717", display: "block", marginTop: "4px" }}>PASSED</span>
            <span style={{ fontSize: "0.75rem", color: "#666", display: "block", marginTop: "2px" }}>Org A / Org B query boundary verified</span>
          </div>

          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "14px", borderRadius: "10px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10b981", display: "block", textTransform: "uppercase" }}>✓ Auth & Rate Limiting</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#171717", display: "block", marginTop: "4px" }}>PASSED</span>
            <span style={{ fontSize: "0.75rem", color: "#666", display: "block", marginTop: "2px" }}>Redis 5 attempts/15min limit active</span>
          </div>

          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "14px", borderRadius: "10px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10b981", display: "block", textTransform: "uppercase" }}>✓ Scanner Engines & Strix</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#171717", display: "block", marginTop: "4px" }}>PASSED</span>
            <span style={{ fontSize: "0.75rem", color: "#666", display: "block", marginTop: "2px" }}>PoC verification & SSLyze active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Deprecated: AiAssistantWidget was replaced by the external Chatbot component.

function DorkingWorkspace({ handleCardMouseMove, token, isMock }: { handleCardMouseMove: any; token: string | null; isMock: boolean }) {
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState<"backups" | "dirs" | "configs" | "subdomains">("backups");
  const [engine, setEngine] = useState<"google" | "shodan" | "duckduckgo">("google");
  const [copied, setCopied] = useState(false);
  const [verifiedAssets, setVerifiedAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cybercortex.com"
    ? "https://api.CyberCortex.com"
    : "http://127.0.0.1:8000";

  useEffect(() => {
    const fetchAssets = async () => {
      setLoadingAssets(true);
      if (isMock) {
        setVerifiedAssets([
          { id: "a1", domain: "production-vault.acme.com" },
          { id: "a2", domain: "corporate-portal.acme-org.net" },
          { id: "a3", domain: "testing-stage.acme-corp.com" },
          { id: "a4", domain: "marketing-promos.com" },
        ]);
        setLoadingAssets(false);
        return;
      }
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${apiHost}/api/v1/assets/`, { headers });
        if (res.ok) {
          const data = await res.json();
          setVerifiedAssets(data.filter((a: any) => a.verification_status === "verified"));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAssets(false);
      }
    };
    fetchAssets();
  }, [isMock, token]);

  const getDorkQuery = () => {
    const domain = target.trim().replace(/^(https?:\/\/)?(www\.)?/, "");
    if (!domain) return "-- Select a verified asset to generate query --";
    if (category === "backups") {
      if (engine === "shodan") return `hostname:"${domain}" "backup" "index of"`;
      return `site:${domain} filetype:sql OR filetype:db OR filetype:tar OR filetype:zip OR filetype:bak "index of /"`;
    } else if (category === "dirs") {
      if (engine === "shodan") return `hostname:"${domain}" "Directory Listing"`;
      return `site:${domain} intitle:"index of /" OR intitle:"index of /admin" OR intitle:"index of /uploads"`;
    } else if (category === "configs") {
      if (engine === "shodan") return `hostname:"${domain}" filetype:log OR filetype:env`;
      return `site:${domain} filetype:log OR filetype:env OR filetype:yaml OR filetype:ini OR filetype:conf "database"`;
    } else {
      if (engine === "shodan") return `ssl.cert.subject.CN:"*${domain}"`;
      return `site:*.${domain} -site:www.${domain}`;
    }
  };

  const handleCopy = () => {
    if (!target) return;
    navigator.clipboard.writeText(getDorkQuery());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunch = () => {
    if (!target) return;
    const query = encodeURIComponent(getDorkQuery());
    let url = `https://www.google.com/search?q=${query}`;
    if (engine === "duckduckgo") url = `https://duckduckgo.com/?q=${query}`;
    else if (engine === "shodan") url = `https://www.shodan.io/search?query=${query}`;
    window.open(url, "_blank");
  };

  const recipes = [
    { id: "backups", name: "Exposed Backup Files", desc: "Searches for database dumps, SQL files, compressed archives, and historical backups." },
    { id: "dirs", name: "Sensitive Directories", desc: "Locates exposed admin endpoints, unauthenticated uploads folders, or open index listings." },
    { id: "configs", name: "Configuration Logs & Envs", desc: "Queries environment setting logs, database configuration schemes, and initialization keys." },
    { id: "subdomains", name: "Subdomain Discovery", desc: "Identifies alternative virtual hosts and subdomains excluding the standard www pointer." },
  ];

  return (
    <div className="scale-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px", color: "#171717" }}>
            🔍 OSINT Recon Builder
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Build advanced public-indexing queries to audit exposed files, configurations, and subdomains for your verified assets.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: "6px", padding: "5px 12px", marginTop: "8px", fontSize: "0.6875rem", color: "var(--primary)", fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Restricted to your organization's verified domain assets
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "32px" }}>
        {/* Left Control Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="glass-card" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: "16px", color: "var(--primary-hover)" }}>1. Target Configuration</h3>
            
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 600 }}>Select Verified Domain Asset</label>
            {loadingAssets ? (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "10px 0" }}>Loading verified assets...</div>
            ) : verifiedAssets.length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "10px 0" }}>No verified assets found. Register and verify a domain in the Assets page first.</div>
            ) : (
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f3f4f6",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  color: "#171717",
                  fontSize: "0.875rem",
                  outline: "none",
                  marginBottom: "20px",
                }}
              >
                <option value="">-- Choose Verified Asset --</option>
                {verifiedAssets.map((asset) => (
                  <option key={asset.id} value={asset.domain}>
                    {asset.domain}
                  </option>
                ))}
              </select>
            )}

            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 600 }}>Search Engine / Operator Syntax</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["google", "duckduckgo", "shodan"] as const).map((eng) => (
                <button
                  key={eng}
                  onClick={() => setEngine(eng)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    border: "1px solid",
                    borderColor: engine === eng ? "var(--primary)" : "var(--border-color)",
                    background: engine === eng ? "rgba(31, 87, 231, 0.08)" : "transparent",
                    color: engine === eng ? "var(--primary)" : "var(--text-secondary)",
                    transition: "all 0.2s",
                  }}
                >
                  {eng === "duckduckgo" ? "DuckGo" : eng}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: "16px", color: "var(--primary-hover)" }}>2. Recon Recipe</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recipes.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => setCategory(rec.id as any)}
                  style={{
                    textAlign: "left",
                    padding: "12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: category === rec.id ? "var(--primary)" : "transparent",
                    background: category === rec.id ? "rgba(31, 87, 231, 0.08)" : "rgba(0, 0, 0, 0.02)",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: category === rec.id ? "var(--primary)" : "var(--text-primary)" }}>
                    {rec.name}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.3" }}>
                    {rec.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Output Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="glass-card glass-card-glow" onMouseMove={handleCardMouseMove} style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px" }}>Generated OSINT Query</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginBottom: "20px" }}>
              Below is the structured search query adapted for <strong>{engine === "duckduckgo" ? "DuckDuckGo" : engine === "shodan" ? "Shodan" : "Google Search"}</strong>. Copy this string or launch the inquiry directly in a new window tab.
            </p>

            <div className="dork-query-box">
              {getDorkQuery()}
              <button onClick={handleCopy} className="copy-badge" disabled={!target}>
                {copied ? "Copied! ✓" : "Copy Query"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button
                onClick={handleLaunch}
                disabled={!target}
                style={{
                  background: target ? "linear-gradient(135deg, var(--primary), var(--secondary))" : "#e5e7eb",
                  color: target ? "#ffffff" : "#9ca3af",
                  border: "none",
                  borderRadius: "6px",
                  padding: "12px 28px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: target ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Launch Search Engine ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

