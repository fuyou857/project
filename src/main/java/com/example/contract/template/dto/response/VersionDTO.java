package com.example.contract.template.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VersionDTO {

    private Long id;

    private Long parentId;

    private Integer versionNumber;

    private String filePath;

    private String fileName;

    private String changeLog;

    private LocalDateTime createdAt;

    private String createdBy;
}