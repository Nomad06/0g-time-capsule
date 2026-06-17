import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { TimeCapsule, DeadManSwitch, MultiSigReveal, KeyRegistry } from "../typechain-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZERO_BYTES32 = ethers.ZeroHash;
const FAKE_STORAGE_ROOT = ethers.keccak256(ethers.toUtf8Bytes("fake-0g-storage-root"));
const PLAINTEXT = "BTC hits 200k before 2027";
const PLAINTEXT_HASH = ethers.keccak256(ethers.toUtf8Bytes(PLAINTEXT));
const TIMELOCK_HEADER = ethers.toUtf8Bytes("drand-encrypted-key-placeholder");

async function sealDefaults(contract: TimeCapsule, unlockTime: number) {
  return contract.seal(
    FAKE_STORAGE_ROOT,
    PLAINTEXT_HASH,
    TIMELOCK_HEADER,
    unlockTime,
    0,           // unlockBlock = 0 (time-based)
    [],          // public
    0,           // TriggerType.TIME
    ethers.ZeroAddress
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

async function deployTimeCapsule() {
  const [owner, alice, bob, charlie] = await ethers.getSigners();
  const TC = await ethers.getContractFactory("TimeCapsule");
  const tc = await TC.deploy() as unknown as TimeCapsule;
  return { tc, owner, alice, bob, charlie };
}

async function deployAll() {
  const base = await deployTimeCapsule();
  const { tc } = base;

  const DMS = await ethers.getContractFactory("DeadManSwitch");
  const dms = await DMS.deploy(await tc.getAddress()) as unknown as DeadManSwitch;

  const MSR = await ethers.getContractFactory("MultiSigReveal");
  const msr = await MSR.deploy(await tc.getAddress()) as unknown as MultiSigReveal;

  const KR = await ethers.getContractFactory("KeyRegistry");
  const kr = await KR.deploy() as unknown as KeyRegistry;

  return { ...base, dms, msr, kr };
}

// ─── TimeCapsule: seal ────────────────────────────────────────────────────────

describe("TimeCapsule — seal", () => {
  it("emits CapsuleSealed with correct fields", async () => {
    const { tc, owner } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    const tx = await sealDefaults(tc, unlockTime);
    const receipt = await tx.wait();
    const event = receipt!.logs.find(
      (l) => tc.interface.parseLog(l as any)?.name === "CapsuleSealed"
    );
    expect(event).to.not.be.undefined;
  });

  it("reverts when storageRoot is zero", async () => {
    const { tc } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    await expect(
      tc.seal(ZERO_BYTES32, PLAINTEXT_HASH, TIMELOCK_HEADER, unlockTime, 0, [], 0, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(tc, "InvalidStorageRoot");
  });

  it("reverts when both unlock conditions are zero", async () => {
    const { tc } = await loadFixture(deployTimeCapsule);

    await expect(
      tc.seal(FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER, 0, 0, [], 0, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(tc, "InvalidUnlockCondition");
  });

  it("reverts when unlockTime is in the past", async () => {
    const { tc } = await loadFixture(deployTimeCapsule);
    const past = (await time.latest()) - 10;

    await expect(
      tc.seal(FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER, past, 0, [], 0, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(tc, "InvalidUnlockCondition");
  });

  it("indexes capsule under owner", async () => {
    const { tc, owner } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    await sealDefaults(tc.connect(owner), unlockTime);
    const ids = await tc.getOwnerCapsules(owner.address);
    expect(ids.length).to.equal(1);
  });

  it("indexes capsule under each recipient", async () => {
    const { tc, owner, alice, bob } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      unlockTime, 0,
      [alice.address, bob.address],
      0, ethers.ZeroAddress
    );

    expect((await tc.getRecipientCapsules(alice.address)).length).to.equal(1);
    expect((await tc.getRecipientCapsules(bob.address)).length).to.equal(1);
  });
});

// ─── TimeCapsule: reveal ──────────────────────────────────────────────────────

describe("TimeCapsule — reveal", () => {
  it("reverts before unlock time", async () => {
    const { tc, owner } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    const tx = await sealDefaults(tc.connect(owner), unlockTime);
    const receipt = await tx.wait();
    const log = receipt!.logs.find(
      (l) => tc.interface.parseLog(l as any)?.name === "CapsuleSealed"
    )!;
    const { capsuleId } = tc.interface.parseLog(log as any)!.args;

    await expect(tc.reveal(capsuleId)).to.be.revertedWithCustomError(tc, "CapsuleLocked");
  });

  it("succeeds and emits CapsuleRevealed after unlock time", async () => {
    const { tc, owner } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    const tx = await sealDefaults(tc.connect(owner), unlockTime);
    const receipt = await tx.wait();
    const log = receipt!.logs.find(
      (l) => tc.interface.parseLog(l as any)?.name === "CapsuleSealed"
    )!;
    const { capsuleId } = tc.interface.parseLog(log as any)!.args;

    await time.increaseTo(unlockTime + 1);

    await expect(tc.reveal(capsuleId))
      .to.emit(tc, "CapsuleRevealed")
      .withArgs(capsuleId, owner.address, TIMELOCK_HEADER);
  });

  it("reverts double-reveal", async () => {
    const { tc, owner } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    const tx = await sealDefaults(tc.connect(owner), unlockTime);
    const receipt = await tx.wait();
    const log = receipt!.logs.find(
      (l) => tc.interface.parseLog(l as any)?.name === "CapsuleSealed"
    )!;
    const { capsuleId } = tc.interface.parseLog(log as any)!.args;

    await time.increaseTo(unlockTime + 1);
    await tc.reveal(capsuleId);

    await expect(tc.reveal(capsuleId)).to.be.revertedWithCustomError(tc, "CapsuleAlreadyRevealed");
  });

  it("blocks non-recipient from revealing gated capsule", async () => {
    const { tc, owner, alice, bob } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    const tx = await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      unlockTime, 0, [alice.address], 0, ethers.ZeroAddress
    );
    const receipt = await tx.wait();
    const log = receipt!.logs.find(
      (l) => tc.interface.parseLog(l as any)?.name === "CapsuleSealed"
    )!;
    const { capsuleId } = tc.interface.parseLog(log as any)!.args;

    await time.increaseTo(unlockTime + 1);

    await expect(tc.connect(bob).reveal(capsuleId))
      .to.be.revertedWithCustomError(tc, "NotRecipient");

    // alice succeeds
    await expect(tc.connect(alice).reveal(capsuleId)).to.emit(tc, "CapsuleRevealed");
  });
});

// ─── TimeCapsule: verify ──────────────────────────────────────────────────────

describe("TimeCapsule — verify (Stage 1 proof-of-existence)", () => {
  it("returns true for matching plaintext hash", async () => {
    const { tc, owner } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    const tx = await sealDefaults(tc.connect(owner), unlockTime);
    const receipt = await tx.wait();
    const log = receipt!.logs.find(
      (l) => tc.interface.parseLog(l as any)?.name === "CapsuleSealed"
    )!;
    const { capsuleId } = tc.interface.parseLog(log as any)!.args;

    expect(await tc.verify(capsuleId, PLAINTEXT_HASH)).to.be.true;
  });

  it("returns false for wrong hash", async () => {
    const { tc, owner } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;

    const tx = await sealDefaults(tc.connect(owner), unlockTime);
    const receipt = await tx.wait();
    const log = receipt!.logs.find(
      (l) => tc.interface.parseLog(l as any)?.name === "CapsuleSealed"
    )!;
    const { capsuleId } = tc.interface.parseLog(log as any)!.args;

    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong content"));
    expect(await tc.verify(capsuleId, wrongHash)).to.be.false;
  });
});

// ─── DeadManSwitch ────────────────────────────────────────────────────────────

describe("DeadManSwitch", () => {
  const ONE_DAY = 86400;

  it("arm + checkin resets deadline", async () => {
    const { tc, dms, owner } = await loadFixture(deployAll);
    const unlockTime = (await time.latest()) + ONE_DAY * 2;

    // seal a capsule (trigger contract = dms, no time condition — use block 999999999)
    await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      0, 999999999,
      [], 1, await dms.getAddress()
    );
    const ids = await tc.getOwnerCapsules(owner.address);
    const capsuleId = ids[0];

    await dms.arm(capsuleId, owner.address, ONE_DAY);

    const d1 = await dms.getDeadline(capsuleId);
    await time.increase(ONE_DAY / 2);
    await dms.connect(owner).checkin(capsuleId);
    const d2 = await dms.getDeadline(capsuleId);

    expect(d2).to.be.greaterThan(d1);
  });

  it("trigger() reverts while owner still alive", async () => {
    const { tc, dms, owner, alice } = await loadFixture(deployAll);

    await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      0, 999999999, [], 1, await dms.getAddress()
    );
    const capsuleId = (await tc.getOwnerCapsules(owner.address))[0];

    await dms.arm(capsuleId, owner.address, ONE_DAY);

    await expect(dms.connect(alice).trigger(capsuleId))
      .to.be.revertedWithCustomError(dms, "OwnerStillAlive");
  });

  it("trigger() succeeds after interval elapsed", async () => {
    const { tc, dms, owner, alice } = await loadFixture(deployAll);

    await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      0, 999999999, [], 1, await dms.getAddress()
    );
    const capsuleId = (await tc.getOwnerCapsules(owner.address))[0];

    await dms.arm(capsuleId, owner.address, ONE_DAY);
    await time.increase(ONE_DAY + 1);

    await expect(dms.connect(alice).trigger(capsuleId)).to.emit(dms, "SwitchTriggered");
    expect(await dms.isOverdue(capsuleId)).to.be.false; // triggered = true, isOverdue returns false
  });
});

// ─── MultiSigReveal ───────────────────────────────────────────────────────────

describe("MultiSigReveal", () => {
  it("canReveal false until threshold met", async () => {
    const { tc, msr, owner, alice, bob, charlie } = await loadFixture(deployAll);

    await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      0, 999999999, [], 3, await msr.getAddress()
    );
    const capsuleId = (await tc.getOwnerCapsules(owner.address))[0];

    await msr.create(capsuleId, owner.address, [alice.address, bob.address, charlie.address], 2);

    expect(await msr.canReveal(capsuleId, alice.address)).to.be.false;

    await msr.connect(alice).approve(capsuleId);
    expect(await msr.canReveal(capsuleId, alice.address)).to.be.false;

    await msr.connect(bob).approve(capsuleId);
    expect(await msr.canReveal(capsuleId, bob.address)).to.be.true;
  });

  it("non-signer approve reverts", async () => {
    const { tc, msr, owner, alice, bob, charlie } = await loadFixture(deployAll);

    await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      0, 999999999, [], 3, await msr.getAddress()
    );
    const capsuleId = (await tc.getOwnerCapsules(owner.address))[0];

    await msr.create(capsuleId, owner.address, [alice.address, bob.address], 2);

    await expect(msr.connect(charlie).approve(capsuleId))
      .to.be.revertedWithCustomError(msr, "NotSigner");
  });

  it("double-approve reverts", async () => {
    const { tc, msr, owner, alice, bob } = await loadFixture(deployAll);

    await tc.connect(owner).seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      0, 999999999, [], 3, await msr.getAddress()
    );
    const capsuleId = (await tc.getOwnerCapsules(owner.address))[0];

    await msr.create(capsuleId, owner.address, [alice.address, bob.address], 2);
    await msr.connect(alice).approve(capsuleId);

    await expect(msr.connect(alice).approve(capsuleId))
      .to.be.revertedWithCustomError(msr, "AlreadyApproved");
  });
});

