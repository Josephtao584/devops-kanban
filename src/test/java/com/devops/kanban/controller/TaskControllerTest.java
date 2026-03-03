package com.devops.kanban.controller;

import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.service.TaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TaskService taskService;

    private TaskDTO testTaskDTO;
    private List<TaskDTO> taskList;

    @BeforeEach
    void setUp() {
        testTaskDTO = TaskDTO.builder()
                .id(1L)
                .projectId(1L)
                .title("Test Task")
                .description("Test Description")
                .status("TODO")
                .priority("MEDIUM")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        taskList = Arrays.asList(testTaskDTO);
    }

    @Test
    @DisplayName("GET /api/tasks should return tasks for project")
    void getTasks() throws Exception {
        when(taskService.findByProjectId(1L)).thenReturn(taskList);

        mockMvc.perform(get("/api/tasks")
                        .param("projectId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].title").value("Test Task"));

        verify(taskService, times(1)).findByProjectId(1L);
    }

    @Test
    @DisplayName("GET /api/tasks should return error when projectId is missing")
    void getTasksWithoutProjectId() throws Exception {
        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("projectId is required"));
    }

    @Test
    @DisplayName("GET /api/tasks/{id} should return task")
    void getTask() throws Exception {
        when(taskService.findById(1L)).thenReturn(testTaskDTO);

        mockMvc.perform(get("/api/tasks/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Test Task"));

        verify(taskService, times(1)).findById(1L);
    }

    @Test
    @DisplayName("GET /api/tasks/{id} should return error when task not found")
    void getTaskNotFound() throws Exception {
        when(taskService.findById(999L)).thenReturn(null);

        mockMvc.perform(get("/api/tasks/999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("Task not found"));
    }

    @Test
    @DisplayName("POST /api/tasks should create task")
    void createTask() throws Exception {
        TaskDTO newTask = TaskDTO.builder()
                .projectId(1L)
                .title("New Task")
                .description("New Description")
                .priority("HIGH")
                .build();

        TaskDTO createdTask = TaskDTO.builder()
                .id(2L)
                .projectId(1L)
                .title("New Task")
                .description("New Description")
                .status("TODO")
                .priority("HIGH")
                .createdAt(LocalDateTime.now())
                .build();

        when(taskService.create(any(TaskDTO.class))).thenReturn(createdTask);

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newTask)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Task created successfully"))
                .andExpect(jsonPath("$.data.id").value(2));

        verify(taskService, times(1)).create(any(TaskDTO.class));
    }

    @Test
    @DisplayName("POST /api/tasks should validate required fields")
    void createTaskValidation() throws Exception {
        TaskDTO invalidTask = TaskDTO.builder()
                .description("Missing title")
                .build();

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidTask)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/tasks/{id} should update task")
    void updateTask() throws Exception {
        TaskDTO updateDTO = TaskDTO.builder()
                .title("Updated Title")
                .description("Updated Description")
                .status("IN_PROGRESS")
                .priority("HIGH")
                .build();

        TaskDTO updatedTask = TaskDTO.builder()
                .id(1L)
                .projectId(1L)
                .title("Updated Title")
                .description("Updated Description")
                .status("IN_PROGRESS")
                .priority("HIGH")
                .build();

        when(taskService.update(eq(1L), any(TaskDTO.class))).thenReturn(updatedTask);

        mockMvc.perform(put("/api/tasks/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Updated Title"));

        verify(taskService, times(1)).update(eq(1L), any(TaskDTO.class));
    }

    @Test
    @DisplayName("PATCH /api/tasks/{id}/status should update status")
    void updateTaskStatus() throws Exception {
        TaskDTO updatedTask = TaskDTO.builder()
                .id(1L)
                .projectId(1L)
                .title("Test Task")
                .status("DONE")
                .build();

        when(taskService.updateStatus(1L, "DONE")).thenReturn(updatedTask);

        mockMvc.perform(patch("/api/tasks/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DONE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("DONE"));

        verify(taskService, times(1)).updateStatus(1L, "DONE");
    }

    @Test
    @DisplayName("DELETE /api/tasks/{id} should delete task")
    void deleteTask() throws Exception {
        doNothing().when(taskService).delete(1L);

        mockMvc.perform(delete("/api/tasks/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Task deleted successfully"));

        verify(taskService, times(1)).delete(1L);
    }
}
