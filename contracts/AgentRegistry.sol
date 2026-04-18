// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentRegistry — ERC-8004 on-chain agent identity and reputation
contract AgentRegistry {
    struct Agent {
        string metadataURI;
        uint256 successes;
        uint256 failures;
        bool registered;
    }

    mapping(address => Agent) private _agents;

    event AgentRegistered(address indexed agent, string metadataURI);
    event TaskCompleted(address indexed agent, bytes32 indexed taskId, bool success);

    error AlreadyRegistered();
    error NotRegistered();

    function registerAgent(address agent, string calldata metadataURI) external {
        if (_agents[agent].registered) revert AlreadyRegistered();
        _agents[agent] = Agent({
            metadataURI: metadataURI,
            successes: 0,
            failures: 0,
            registered: true
        });
        emit AgentRegistered(agent, metadataURI);
    }

    function recordCompletion(address agent, bytes32 taskId, bool success) external {
        if (!_agents[agent].registered) revert NotRegistered();
        if (success) {
            _agents[agent].successes++;
        } else {
            _agents[agent].failures++;
        }
        emit TaskCompleted(agent, taskId, success);
    }

    /// @return successes   number of successful tasks
    /// @return failures    number of failed tasks
    /// @return score       0–100 success rate (50 if no tasks yet)
    function getReputation(address agent)
        external
        view
        returns (uint256 successes, uint256 failures, uint256 score)
    {
        Agent storage a = _agents[agent];
        successes = a.successes;
        failures = a.failures;
        uint256 total = successes + failures;
        score = total == 0 ? 50 : (successes * 100) / total;
    }

    function isRegistered(address agent) external view returns (bool) {
        return _agents[agent].registered;
    }

    function getMetadataURI(address agent) external view returns (string memory) {
        return _agents[agent].metadataURI;
    }
}
