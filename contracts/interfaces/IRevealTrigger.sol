// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Pluggable trigger interface for Stage 3 trigger types.
/// Each trigger module implements this; TimeCapsule delegates unlock checks to it.
interface IRevealTrigger {
    /// Returns true if `caller` may reveal `capsuleId` right now.
    function canReveal(bytes32 capsuleId, address caller) external view returns (bool);

    /// Called by TimeCapsule after a successful reveal so the trigger can update state.
    function onRevealed(bytes32 capsuleId) external;
}
