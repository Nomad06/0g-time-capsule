import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/zerogTestnet.json"), "utf8")
  ) as { TimeCapsule: string };

  const timeCapsuleAddress = deployments.TimeCapsule;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://0g-time-capsule.vercel.app";

  console.log("Deploying CapsuleNFT...");
  console.log("  TimeCapsule:", timeCapsuleAddress);
  console.log("  Base URI:   ", appUrl);

  const factory = await hre.ethers.getContractFactory("CapsuleNFT");
  const nft     = await factory.deploy(timeCapsuleAddress, appUrl);
  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log("CapsuleNFT deployed to:", address);

  // Update deployments file
  const updated = { ...deployments, CapsuleNFT: address };
  fs.writeFileSync(
    path.join(__dirname, "../deployments/zerogTestnet.json"),
    JSON.stringify(updated, null, 2)
  );
  console.log("deployments/zerogTestnet.json updated.");
  console.log("\nAdd to Vercel env:");
  console.log(`NEXT_PUBLIC_CAPSULE_NFT_ADDRESS=${address}`);
}

main().catch(console.error);
