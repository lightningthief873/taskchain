import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import PrivyProviderWrapper from "@/components/PrivyProviderWrapper";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "TaskChain — Autonomous Multi-Agent Economy on Avalanche",
  description: "Autonomous task orchestration with x402 payments and ERC-8004 reputation on Fuji",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: "var(--bg)" }}>
        <PrivyProviderWrapper>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" },
              success: { iconTheme: { primary: "#e84142", secondary: "#fff" } },
            }}
          />
          <AppHeader />
          <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">{children}</main>
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
