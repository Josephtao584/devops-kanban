package com.devops.kanban.service;

import com.devops.kanban.entity.Agent;
import com.devops.kanban.entity.TaskSource;
import com.devops.kanban.spi.AgentAdapter;
import com.devops.kanban.spi.TaskSourceAdapter;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Central registry for agent and task source adapters.
 * Eliminates duplicate adapter maps and getAdapter() methods across services.
 */
@Service
public class AdapterRegistry {

    private final Map<Agent.AgentType, AgentAdapter> agentAdapters;
    private final Map<TaskSource.TaskSourceType, TaskSourceAdapter> sourceAdapters;

    public AdapterRegistry(
            List<AgentAdapter> agentAdapterList,
            List<TaskSourceAdapter> sourceAdapterList) {
        this.agentAdapters = agentAdapterList.stream()
                .collect(Collectors.toMap(AgentAdapter::getType, Function.identity()));
        this.sourceAdapters = sourceAdapterList.stream()
                .collect(Collectors.toMap(TaskSourceAdapter::getType, Function.identity()));
    }

    /**
     * Get an agent adapter by type.
     *
     * @param type the agent type
     * @return the adapter
     * @throws IllegalArgumentException if no adapter found
     */
    public AgentAdapter getAgentAdapter(Agent.AgentType type) {
        AgentAdapter adapter = agentAdapters.get(type);
        if (adapter == null) {
            throw new IllegalArgumentException("No adapter found for agent type: " + type);
        }
        return adapter;
    }

    /**
     * Get a task source adapter by type.
     *
     * @param type the task source type
     * @return the adapter
     * @throws IllegalArgumentException if no adapter found
     */
    public TaskSourceAdapter getSourceAdapter(TaskSource.TaskSourceType type) {
        TaskSourceAdapter adapter = sourceAdapters.get(type);
        if (adapter == null) {
            throw new IllegalArgumentException("No adapter found for task source type: " + type);
        }
        return adapter;
    }

    /**
     * Get all registered agent adapters.
     */
    public Map<Agent.AgentType, AgentAdapter> getAgentAdapters() {
        return agentAdapters;
    }

    /**
     * Get all registered task source adapters.
     */
    public Map<TaskSource.TaskSourceType, TaskSourceAdapter> getSourceAdapters() {
        return sourceAdapters;
    }
}