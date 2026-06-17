import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying on ${network.name} with account: ${deployer.address}`);

  // ── TimeCapsule (core) ──────────────────────────────────────────────────────
  const TC = await ethers.getContractFactory("TimeCapsule");
  const tc = await TC.deploy();
  await tc.waitForDeployment();
  const tcAddress = await tc.getAddress();
  console.log(`TimeCapsule deployed:    ${tcAddress}`);

  // ── KeyRegistry (Stage 2) ──────────────────────────────────────────────────
  const KR = await ethers.getContractFactory("KeyRegistry");
  const kr = await KR.deploy();
  await kr.waitForDeployment();
  const krAddress = await kr.getAddress();
  console.log(`KeyRegistry deployed:    ${krAddress}`);

  // ── DeadManSwitch ───────────────────────────────────────────────────────────
  const DMS = await ethers.getContractFactory("DeadManSwitch");
  const dms = await DMS.deploy(tcAddress);
  await dms.waitForDeployment();
  const dmsAddress = await dms.getAddress();
  console.log(`DeadManSwitch deployed:  ${dmsAddress}`);

  // ── MultiSigReveal ──────────────────────────────────────────────────────────
  const MSR = await ethers.getContractFactory("MultiSigReveal");
  const msr = await MSR.deploy(tcAddress);
  await msr.waitForDeployment();
  const msrAddress = await msr.getAddress();
  console.log(`MultiSigReveal deployed: ${msrAddress}`);

  // ── Write deployment artifact ───────────────────────────────────────────────
  const artifact = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    contracts: {
      TimeCapsule:    tcAddress,
      KeyRegistry:    krAddress,
      DeadManSwitch:  dmsAddress,
      MultiSigReveal: msrAddress,
    },
  };

  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`Deployment saved to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
