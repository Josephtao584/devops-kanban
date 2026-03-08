package com.devops.kanban.service;

import com.devops.kanban.converter.EntityDTOConverter;
import com.devops.kanban.dto.AgentDTO;
import com.devops.kanban.entity.Agent;
import com.devops.kanban.repository.AgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentService {

    private final AgentRepository agentRepository;
    private final EntityDTOConverter converter;

    public List<AgentDTO> findByProjectId(Long projectId) {
        log.debug("[AgentService] findByProjectId called with projectId: {}", projectId);
        List<Agent> agents = agentRepository.findByProjectId(projectId);
        log.debug("[AgentService] Found {} agents in repository", agents.size());
        return agents.stream()
                .map(converter::toDTO)
                .collect(Collectors.toList());
    }

    public List<AgentDTO> findAll() {
        log.debug("[AgentService] findAll called");
        List<Agent> agents = agentRepository.findAll();
        log.debug("[AgentService] Found {} agents (global)", agents.size());
        return agents.stream()
                .map(converter::toDTO)
                .collect(Collectors.toList());
    }

    public AgentDTO findById(Long id) {
        return agentRepository.findById(id)
                .map(converter::toDTO)
                .orElse(null);
    }

    public AgentDTO create(AgentDTO dto) {
        Agent agent = converter.toEntity(dto);
        agent = agentRepository.save(agent);
        return converter.toDTO(agent);
    }

    public AgentDTO update(Long id, AgentDTO dto) {
        Agent agent = agentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + id));

        agent.setName(dto.getName());
        agent.setType(Agent.AgentType.valueOf(dto.getType()));
        agent.setCommand(dto.getCommand());
        agent.setConfig(dto.getConfig());
        agent.setEnabled(dto.isEnabled());

        agent = agentRepository.save(agent);
        return converter.toDTO(agent);
    }

    public void delete(Long id) {
        agentRepository.deleteById(id);
    }
}