// ─── Stage 2: KeyRegistry ─────────────────────────────────────────────────────

describe("KeyRegistry", () => {
  const FAKE_PUBKEY = ethers.randomBytes(33);

  it("registers a 33-byte pubkey and retrieves it", async () => {
    const { kr, alice } = await loadFixture(deployAll);
    await kr.connect(alice).registerKey(FAKE_PUBKEY);
    const stored = await kr.getKey(alice.address);
    expect(ethers.getBytes(stored)).to.deep.equal(FAKE_PUBKEY);
    expect(await kr.hasKey(alice.address)).to.be.true;
  });

  it("returns empty for unregistered wallet", async () => {
    const { kr, bob } = await loadFixture(deployAll);
    const stored = await kr.getKey(bob.address);
    expect(stored).to.equal("0x");
    expect(await kr.hasKey(bob.address)).to.be.false;
  });

  it("rejects pubkeys with wrong length", async () => {
    const { kr, alice } = await loadFixture(deployAll);
    await expect(kr.connect(alice).registerKey(ethers.randomBytes(64)))
      .to.be.revertedWithCustomError(kr, "InvalidPubkeyLength");
  });

  it("emits KeyRegistered event", async () => {
    const { kr, alice } = await loadFixture(deployAll);
    await expect(kr.connect(alice).registerKey(FAKE_PUBKEY))
      .to.emit(kr, "KeyRegistered")
      .withArgs(alice.address, FAKE_PUBKEY);
  });

  it("allows overwriting registered key", async () => {
    const { kr, alice } = await loadFixture(deployAll);
    const pubkey1 = ethers.randomBytes(33);
    const pubkey2 = ethers.randomBytes(33);
    await kr.connect(alice).registerKey(pubkey1);
    await kr.connect(alice).registerKey(pubkey2);
    const stored = await kr.getKey(alice.address);
    expect(ethers.getBytes(stored)).to.deep.equal(pubkey2);
  });
});

