package com.devops.kanban.service;

import com.devops.kanban.dto.ProjectDTO;
import com.devops.kanban.entity.Project;
import com.devops.kanban.repository.AgentRepository;
import com.devops.kanban.repository.ExecutionRepository;
import com.devops.kanban.repository.ProjectRepository;
import com.devops.kanban.repository.SessionRepository;
import com.devops.kanban.repository.TaskRepository;
import com.devops.kanban.repository.TaskSourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final AgentRepository agentRepository;
    private final TaskSourceRepository taskSourceRepository;
    private final ExecutionRepository executionRepository;
    private final SessionRepository sessionRepository;

    public List<ProjectDTO> findAll() {
        return projectRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public ProjectDTO findById(Long id) {
        return projectRepository.findById(id)
                .map(this::toDTO)
                .orElse(null);
    }

    public ProjectDTO create(ProjectDTO dto) {
        Project project = toEntity(dto);
        project = projectRepository.save(project);
        return toDTO(project);
    }

    public ProjectDTO update(Long id, ProjectDTO dto) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + id));

        project.setName(dto.getName());
        project.setDescription(dto.getDescription());
        project.setRepositoryUrl(dto.getRepoUrl());
        project.setLocalPath(dto.getLocalPath());

        project = projectRepository.save(project);
        return toDTO(project);
    }

    public void delete(Long id) {
        // Check if project exists
        if (!projectRepository.findById(id).isPresent()) {
            throw new IllegalArgumentException("Project not found: " + id);
        }

        log.info("Starting cascade deletion for project ID: {}", id);

        // 1. Get all task IDs for this project
        List<Long> taskIds = taskRepository.findIdsByProjectId(id);
        log.debug("Found {} tasks to delete for project {}", taskIds.size(), id);

        // 2. Delete executions for these tasks
        executionRepository.deleteByTaskIds(taskIds);
        log.debug("Deleted executions for project {}", id);

        // 3. Delete sessions for these tasks
        sessionRepository.deleteByTaskIds(taskIds);
        log.debug("Deleted sessions for project {}", id);

        // 4. Delete tasks for this project
        taskRepository.deleteByProjectId(id);
        log.debug("Deleted tasks for project {}", id);

        // 5. Delete agents for this project
        agentRepository.deleteByProjectId(id);
        log.debug("Deleted agents for project {}", id);

        // 6. Delete task sources for this project
        taskSourceRepository.deleteByProjectId(id);
        log.debug("Deleted task sources for project {}", id);

        // 7. Finally, delete the project itself
        projectRepository.deleteById(id);
        log.info("Completed cascade deletion for project ID: {}", id);
    }

    private ProjectDTO toDTO(Project project) {
        return ProjectDTO.builder()
                .id(project.getId())
                .name(project.getName())
                .description(project.getDescription())
                .repoUrl(project.getRepositoryUrl())
                .localPath(project.getLocalPath())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }

    private Project toEntity(ProjectDTO dto) {
        return Project.builder()
                .id(dto.getId())
                .name(dto.getName())
                .description(dto.getDescription())
                .repositoryUrl(dto.getRepoUrl())
                .localPath(dto.getLocalPath())
                .build();
    }
}
