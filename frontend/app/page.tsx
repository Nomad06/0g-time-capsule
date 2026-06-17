import Link from "next/link";

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section style={heroSection}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={heroBadge}>Built on 0G Chain + 0G Storage</div>
          <h1 style={heroTitle}>
            Seal a secret.<br />
            Prove it later.<br />
            <span style={{ color: "#818cf8" }}>No third party.</span>
          </h1>
          <p style={heroSub}>
            Encrypt any message on-chain. Locked until a future date, a missed check-in,
            or a multi-sig vote. When revealed, the on-chain commitment proves it was never changed.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/onboard" style={ctaPrimary}>Start here →</Link>
            <Link href="/seal"    style={ctaSecondary}>Create capsule</Link>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section style={section}>
        <div style={sectionInner}>
          <p style={sectionLabel}>Use cases</p>
          <h2 style={sectionTitle}>What people seal</h2>
          <div style={cardGrid}>
            {USE_CASES.map(uc => (
              <div key={uc.emoji} style={useCaseCard}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{uc.emoji}</div>
                <h3 style={{ fontSize: 16, fontWeight: "bold", margin: "0 0 8px", color: "#e5e5e5" }}>
                  {uc.title}
                </h3>
                <p style={{ color: "#666", fontSize: 14, margin: 0, lineHeight: 1.6 }}>{uc.desc}</p>
                <div style={{ marginTop: 14 }}>
                  <span style={triggerBadge(uc.triggerColor)}>{uc.trigger}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ ...section, background: "#050505" }}>
        <div style={sectionInner}>
          <p style={sectionLabel}>How it works</p>
          <h2 style={sectionTitle}>Three steps, zero trust</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={stepRow}>
                <div style={stepNum}>{i + 1}</div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: "bold", margin: "0 0 4px", color: "#e5e5e5" }}>
                    {s.title}
                  </h3>
                  <p style={{ color: "#666", fontSize: 14, margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                  <code style={{ fontSize: 12, color: "#444", marginTop: 6, display: "block" }}>{s.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Triggers */}
      <section style={section}>
        <div style={sectionInner}>
          <p style={sectionLabel}>Trigger types</p>
          <h2 style={sectionTitle}>Unlock on your terms</h2>
          <div style={cardGrid}>
            {TRIGGERS.map(t => (
              <div key={t.name} style={{ ...useCaseCard, borderColor: t.border }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{t.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 8px", color: "#e5e5e5" }}>
                  {t.name}
                </h3>
                <p style={{ color: "#666", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section style={{ ...section, background: "#050505" }}>
        <div style={{ ...sectionInner, textAlign: "center" }}>
          <p style={sectionLabel}>Architecture</p>
          <h2 style={{ ...sectionTitle, marginBottom: 32 }}>Fully on-chain. No trusted server.</h2>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            {STACK.map(s => (
              <div key={s.name} style={stackChip}>
                <span style={{ color: "#e5e5e5", fontWeight: "bold", fontSize: 13 }}>{s.name}</span>
                <span style={{ color: "#555", fontSize: 12 }}>{s.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ ...section, textAlign: "center" }}>
        <div style={sectionInner}>
          <h2 style={{ ...sectionTitle, marginBottom: 12 }}>Ready to seal your first capsule?</h2>
          <p style={{ color: "#666", marginBottom: 32 }}>
            Takes 2 minutes. No sign-up. Connect any EVM wallet.
          </p>
          <Link href="/onboard" style={ctaPrimary}>Get started →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={footer}>
        <p style={{ margin: 0, color: "#333", fontSize: 13 }}>
          0G Time Capsule — built on{" "}
          <a href="https://0g.ai" style={{ color: "#555" }} target="_blank" rel="noopener noreferrer">0G Network</a>
          {" "}·{" "}
          <a href="https://github.com/Nomad06/0g-time-capsule" style={{ color: "#555" }} target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </main>
  );
}

const USE_CASES = [
  {
    emoji:        "🔮",
    title:        "Crypto predictions",
    desc:         "Seal your price targets or on-chain thesis. When you're right, reveal and prove you called it — timestamped and tamper-proof.",
    trigger:      "Time lock",
    triggerColor: "#1e1b4b",
  },
  {
    emoji:        "📜",
    title:        "Digital legacy",
    desc:         "Write a letter to your children or loved ones. Set a dead man's switch — if you stop checking in, the capsule unlocks automatically.",
    trigger:      "Dead Man's Switch",
    triggerColor: "#422006",
  },
  {
    emoji:        "⚖️",
    title:        "DAO governance",
    desc:         "Seal a proposal or decision before the vote. Require M-of-N board members to approve the reveal — fully on-chain accountability.",
    trigger:      "Multi-Sig",
    triggerColor: "#1e1b4b",
  },
  {
    emoji:        "🔑",
    title:        "Private delivery",
    desc:         "Send a secret to a specific wallet. Only the designated recipient can decrypt — even after the capsule is publicly revealed.",
    trigger:      "ECIES recipients",
    triggerColor: "#052e16",
  },
];

const STEPS = [
  {
    title: "Seal",
    desc:  "Write your message. It's encrypted client-side with AES-256-GCM. The keccak256 commitment is stored on 0G Chain; ciphertext on 0G Storage.",
    code:  "TimeCapsule.seal(storageRoot, commitHash, timelockHeader, unlockTime, …)",
  },
  {
    title: "Wait",
    desc:  "The contract enforces the unlock condition — time, dead man's switch, or multi-sig. No one can decrypt early, not even you.",
    code:  "require(block.timestamp >= unlockTime || triggerContract.canReveal(…))",
  },
  {
    title: "Reveal + Prove",
    desc:  "Anyone calls reveal(). The contract emits the timelock header. The revealed plaintext is verified against the on-chain commitment — proof it was never changed.",
    code:  "verify(capsuleId, keccak256(plaintext)) → true",
  },
];

const TRIGGERS = [
  {
    icon:   "⏰",
    name:   "Time Lock",
    desc:   "Unlocks at a specific Unix timestamp. Simple, predictable.",
    border: "#1e1b4b",
  },
  {
    icon:   "💀",
    name:   "Dead Man's Switch",
    desc:   "Owner must check in periodically. Miss the deadline and anyone can trigger the reveal.",
    border: "#78350f",
  },
  {
    icon:   "🗳️",
    name:   "Multi-Sig",
    desc:   "M-of-N designated signers must approve. Trustless group consensus.",
    border: "#1e1b4b",
  },
];

const STACK = [
  { name: "0G Chain",       role: "EVM — unlock logic + registry" },
  { name: "0G Storage",     role: "Off-chain ciphertext (content-addressed)" },
  { name: "AES-256-GCM",    role: "Symmetric payload encryption" },
  { name: "secp256k1 ECIES", role: "Per-recipient key encryption" },
  { name: "keccak256",      role: "Proof-of-existence commitment" },
  { name: "Next.js 14",     role: "App Router + server OG meta" },
];

// ── Styles ─────────────────────────────────────────────────────────────────────

const heroSection: React.CSSProperties = {
  padding: "100px 24px 80px",
  borderBottom: "1px solid #111",
};

const heroBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 14px",
  borderRadius: 20,
  border: "1px solid #2a2a2a",
  color: "#666",
  fontSize: 12,
  marginBottom: 28,
  letterSpacing: 0.5,
};

const heroTitle: React.CSSProperties = {
  fontSize: "clamp(32px, 5vw, 52px)",
  lineHeight: 1.2,
  marginBottom: 24,
  fontWeight: "bold",
};

const heroSub: React.CSSProperties = {
  fontSize: 18,
  color: "#888",
  lineHeight: 1.7,
  marginBottom: 40,
  maxWidth: 560,
  margin: "0 auto 40px",
};

const ctaPrimary: React.CSSProperties = {
  padding: "14px 32px",
  background: "#4f46e5",
  color: "#fff",
  textDecoration: "none",
  borderRadius: 8,
  fontSize: 16,
  fontWeight: "bold",
};

const ctaSecondary: React.CSSProperties = {
  padding: "14px 32px",
  background: "transparent",
  color: "#888",
  textDecoration: "none",
  borderRadius: 8,
  fontSize: 16,
  border: "1px solid #333",
};

const section: React.CSSProperties = {
  padding: "80px 24px",
  borderBottom: "1px solid #111",
};

const sectionInner: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
};

const sectionLabel: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: 12,
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: 2,
  margin: "0 0 12px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "clamp(22px, 3vw, 32px)",
  fontWeight: "bold",
  marginBottom: 40,
};

const cardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 16,
};

const useCaseCard: React.CSSProperties = {
  padding: 24,
  background: "#0d0d0d",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
};

const stepRow: React.CSSProperties = {
  display: "flex",
  gap: 24,
  padding: "28px 0",
  borderBottom: "1px solid #111",
};

const stepNum: React.CSSProperties = {
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "#1e1b4b",
  border: "1px solid #3730a3",
  color: "#a5b4fc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: 14,
};

const stackChip: React.CSSProperties = {
  padding: "12px 20px",
  background: "#0d0d0d",
  border: "1px solid #1e1e1e",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 140,
};

const footer: React.CSSProperties = {
  padding: "32px 24px",
  textAlign: "center",
  borderTop: "1px solid #111",
};

function triggerBadge(bg: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 4,
    background: bg,
    color: "#888",
    fontSize: 11,
    border: "1px solid #333",
    letterSpacing: 0.5,
  };
}
