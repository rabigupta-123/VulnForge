"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, ChevronDown, ChevronUp, Terminal as TerminalIcon } from "lucide-react";

interface TerminalLogProps {
  scanId: string;
  isScanCompleted?: boolean;
  onCopyToast?: (msg: string) => void;
}

export default function TerminalLog({ scanId, isScanCompleted = false, onCopyToast }: TerminalLogProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const apiHost = typeof window !== "undefined" && window.location.hostname === "cyberguardian.ai"
    ? "api.cyberguardian.ai"
    : "127.0.0.1:8000";

  // WebSocket Live Stream + Polling Fallback Effect
  useEffect(() => {
    if (!scanId) return;

    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    // 1. Initial HTTP log fetch
    const fetchInitialLogs = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://${apiHost}/api/v1/scans/${scanId}/logs`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.logs && Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
        }
      } catch (err) {
        console.error("Failed to fetch initial logs", err);
      }
    };

    fetchInitialLogs();

    // 2. Connect WebSocket
    const wsUrl = `ws://${apiHost}/api/v1/scans/${scanId}/logs/stream`;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setIsConnected(true);
      };
      ws.onmessage = (event) => {
        const line = event.data;
        if (line) {
          setLogs((prev) => {
            if (prev.includes(line)) return prev;
            return [...prev, line];
          });
        }
      };
      ws.onerror = () => {
        setIsConnected(false);
      };
      ws.onclose = () => {
        setIsConnected(false);
      };
    } catch (err) {
      console.warn("WebSocket stream failed, reverting to HTTP polling:", err);
    }

    // 3. Fallback polling if WebSocket is disconnected or completed
    pollInterval = setInterval(async () => {
      if (!isScanCompleted && !ws) {
        await fetchInitialLogs();
      }
    }, 2000);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [scanId, apiHost, isScanCompleted]);

  // Auto-scroll to bottom as logs arrive
  useEffect(() => {
    if (!isCollapsed && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isCollapsed]);

  const handleCopyLogs = () => {
    const fullText = logs.join("\n");
    navigator.clipboard.writeText(fullText);
    if (onCopyToast) {
      onCopyToast("Terminal execution log copied to clipboard!");
    }
  };

  const parseLineColor = (line: string) => {
    if (line.includes("[ERROR]") || line.includes("failed") || line.includes("Critical")) {
      return "text-red-400 font-semibold";
    }
    if (line.includes("[WARN]") || line.includes("[WARNING]")) {
      return "text-amber-400 font-semibold";
    }
    if (line.includes("completed") || line.includes("Generated") || line.includes("SUCCESS")) {
      return "text-emerald-400 font-bold";
    }
    if (line.includes("[SSLyze]") || line.includes("[Nmap]") || line.includes("[OWASP ZAP]")) {
      return "text-cyan-300 font-medium";
    }
    return "text-slate-300";
  };

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] shadow-2xl overflow-hidden font-mono text-xs my-4">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-slate-800 select-none">
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 tracking-wide uppercase text-[11px]">
            Live Terminal Execution Log
          </span>
          <span className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
            {isConnected ? "WEBSOCKET STREAM ACTIVE" : isScanCompleted ? "EXECUTION COMPLETE" : "POLLING REPLAY"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLogs}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700 cursor-pointer"
          >
            <Copy className="w-3 h-3" />
            Copy Logs
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700 cursor-pointer"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Read-Only Body */}
      {!isCollapsed && (
        <div
          ref={containerRef}
          className="p-4 max-h-[320px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
          style={{ backgroundColor: "#060911" }}
        >
          {logs.length === 0 ? (
            <div className="text-slate-500 italic py-4 text-center">
              Connecting to scan execution log stream...
            </div>
          ) : (
            logs.map((line, idx) => (
              <div key={idx} className={`leading-relaxed whitespace-pre-wrap ${parseLineColor(line)}`}>
                {line}
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      )}
    </div>
  );
}
