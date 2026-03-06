package com.devops.kanban.repository;

import com.devops.kanban.entity.TaskSource;
import java.util.List;
import java.util.Optional;

public interface TaskSourceRepository {
    List<TaskSource> findByProjectId(Long projectId);
    Optional<TaskSource> findById(Long id);
    TaskSource save(TaskSource source);
    void deleteById(Long id);
    void deleteByProjectId(Long projectId);
    Long getNextId();
}
