// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IRevealTrigger.sol";

/// @title DeadManSwitch
/// @notice Trigger module: capsule unlocks if the owner misses a check-in deadline.
///
/// Flow:
///   1. Owner calls arm()  — registers capsuleId + interval on this contract.
///   2. Owner calls checkin(switchId) regularly to reset the deadline.
///   3. If checkin not called within `interval` seconds, anyone calls trigger().
///   4. trigger() marks switch as triggered; TimeCapsule.reveal() then succeeds
///      because canReveal() returns true.
///
/// This contract is set as `triggerContract` in TimeCapsule.seal().
/// TimeCapsule calls onRevealed() once reveal completes to finalize state.
contract DeadManSwitch is IRevealTrigger, ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────────────

    struct Switch {
        address owner;
        bytes32 capsuleId;    // corresponding TimeCapsule capsuleId
        uint64  interval;     // seconds between required check-ins
        uint64  lastCheckin;  // timestamp of last successful check-in
        bool    triggered;    // true after deadline missed and trigger() called
        bool    revealed;     // true after TimeCapsule confirms reveal
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    /// switchId = capsuleId (1-to-1 mapping for simplicity)
    mapping(bytes32 => Switch) public switches;

    address public immutable timeCapsule;

    // ─── Events ───────────────────────────────────────────────────────────────

    event SwitchArmed(bytes32 indexed capsuleId, address indexed owner, uint64 interval, uint64 deadline);
    event CheckIn(bytes32 indexed capsuleId, address indexed owner, uint64 newDeadline);
    event SwitchTriggered(bytes32 indexed capsuleId, address indexed triggeredBy, uint64 deadline);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error SwitchNotFound(bytes32 capsuleId);
    error NotOwner(bytes32 capsuleId);
    error AlreadyArmed(bytes32 capsuleId);
    error SwitchAlreadyTriggered(bytes32 capsuleId);
    error OwnerStillAlive(bytes32 capsuleId, uint64 deadline);
    error IntervalTooShort();
    error CallerNotTimeCapsule();

    uint64 public constant MIN_INTERVAL = 1 days;

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _timeCapsule) {
        timeCapsule = _timeCapsule;
    }

    // ─── Arm ──────────────────────────────────────────────────────────────────

    /// Called after TimeCapsule.seal() to register the dead man's switch.
    /// @param capsuleId  The capsuleId returned by TimeCapsule.seal().
    /// @param interval   Seconds between required check-ins (min 1 day).
    function arm(bytes32 capsuleId, address owner, uint64 interval) external {
        if (interval < MIN_INTERVAL) revert IntervalTooShort();
        if (switches[capsuleId].owner != address(0)) revert AlreadyArmed(capsuleId);

        switches[capsuleId] = Switch({
            owner:       owner,
            capsuleId:   capsuleId,
            interval:    interval,
            lastCheckin: uint64(block.timestamp),
            triggered:   false,
            revealed:    false
        });

        emit SwitchArmed(capsuleId, owner, interval, uint64(block.timestamp) + interval);
    }

    // ─── Check-in ─────────────────────────────────────────────────────────────

    function checkin(bytes32 capsuleId) external {
        Switch storage sw = switches[capsuleId];
        if (sw.owner == address(0))  revert SwitchNotFound(capsuleId);
        if (sw.owner != msg.sender)  revert NotOwner(capsuleId);
        if (sw.triggered)            revert SwitchAlreadyTriggered(capsuleId);

        sw.lastCheckin = uint64(block.timestamp);
        emit CheckIn(capsuleId, msg.sender, uint64(block.timestamp) + sw.interval);
    }

    // ─── Trigger ──────────────────────────────────────────────────────────────

    /// Anyone may call this once the deadline has passed.
    function trigger(bytes32 capsuleId) external nonReentrant {
        Switch storage sw = switches[capsuleId];
        if (sw.owner == address(0)) revert SwitchNotFound(capsuleId);
        if (sw.triggered)           revert SwitchAlreadyTriggered(capsuleId);

        uint64 deadline = sw.lastCheckin + sw.interval;
        if (block.timestamp < deadline) revert OwnerStillAlive(capsuleId, deadline);

        sw.triggered = true;
        emit SwitchTriggered(capsuleId, msg.sender, deadline);
    }

    // ─── IRevealTrigger ───────────────────────────────────────────────────────

    function canReveal(bytes32 capsuleId, address /*caller*/) external view override returns (bool) {
        Switch storage sw = switches[capsuleId];
        if (sw.owner == address(0)) return false;
        // Triggered manually via trigger() OR deadline naturally elapsed
        return sw.triggered || block.timestamp >= sw.lastCheckin + sw.interval;
    }

    function onRevealed(bytes32 capsuleId) external override {
        if (msg.sender != timeCapsule) revert CallerNotTimeCapsule();
        switches[capsuleId].revealed = true;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getDeadline(bytes32 capsuleId) external view returns (uint64) {
        Switch storage sw = switches[capsuleId];
        return sw.lastCheckin + sw.interval;
    }

    function isOverdue(bytes32 capsuleId) external view returns (bool) {
        Switch storage sw = switches[capsuleId];
        if (sw.owner == address(0) || sw.triggered) return false;
        return block.timestamp >= sw.lastCheckin + sw.interval;
    }
}
