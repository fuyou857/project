package com.example.contract.template.config;

import javax.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class FileUploadConfig {

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    @Value("${file.template-dir:./templates}")
    private String templateDir;

    @Value("${file.contract-dir:./contracts}")
    private String contractDir;

    @Value("${file.version-dir:./versions}")
    private String versionDir;

    @PostConstruct
    public void init() {
        createDirectoryIfNotExists(uploadDir);
        createDirectoryIfNotExists(templateDir);
        createDirectoryIfNotExists(contractDir);
        createDirectoryIfNotExists(versionDir);
    }

    private void createDirectoryIfNotExists(String directory) {
        try {
            Path path = Paths.get(directory);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
        } catch (IOException e) {
            throw new RuntimeException("无法创建目录: " + directory, e);
        }
    }
}