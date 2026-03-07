package com.devops.kanban.service;

import com.devops.kanban.converter.EntityDTOConverter;
import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.entity.Task;
import com.devops.kanban.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final EntityDTOConverter converter;

    public List<TaskDTO> findByProjectId(Long projectId) {
        return taskRepository.findByProjectId(projectId).stream()
                .map(converter::toDTO)
                .collect(Collectors.toList());
    }

    public TaskDTO findById(Long id) {
        return taskRepository.findById(id)
                .map(converter::toDTO)
                .orElse(null);
    }

    public TaskDTO create(TaskDTO dto) {
        Task task = converter.toEntity(dto);
        task = taskRepository.save(task);
        return converter.toDTO(task);
    }

    public TaskDTO update(Long id, TaskDTO dto) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));

        task.setTitle(dto.getTitle());
        task.setDescription(dto.getDescription());
        if (dto.getStatus() != null) {
            task.setStatus(Task.TaskStatus.valueOf(dto.getStatus()));
        }
        if (dto.getPriority() != null) {
            task.setPriority(Task.TaskPriority.valueOf(dto.getPriority()));
        }
        task.setAssignee(dto.getAssignee());

        task = taskRepository.save(task);
        return converter.toDTO(task);
    }

    public TaskDTO updateStatus(Long id, String status) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));

        task.setStatus(Task.TaskStatus.valueOf(status));
        task = taskRepository.save(task);
        return converter.toDTO(task);
    }

    public void delete(Long id) {
        taskRepository.deleteById(id);
    }
}
