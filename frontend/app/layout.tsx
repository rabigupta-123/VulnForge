import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CyberGuardian AI | Security Audit & Threat Remediation Dashboard",
  description: "Automated hybrid passive & light active security assessment guides mapped to CVSS, OWASP, and MITRE.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background text-text-primary min-h-screen font-sans flex flex-col antialiased bg-grid-pattern relative">
        {/* Subtle Noise Overlay for Texture */}
        <div className="absolute inset-0 bg-noise-overlay pointer-events-none z-[1]" />
        
        {/* Content Wrapper */}
        <div className="relative z-10 flex flex-col min-h-screen w-full">
          {children}
        </div>
      </body>
    </html>
  );
}
