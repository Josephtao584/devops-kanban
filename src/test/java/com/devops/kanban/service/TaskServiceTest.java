package com.devops.kanban.service;

import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.entity.Task;
import com.devops.kanban.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskService taskService;

    private Task testTask;
    private TaskDTO testTaskDTO;

    @BeforeEach
    void setUp() {
        testTask = Task.builder()
                .id(1L)
                .projectId(1L)
                .title("Test Task")
                .description("Test Description")
                .status(Task.TaskStatus.TODO)
                .priority(Task.TaskPriority.MEDIUM)
                .build();

        testTaskDTO = TaskDTO.builder()
                .id(1L)
                .projectId(1L)
                .title("Test Task")
                .description("Test Description")
                .status("TODO")
                .priority("MEDIUM")
                .build();
    }

    @Test
    @DisplayName("Should return tasks by project ID")
    void findByProjectId() {
        when(taskRepository.findByProjectId(1L)).thenReturn(Arrays.asList(testTask));

        List<TaskDTO> result = taskService.findByProjectId(1L);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Test Task", result.get(0).getTitle());
        verify(taskRepository, times(1)).findByProjectId(1L);
    }

    @Test
    @DisplayName("Should return task by ID")
    void findById() {
        when(taskRepository.findById(1L)).thenReturn(Optional.of(testTask));

        TaskDTO result = taskService.findById(1L);

        assertNotNull(result);
        assertEquals("Test Task", result.getTitle());
        verify(taskRepository, times(1)).findById(1L);
    }

    @Test
    @DisplayName("Should return null when task not found")
    void findByIdNotFound() {
        when(taskRepository.findById(999L)).thenReturn(Optional.empty());

        TaskDTO result = taskService.findById(999L);

        assertNull(result);
    }

    @Test
    @DisplayName("Should create new task")
    void create() {
        TaskDTO newTaskDTO = TaskDTO.builder()
                .projectId(1L)
                .title("New Task")
                .description("New Description")
                .priority("HIGH")
                .build();

        Task newTask = Task.builder()
                .id(2L)
                .projectId(1L)
                .title("New Task")
                .description("New Description")
                .status(Task.TaskStatus.TODO)
                .priority(Task.TaskPriority.HIGH)
                .createdAt(LocalDateTime.now())
                .build();

        when(taskRepository.save(any(Task.class))).thenReturn(newTask);

        TaskDTO result = taskService.create(newTaskDTO);

        assertNotNull(result);
        assertEquals("New Task", result.getTitle());
        assertEquals("TODO", result.getStatus());
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    @DisplayName("Should update existing task")
    void update() {
        TaskDTO updateDTO = TaskDTO.builder()
                .title("Updated Title")
                .description("Updated Description")
                .status("IN_PROGRESS")
                .priority("HIGH")
                .build();

        Task updatedTask = Task.builder()
                .id(1L)
                .projectId(1L)
                .title("Updated Title")
                .description("Updated Description")
                .status(Task.TaskStatus.IN_PROGRESS)
                .priority(Task.TaskPriority.HIGH)
                .build();

        when(taskRepository.findById(1L)).thenReturn(Optional.of(testTask));
        when(taskRepository.save(any(Task.class))).thenReturn(updatedTask);

        TaskDTO result = taskService.update(1L, updateDTO);

        assertNotNull(result);
        assertEquals("Updated Title", result.getTitle());
        assertEquals("IN_PROGRESS", result.getStatus());
        verify(taskRepository, times(1)).findById(1L);
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    @DisplayName("Should throw exception when updating non-existent task")
    void updateNotFound() {
        when(taskRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> {
            taskService.update(999L, testTaskDTO);
        });
    }

    @Test
    @DisplayName("Should update task status")
    void updateStatus() {
        Task updatedTask = Task.builder()
                .id(1L)
                .projectId(1L)
                .title("Test Task")
                .status(Task.TaskStatus.DONE)
                .build();

        when(taskRepository.findById(1L)).thenReturn(Optional.of(testTask));
        when(taskRepository.save(any(Task.class))).thenReturn(updatedTask);

        TaskDTO result = taskService.updateStatus(1L, "DONE");

        assertNotNull(result);
        assertEquals("DONE", result.getStatus());
    }

    @Test
    @DisplayName("Should delete task")
    void delete() {
        doNothing().when(taskRepository).deleteById(1L);

        taskService.delete(1L);

        verify(taskRepository, times(1)).deleteById(1L);
    }
}
