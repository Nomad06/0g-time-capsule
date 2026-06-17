"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { zeroGTestnet } from "../constants/contracts";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const onWrongChain = isConnected && chainId !== zeroGTestnet.id;

  if (!isConnected) {
    const mm = connectors.find((c) => c.name === "MetaMask") ?? connectors[0];
    return (
      <button
        onClick={() => connect({ connector: mm })}
        disabled={isPending}
        style={btnStyle("#4f46e5")}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  if (onWrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: zeroGTestnet.id })}
        style={btnStyle("#b45309")}
      >
        Switch to 0G Testnet
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 13, color: "#888" }}>
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      <button onClick={() => disconnect()} style={btnStyle("#1a1a1a")}>
        Disconnect
      </button>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "8px 18px",
    background: bg,
    color: "#fff",
    border: "1px solid #333",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
  };
}
