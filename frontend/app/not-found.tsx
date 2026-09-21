import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div
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
        backgroundImage: "radial-gradient(at 100% 100%, rgba(15, 23, 42, 0.03) 0px, transparent 50%)",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          borderRadius: "12px",
          padding: "40px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.06)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "6rem",
            fontWeight: 800,
            margin: 0,
            background: "linear-gradient(135deg, #ea580c, #f59e0b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: "1",
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginTop: "16px",
            marginBottom: "12px",
            color: "#ffffff",
          }}
        >
          Endpoint Not Located
        </h2>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            lineHeight: "1.5",
            marginBottom: "32px",
          }}
        >
          The requested security dashboard route or API documentation target does not exist or has been relocated to a secure partition.
        </p>

        <a
          href="/"
          style={{
            display: "inline-block",
            background: "linear-gradient(135deg, #ea580c, #f59e0b)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "12px 28px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.875rem",
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}
