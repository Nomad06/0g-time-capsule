import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "120px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 40, marginBottom: 12 }}>0G Time Capsule</h1>
      <p style={{ color: "#888", fontSize: 18, marginBottom: 48 }}>
        Seal a message now. Prove it later. No third party.
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <Link href="/seal" style={linkStyle("#4f46e5")}>
          Create Capsule
        </Link>
        <Link href="/reveal/0x" style={linkStyle("#1a1a1a")}>
          Open Capsule
        </Link>
      </div>
      <div style={{ marginTop: 80, color: "#444", fontSize: 13 }}>
        <p>Storage: 0G Storage &nbsp;|&nbsp; Logic: 0G Chain &nbsp;|&nbsp; Key release: drand quicknet</p>
      </div>
    </main>
  );
}

function linkStyle(bg: string): React.CSSProperties {
  return {
    padding: "14px 32px",
    background: bg,
    color: "#fff",
    textDecoration: "none",
    borderRadius: 8,
    fontSize: 16,
    border: "1px solid #333",
  };
}
