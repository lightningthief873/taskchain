// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title SatisfactionEscrow — user-controlled payment release for TaskChain pipelines
/// @notice User deposits USDC before execution; approves or disputes after reviewing output.
///         Platform pre-funds agent execution and recoups from escrow on approval.
contract SatisfactionEscrow {
    IERC20 public immutable usdc;
    address public immutable treasury;

    uint256 public constant AUTO_RELEASE_DELAY = 72 hours;
    uint256 public constant DISPUTE_WINDOW     = 48 hours;

    enum EscrowStatus { NONE, FUNDED, APPROVED, DISPUTED, RELEASED }

    struct EscrowEntry {
        address  user;
        address[] agents;
        uint256[] amounts;   // per-agent payout (raw USDC micro-units)
        uint256  total;      // total deposited = sum(amounts) + platform fee
        EscrowStatus status;
        uint256  deadline;   // auto-release / dispute expiry
    }

    mapping(bytes32 => EscrowEntry) private _escrows;

    event TaskFunded(bytes32 indexed taskId, address indexed user, uint256 amount);
    event TaskApproved(bytes32 indexed taskId);
    event TaskDisputed(bytes32 indexed taskId, string reason);
    event TaskAutoReleased(bytes32 indexed taskId, bool refunded);

    error AlreadyFunded();
    error NotFunded();
    error NotTaskOwner();
    error DeadlineNotReached();
    error InvalidStatus();

    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /// @notice Deposit USDC into escrow for a task.
    ///   Caller must have approved this contract for `total` first.
    /// @param taskId    keccak256 hash of the off-chain task ID (bytes32)
    /// @param agents    agent wallet addresses in pipeline order
    /// @param amounts   per-agent payout amounts (sum + fee == total)
    /// @param total     total USDC to lock (sum(amounts) × 1.05, rounded up)
    function fundTask(
        bytes32 taskId,
        address[] calldata agents,
        uint256[] calldata amounts,
        uint256 total
    ) external {
        if (_escrows[taskId].status != EscrowStatus.NONE) revert AlreadyFunded();
        require(agents.length == amounts.length, "length mismatch");

        usdc.transferFrom(msg.sender, address(this), total);

        _escrows[taskId] = EscrowEntry({
            user:     msg.sender,
            agents:   agents,
            amounts:  amounts,
            total:    total,
            status:   EscrowStatus.FUNDED,
            deadline: block.timestamp + AUTO_RELEASE_DELAY
        });

        emit TaskFunded(taskId, msg.sender, total);
    }

    /// @notice User approves the output — distributes USDC to agents + treasury.
    function approveTask(bytes32 taskId) external {
        EscrowEntry storage e = _escrows[taskId];
        if (e.user != msg.sender) revert NotTaskOwner();
        if (e.status != EscrowStatus.FUNDED) revert NotFunded();

        e.status = EscrowStatus.APPROVED;
        _distribute(e);
        emit TaskApproved(taskId);
    }

    /// @notice User disputes the output — funds locked for DISPUTE_WINDOW, then refunded.
    function disputeTask(bytes32 taskId, string calldata reason) external {
        EscrowEntry storage e = _escrows[taskId];
        if (e.user != msg.sender) revert NotTaskOwner();
        if (e.status != EscrowStatus.FUNDED) revert NotFunded();

        e.status   = EscrowStatus.DISPUTED;
        e.deadline = block.timestamp + DISPUTE_WINDOW;
        emit TaskDisputed(taskId, reason);
    }

    /// @notice Platform calls this after deadline passes:
    ///   - If FUNDED for 72h with no action → release to agents
    ///   - If DISPUTED for 48h with no resolution → refund user
    function autoRelease(bytes32 taskId) external {
        EscrowEntry storage e = _escrows[taskId];
        if (e.status != EscrowStatus.FUNDED && e.status != EscrowStatus.DISPUTED)
            revert InvalidStatus();
        if (block.timestamp < e.deadline) revert DeadlineNotReached();

        bool refunded;
        if (e.status == EscrowStatus.DISPUTED) {
            // Refund user after dispute window
            e.status = EscrowStatus.RELEASED;
            usdc.transfer(e.user, e.total);
            refunded = true;
        } else {
            // No user response after 72h — release to agents
            e.status = EscrowStatus.RELEASED;
            _distribute(e);
            refunded = false;
        }
        emit TaskAutoReleased(taskId, refunded);
    }

    /// @notice Read escrow state for a task.
    function getEscrow(bytes32 taskId)
        external view
        returns (address user, uint256 total, EscrowStatus status, uint256 deadline)
    {
        EscrowEntry storage e = _escrows[taskId];
        return (e.user, e.total, e.status, e.deadline);
    }

    // ── internal ──────────────────────────────────────────────────────────────

    function _distribute(EscrowEntry storage e) internal {
        uint256 agentTotal = 0;
        for (uint256 i = 0; i < e.agents.length; i++) {
            usdc.transfer(e.agents[i], e.amounts[i]);
            agentTotal += e.amounts[i];
        }
        // Platform fee = remainder after agent payouts
        if (e.total > agentTotal) {
            usdc.transfer(treasury, e.total - agentTotal);
        }
    }
}
