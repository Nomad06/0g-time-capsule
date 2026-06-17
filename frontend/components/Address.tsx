"use client";

import { useEnsName, shortAddress } from "@/lib/ens";

interface Props {
  address: `0x${string}`;
  className?: string;
}

export function Address({ address, className = "" }: Props) {
  const ens = useEnsName(address);
  return (
    <span className={className} title={address}>
      {ens ?? shortAddress(address)}
    </span>
  );
}
