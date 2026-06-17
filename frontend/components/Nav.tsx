"use client";

import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

export function Nav() {
  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 32px",
      borderBottom: "1px solid #1a1a1a",
      position: "sticky",
      top: 0,
      background: "#0a0a0a",
      zIndex: 10,
    }}>
      <Link href="/" style={{ color: "#e5e5e5", textDecoration: "none", fontWeight: "bold", fontSize: 16 }}>
        0G Time Capsule
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link href="/seal"     style={navLink}>Seal</Link>
        <Link href="/gallery"  style={navLink}>My Capsules</Link>
        <Link href="/reveal"   style={navLink}>Open</Link>
        <Link href="/register" style={navLink}>Register Key</Link>
        <Link href="/onboard"  style={{ ...navLink, color: "#a5b4fc" }}>Get started</Link>
        <ConnectButton />
      </div>
    </nav>
  );
}

const navLink: React.CSSProperties = {
  color: "#888",
  textDecoration: "none",
  fontSize: 14,
};
