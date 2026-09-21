"use client";

import React, { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console or error reporter service
    console.error("Caught global rendering error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#ffffff",
          color: "#0f172a",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "20px",
          backgroundImage: "radial-gradient(at 0% 0%, rgba(239, 68, 68, 0.02) 0px, transparent 50%)",
        }}
      >
        <div
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(239, 68, 68, 0.15)",
            borderRadius: "12px",
            padding: "40px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "20px",
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "12px",
              color: "#ef4444",
            }}
          >
            Application Crash Prevented
          </h2>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "0.875rem",
              lineHeight: "1.5",
              marginBottom: "24px",
            }}
          >
            A client-side exception occurred in the dashboard rendering layer. CyberCortex's secure sandbox has intercepted the crash.
          </p>

          {error.message && (
            <div
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "6px",
                padding: "12px",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                textAlign: "left",
                color: "#e5e7eb",
                wordBreak: "break-all",
                maxHeight: "100px",
                overflowY: "auto",
                marginBottom: "24px",
              }}
            >
              {error.message}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                background: "linear-gradient(135deg, #ea580c, #f59e0b)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 24px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.875rem",
                transition: "opacity 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Try Recovering Page
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                color: "#9ca3af",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                borderRadius: "8px",
                padding: "12px 24px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
