package com.devops.kanban.controller;

import com.devops.kanban.converter.EntityDTOConverter;
import com.devops.kanban.dto.ApiResponse;
import com.devops.kanban.dto.ExecutionDTO;
import com.devops.kanban.entity.Execution;
import com.devops.kanban.service.AgentExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/executions")
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.origins:http://localhost:5173}")
public class ExecutionController {

    private final AgentExecutionService executionService;
    private final EntityDTOConverter converter;
    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @PostMapping
    public ResponseEntity<ApiResponse<ExecutionDTO>> startExecution(@Valid @RequestBody ExecutionDTO dto) {
        Execution execution = executionService.startExecution(dto.getTaskId(), dto.getAgentId());
        return ResponseEntity.ok(ApiResponse.success("Execution started", converter.toDTO(execution)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExecutionDTO>> getExecution(@PathVariable Long id) {
        Execution execution = executionService.getExecution(id);
        return ResponseEntity.ok(ApiResponse.success(converter.toDTO(execution)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExecutionDTO>>> getExecutions(
            @RequestParam(required = false) Long taskId) {
        if (taskId == null) {
            return ResponseEntity.ok(ApiResponse.error("taskId is required"));
        }
        List<ExecutionDTO> executions = executionService.getExecutionsByTaskId(taskId).stream()
                .map(converter::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(executions));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<ApiResponse<Void>> stopExecution(@PathVariable Long id) {
        executionService.stopExecution(id);
        return ResponseEntity.ok(ApiResponse.success("Execution stopped", null));
    }

    @GetMapping(value = "/{id}/output", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter getExecutionOutput(@PathVariable Long id) {
        SseEmitter emitter = new SseEmitter(300000L); // 5 minutes timeout
        emitters.put(id, emitter);

        emitter.onCompletion(() -> emitters.remove(id));
        emitter.onTimeout(() -> emitters.remove(id));

        // Send initial status
        executor.execute(() -> {
            try {
                Execution execution = executionService.getExecution(id);
                emitter.send(SseEmitter.event().name("status").data(execution.getStatus().name()));

                if (execution.getOutput() != null) {
                    emitter.send(SseEmitter.event().name("output").data(execution.getOutput()));
                }

                if (execution.getStatus() == Execution.ExecutionStatus.SUCCESS ||
                    execution.getStatus() == Execution.ExecutionStatus.FAILED ||
                    execution.getStatus() == Execution.ExecutionStatus.CANCELLED) {
                    emitter.complete();
                }
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }
}
