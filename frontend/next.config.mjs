/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow build-time injection from Docker ARGs
  env: {
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "",
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005",
    NEXT_PUBLIC_FUJI_RPC: process.env.NEXT_PUBLIC_FUJI_RPC ?? "https://api.avax-test.network/ext/bc/C/rpc",
    NEXT_PUBLIC_AGENT_REGISTRY: process.env.NEXT_PUBLIC_AGENT_REGISTRY ?? "0xdDe74f96020161783d2663999f531a316904105e",
    NEXT_PUBLIC_ROUTER_URL: process.env.NEXT_PUBLIC_ROUTER_URL ?? "http://localhost:3000",
  },
};
export default nextConfig;
