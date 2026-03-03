package com.devops.kanban.service;

import com.devops.kanban.dto.ProjectDTO;
import com.devops.kanban.entity.Project;
import com.devops.kanban.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

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
        projectRepository.deleteById(id);
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
