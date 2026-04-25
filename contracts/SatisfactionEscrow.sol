// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title SatisfactionEscrow — user-controlled payment release for TaskChain pipelines
/// @notice User deposits USDC, TASK, or native AVAX before execution; approves or disputes after.
///         Paying in TASK gives a 20% discount on the platform fee (5% → 4%).
///         address(0) is used as paymentToken to represent native AVAX/ETH.
contract SatisfactionEscrow {
    IERC20 public immutable usdc;
    IERC20 public immutable task;
    address public immutable treasury;

    uint256 public constant AUTO_RELEASE_DELAY = 72 hours;
    uint256 public constant DISPUTE_WINDOW     = 48 hours;

    enum EscrowStatus { NONE, FUNDED, APPROVED, DISPUTED, RELEASED }

    struct EscrowEntry {
        address   user;
        address[] agents;
        uint256[] amounts;
        uint256   total;
        EscrowStatus status;
        uint256   deadline;
        address   paymentToken; // USDC addr, TASK addr, or address(0) for native AVAX
    }

    mapping(bytes32 => EscrowEntry) private _escrows;

    event TaskFunded(bytes32 indexed taskId, address indexed user, uint256 amount, address token);
    event TaskApproved(bytes32 indexed taskId);
    event TaskDisputed(bytes32 indexed taskId, string reason);
    event TaskAutoReleased(bytes32 indexed taskId, bool refunded);

    error AlreadyFunded();
    error NotFunded();
    error NotTaskOwner();
    error DeadlineNotReached();
    error InvalidStatus();

    constructor(address _usdc, address _task, address _treasury) {
        usdc     = IERC20(_usdc);
        task     = IERC20(_task);
        treasury = _treasury;
    }

    // ── Fund ─────────────────────────────────────────────────────────────────

    /// @notice Fund with USDC. Platform fee = 5% (total = sum(amounts) × 1.05).
    function fundTaskUSDC(
        bytes32   taskId,
        address[] calldata agents,
        uint256[] calldata amounts,
        uint256   total
    ) external {
        _fund(taskId, agents, amounts, total, address(usdc));
    }

    /// @notice Fund with TASK. Platform fee = 4% (20% discount vs USDC).
    ///   Amounts and total in TASK units (18 decimals).
    function fundTaskTASK(
        bytes32   taskId,
        address[] calldata agents,
        uint256[] calldata amounts,
        uint256   total
    ) external {
        _fund(taskId, agents, amounts, total, address(task));
    }

    /// @notice Fund with native AVAX. Platform fee = 5%.
    ///   Send exact `total` wei as msg.value; amounts are in wei.
    function fundTaskETH(
        bytes32   taskId,
        address[] calldata agents,
        uint256[] calldata amounts,
        uint256   total
    ) external payable {
        if (_escrows[taskId].status != EscrowStatus.NONE) revert AlreadyFunded();
        require(agents.length == amounts.length, "length mismatch");
        require(msg.value == total, "ETH amount mismatch");

        _escrows[taskId] = EscrowEntry({
            user:         msg.sender,
            agents:       agents,
            amounts:      amounts,
            total:        total,
            status:       EscrowStatus.FUNDED,
            deadline:     block.timestamp + AUTO_RELEASE_DELAY,
            paymentToken: address(0)
        });

        emit TaskFunded(taskId, msg.sender, total, address(0));
    }

    // ── Approve / Dispute / Auto-release ─────────────────────────────────────

    /// @notice User approves output — distributes tokens to agents + treasury.
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

    /// @notice Platform calls after deadline:
    ///   - FUNDED for 72h with no action → release to agents
    ///   - DISPUTED for 48h with no resolution → refund user
    function autoRelease(bytes32 taskId) external {
        EscrowEntry storage e = _escrows[taskId];
        if (e.status != EscrowStatus.FUNDED && e.status != EscrowStatus.DISPUTED)
            revert InvalidStatus();
        if (block.timestamp < e.deadline) revert DeadlineNotReached();

        bool refunded;
        if (e.status == EscrowStatus.DISPUTED) {
            e.status = EscrowStatus.RELEASED;
            _transferOut(e.paymentToken, e.user, e.total);
            refunded = true;
        } else {
            e.status = EscrowStatus.RELEASED;
            _distribute(e);
            refunded = false;
        }
        emit TaskAutoReleased(taskId, refunded);
    }

    // ── View ─────────────────────────────────────────────────────────────────

    /// @notice Read escrow state for a task.
    function getEscrow(bytes32 taskId)
        external view
        returns (address user, uint256 total, EscrowStatus status, uint256 deadline, address paymentToken)
    {
        EscrowEntry storage e = _escrows[taskId];
        return (e.user, e.total, e.status, e.deadline, e.paymentToken);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _fund(
        bytes32   taskId,
        address[] calldata agents,
        uint256[] calldata amounts,
        uint256   total,
        address   token
    ) internal {
        if (_escrows[taskId].status != EscrowStatus.NONE) revert AlreadyFunded();
        require(agents.length == amounts.length, "length mismatch");

        IERC20(token).transferFrom(msg.sender, address(this), total);

        _escrows[taskId] = EscrowEntry({
            user:         msg.sender,
            agents:       agents,
            amounts:      amounts,
            total:        total,
            status:       EscrowStatus.FUNDED,
            deadline:     block.timestamp + AUTO_RELEASE_DELAY,
            paymentToken: token
        });

        emit TaskFunded(taskId, msg.sender, total, token);
    }

    function _distribute(EscrowEntry storage e) internal {
        uint256 agentTotal = 0;
        for (uint256 i = 0; i < e.agents.length; i++) {
            _transferOut(e.paymentToken, e.agents[i], e.amounts[i]);
            agentTotal += e.amounts[i];
        }
        if (e.total > agentTotal) {
            _transferOut(e.paymentToken, treasury, e.total - agentTotal);
        }
    }

    function _transferOut(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    receive() external payable {}
}