// ─── Stage 2: recipient keys on TimeCapsule ───────────────────────────────────

describe("TimeCapsule — recipient keys (Stage 2)", () => {
  const FAKE_ENVELOPE = ethers.randomBytes(93);  // 33 + 12 + 48

  async function sealWithRecipient() {
    const { tc, owner, alice } = await loadFixture(deployTimeCapsule);
    const unlockTime = (await time.latest()) + 120;
    await tc.seal(
      FAKE_STORAGE_ROOT, PLAINTEXT_HASH, TIMELOCK_HEADER,
      unlockTime, 0,
      [alice.address],  // recipient
      0, ethers.ZeroAddress
    );
    const capsuleId = (await tc.getOwnerCapsules(owner.address))[0];
    return { tc, owner, alice, capsuleId };
  }

  it("owner can set and retrieve a recipient key", async () => {
    const { tc, capsuleId, alice } = await sealWithRecipient();
    await tc.setRecipientKeys(capsuleId, [alice.address], [FAKE_ENVELOPE]);
    const stored = await tc.getRecipientKey(capsuleId, alice.address);
    expect(ethers.getBytes(stored)).to.deep.equal(FAKE_ENVELOPE);
  });

  it("emits RecipientKeySet", async () => {
    const { tc, capsuleId, alice } = await sealWithRecipient();
    await expect(tc.setRecipientKeys(capsuleId, [alice.address], [FAKE_ENVELOPE]))
      .to.emit(tc, "RecipientKeySet")
      .withArgs(capsuleId, alice.address);
  });

  it("non-owner cannot set recipient keys", async () => {
    const { tc, capsuleId, alice } = await sealWithRecipient();
    await expect(
      tc.connect(alice).setRecipientKeys(capsuleId, [alice.address], [FAKE_ENVELOPE])
    ).to.be.revertedWithCustomError(tc, "NotOwner");
  });

  it("reverts if recipients/keys length mismatch", async () => {
    const { tc, capsuleId, alice } = await sealWithRecipient();
    const { bob } = await loadFixture(deployTimeCapsule);
    await expect(
      tc.setRecipientKeys(capsuleId, [alice.address, bob.address], [FAKE_ENVELOPE])
    ).to.be.revertedWithCustomError(tc, "ArrayLengthMismatch");
  });

  it("returns empty for unset recipient", async () => {
    const { tc, capsuleId } = await sealWithRecipient();
    const { bob } = await loadFixture(deployTimeCapsule);
    const stored = await tc.getRecipientKey(capsuleId, bob.address);
    expect(stored).to.equal("0x");
  });
});
