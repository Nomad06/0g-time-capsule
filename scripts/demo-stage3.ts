/**
 * Stage 3 demo — trigger types beyond the clock.
 *
 * Runs on local Hardhat network with time manipulation.
 * Two scenarios:
 *   A. Dead Man's Switch — capsule unlocks when owner stops checking in
 *   B. Multi-Sig Reveal  — capsule unlocks when M-of-N approve
 *
 * Usage:
 *   npx hardhat run scripts/demo-stage3.ts --network localhost
 */

import { ethers, network } from "hardhat";

// ── Colors ─────────────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  dim:    "\x1b[2m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  cyan:   "\x1b[36m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  purple: "\x1b[35m",
};

function log(msg: string) { process.stdout.write(msg + "\n"); }
function step(n: number, msg: string) {
  log(`\n${C.bold}${C.cyan}[${n}]${C.reset} ${msg}`);
}
function ok(msg: string)   { log(`  ${C.green}✓${C.reset} ${msg}`); }
function info(msg: string) { log(`  ${C.dim}${msg}${C.reset}`); }
function warn(msg: string) { log(`  ${C.yellow}⚠${C.reset}  ${msg}`); }

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const [owner, alice, bob, charlie] = await ethers.getSigners();

  log(`\n${C.bold}${"═".repeat(58)}${C.reset}`);
  log(`${C.bold}  0G Time Capsule — Stage 3 Trigger Demo${C.reset}`);
  log(`${C.bold}${"═".repeat(58)}${C.reset}`);
  info(`Owner:   ${owner.address}`);
  info(`Alice:   ${alice.address}`);
  info(`Bob:     ${bob.address}`);
  info(`Charlie: ${charlie.address}`);

  // ── Deploy ──────────────────────────────────────────────────────────────────

  step(0, "Deploying contracts…");

  const TC  = await ethers.getContractFactory("TimeCapsule");
  const tc  = await TC.deploy();
  await tc.waitForDeployment();

  const DMS = await ethers.getContractFactory("DeadManSwitch");
  const dms = await DMS.deploy(await tc.getAddress());
  await dms.waitForDeployment();

  const MSR = await ethers.getContractFactory("MultiSigReveal");
  const msr = await MSR.deploy(await tc.getAddress());
  await msr.waitForDeployment();

  ok(`TimeCapsule:    ${await tc.getAddress()}`);
  ok(`DeadManSwitch:  ${await dms.getAddress()}`);
  ok(`MultiSigReveal: ${await msr.getAddress()}`);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const FAKE_ROOT    = ethers.keccak256(ethers.toUtf8Bytes("0g-storage-root-demo3"));
  const PLAINTEXT_A  = "My private will: everything to Alice. Timestamp: " + Date.now();
  const PLAINTEXT_B  = "Board resolution: Project X approved. Timestamp: " + Date.now();
  const HASH_A       = ethers.keccak256(ethers.toUtf8Bytes(PLAINTEXT_A));
  const HASH_B       = ethers.keccak256(ethers.toUtf8Bytes(PLAINTEXT_B));
  const HEADER       = ethers.toUtf8Bytes("timelock-header-placeholder");
  const FAR_FUTURE   = Math.floor(Date.now() / 1000) + 9999999; // time lock far out
  const DMS_INTERVAL = 86400n; // 1 day (MIN_INTERVAL)

  // ── Scenario A: Dead Man's Switch ───────────────────────────────────────────

  log(`\n\n${C.bold}${C.purple}━━━ SCENARIO A: Dead Man's Switch ━━━${C.reset}\n`);

  step(1, "Sealing capsule with Dead Man's Switch trigger");

  const dmsAddr = await dms.getAddress();
  const sealA = await tc.seal(
    FAKE_ROOT, HASH_A, HEADER,
    FAR_FUTURE,      // time lock is far future — only DMS can unlock
    0,
    [],
    1,               // TriggerType.DEADMAN
    dmsAddr
  );
  await sealA.wait();

  const capsuleIdA = (await tc.getOwnerCapsules(owner.address))[0];
  ok(`Capsule sealed: ${capsuleIdA}`);
  info(`Content: "${PLAINTEXT_A.slice(0, 60)}…"`);

  step(2, "Arming the dead man's switch (1-day interval)");

  await dms.arm(capsuleIdA, owner.address, DMS_INTERVAL);

  const deadline0 = await dms.getDeadline(capsuleIdA);
  ok(`Switch armed. Deadline: ${new Date(Number(deadline0) * 1000).toLocaleString()}`);
  info(`Owner must check in at least once every 24 hours.`);

  step(3, "Owner checks in — proves they're alive");

  await sleep(500);
  const checkinTx = await dms.connect(owner).checkin(capsuleIdA);
  await checkinTx.wait();
  const deadline1 = await dms.getDeadline(capsuleIdA);
  ok(`Check-in recorded. New deadline: ${new Date(Number(deadline1) * 1000).toLocaleString()}`);

  step(4, "… Owner goes silent. Advancing time 25 hours …");

  await network.provider.send("evm_increaseTime", [25 * 3600]);
  await network.provider.send("evm_mine", []);

  const overdue = await dms.isOverdue(capsuleIdA);
  const currentBlock = await ethers.provider.getBlock("latest");
  warn(`Current block time: ${new Date(Number(currentBlock!.timestamp) * 1000).toLocaleString()}`);
  ok(`isOverdue: ${overdue}`);

  step(5, "Charlie triggers the switch (anyone can, owner is overdue)");

  const triggerTx = await dms.connect(charlie).trigger(capsuleIdA);
  await triggerTx.wait();

  const canRevealA = await dms.canReveal(capsuleIdA, charlie.address);
  ok(`canReveal: ${canRevealA}`);

  step(6, "Revealing the capsule");

  const revealA = await tc.connect(charlie).reveal(capsuleIdA);
  const receiptA = await revealA.wait();

  const eventA = receiptA!.logs
    .map(l => { try { return tc.interface.parseLog(l as any); } catch { return null; } })
    .find(e => e?.name === "CapsuleRevealed");

  ok(`Capsule revealed by ${charlie.address.slice(0, 10)}…`);
  info(`timelockHeader emitted (${(eventA?.args?.timelockHeader as string)?.length ?? 0} bytes)`);

  step(7, "Verifying commit hash (proof-of-existence)");

  const verified = await tc.verify(capsuleIdA, HASH_A);
  ok(`verify(keccak256(plaintext)) → ${verified}`);
  info(`Content: "${PLAINTEXT_A.slice(0, 60)}…"`);

  log(`\n${C.green}${C.bold}  ✓ Dead Man's Switch demo complete${C.reset}`);

  // ── Scenario B: Multi-Sig Reveal ────────────────────────────────────────────

  log(`\n\n${C.bold}${C.purple}━━━ SCENARIO B: Multi-Sig Reveal ━━━${C.reset}\n`);

  step(8, "Sealing capsule with Multi-Sig trigger (2-of-3)");

  const msrAddr = await msr.getAddress();
  const sealB = await tc.seal(
    FAKE_ROOT, HASH_B, HEADER,
    FAR_FUTURE,     // time lock is far future — only multi-sig can unlock
    0,
    [],
    3,              // TriggerType.MULTISIG
    msrAddr
  );
  await sealB.wait();

  const capsuleIdB = (await tc.getOwnerCapsules(owner.address))[1];
  ok(`Capsule sealed: ${capsuleIdB}`);
  info(`Content: "${PLAINTEXT_B.slice(0, 60)}…"`);

  step(9, "Creating 2-of-3 vault (Alice, Bob, Charlie must sign)");

  await msr.create(
    capsuleIdB,
    owner.address,
    [alice.address, bob.address, charlie.address],
    2
  );

  const vault = await msr.getVault(capsuleIdB);
  ok(`Vault created: threshold=${vault[1]}, signers=${vault[4].length}`);
  info(`Signers: Alice, Bob, Charlie`);

  step(10, "Alice approves");

  await msr.connect(alice).approve(capsuleIdB);
  const v1 = await msr.getVault(capsuleIdB);
  info(`Approvals: ${v1[2]} / ${v1[1]}`);
  ok(`Alice signed.`);

  const canRevealB1 = await msr.canReveal(capsuleIdB, alice.address);
  info(`canReveal after 1 approval: ${canRevealB1}`);

  step(11, "Bob approves — threshold reached");

  await msr.connect(bob).approve(capsuleIdB);
  const v2 = await msr.getVault(capsuleIdB);
  info(`Approvals: ${v2[2]} / ${v2[1]}`);
  ok(`Bob signed. Threshold reached!`);

  const canRevealB2 = await msr.canReveal(capsuleIdB, bob.address);
  ok(`canReveal: ${canRevealB2}`);

  step(12, "Revealing the capsule (anyone can now)");

  const revealB = await tc.connect(charlie).reveal(capsuleIdB);
  await revealB.wait();
  ok(`Capsule revealed.`);

  step(13, "Verifying commit hash");

  const verifiedB = await tc.verify(capsuleIdB, HASH_B);
  ok(`verify(keccak256(plaintext)) → ${verifiedB}`);
  info(`Content: "${PLAINTEXT_B.slice(0, 60)}…"`);

  log(`\n${C.green}${C.bold}  ✓ Multi-Sig Reveal demo complete${C.reset}`);

  // ── Summary ─────────────────────────────────────────────────────────────────

  log(`\n\n${C.bold}${"═".repeat(58)}${C.reset}`);
  log(`${C.bold}  Stage 3 Summary${C.reset}`);
  log(`${C.bold}${"═".repeat(58)}${C.reset}`);
  log(`  Dead Man's Switch:  capsule unlocked after owner went silent`);
  log(`  Multi-Sig Reveal:   capsule unlocked when 2/3 signers approved`);
  log(`  Both cases:         keccak256(plaintext) verified on-chain`);
  log(`  Contract enforced:  no trusted party, fully permissionless\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
