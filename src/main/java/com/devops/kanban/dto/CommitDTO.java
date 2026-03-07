package com.devops.kanban.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommitDTO {
    private String hash;
    private String shortHash;
    private String message;
    private String author;
    private String authorEmail;
    private LocalDateTime timestamp;
    private List<String> parentHashes;
}
