"use client";

import dynamic from "next/dynamic";

// ConnectWalletButton uses Privy hooks — must be dynamically imported client-side
const ConnectWalletButton = dynamic(() => import("./ConnectWalletButton"), {
  ssr: false,
  loading: () => <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />,
});

const ConnectWalletButtonFallback = dynamic(
  () => import("./ConnectWalletButton").then((m) => ({ default: m.ConnectWalletButtonFallback })),
  { ssr: false },
);

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export default function HeaderAuthButton() {
  if (!PRIVY_APP_ID) return <ConnectWalletButtonFallback />;
  return <ConnectWalletButton />;
}
