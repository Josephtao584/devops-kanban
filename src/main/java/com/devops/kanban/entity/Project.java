package com.devops.kanban.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Project {
    private Long id;
    private String name;
    private String description;
    private String repositoryUrl;
    private String localPath;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
