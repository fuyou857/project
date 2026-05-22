package com.example.contract.template.service.common;

import com.example.contract.template.entity.common.OperationLogEntity;
import com.example.contract.template.repository.common.OperationLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.stream.Stream;

@Slf4j
@Service
public class OperationLogService {

    @Autowired
    private OperationLogRepository logRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String LOG_DIR = "logs";
    private final long MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    private final BlockingQueue<OperationLogEntity> logQueue = new LinkedBlockingQueue<>(1000);

    @Async
    public void recordLog(OperationLogEntity logEntity) {
        logEntity.setOperationTime(LocalDateTime.now());
        
        // 1. Save to DB
        try {
            logRepository.save(logEntity);
        } catch (Exception e) {
            log.error("Failed to save log to DB, caching locally", e);
            logQueue.offer(logEntity);
        }

        // 2. Write to File (JSON Lines)
        writeToFile(logEntity);
    }

    private synchronized void writeToFile(OperationLogEntity logEntity) {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String baseFileName = "operation_log_" + dateStr;
        File logFile = findCurrentLogFile(baseFileName);

        try (BufferedWriter writer = new BufferedWriter(new FileWriter(logFile, true))) {
            String prefix = "";
            if ("ERROR".equals(logEntity.getLogType())) prefix = "【ERROR】";
            else if ("CLICK_OP".equals(logEntity.getLogType())) prefix = "【CLICK_OP】";

            String jsonLine = prefix + objectMapper.writeValueAsString(logEntity);
            writer.write(jsonLine);
            writer.newLine();
        } catch (IOException e) {
            log.error("Failed to write log to file", e);
        }
    }

    private File findCurrentLogFile(String baseName) {
        File dir = new File(LOG_DIR);
        if (!dir.exists()) dir.mkdirs();

        int index = 0;
        File currentFile;
        while (true) {
            String fileName = baseName + (index == 0 ? "" : "_" + index) + ".log";
            currentFile = new File(dir, fileName);
            if (!currentFile.exists() || currentFile.length() < MAX_FILE_SIZE) {
                break;
            }
            index++;
        }
        return currentFile;
    }

    @Scheduled(cron = "0 0 0 * * ?") // Every midnight
    public void autoCleanupLogs() {
        log.info("Starting auto cleanup of logs older than 7 days");
        File dir = new File(LOG_DIR);
        if (!dir.exists()) return;

        LocalDateTime threshold = LocalDateTime.now().minusDays(7);
        File[] files = dir.listFiles((d, name) -> name.startsWith("operation_log_") && name.endsWith(".log"));

        if (files != null) {
            for (File file : files) {
                try {
                    String datePart = file.getName().substring(14, 22);
                    LocalDateTime fileDate = LocalDateTime.parse(datePart + "0000", DateTimeFormatter.ofPattern("yyyyMMddHHmm"));
                    if (fileDate.isBefore(threshold)) {
                        if (file.delete()) log.info("Deleted expired log file: {}", file.getName());
                    }
                } catch (Exception e) {
                    log.error("Error checking/deleting log file: {}", file.getName(), e);
                }
            }
        }
    }

    @Scheduled(fixedDelay = 60000) // Every minute
    public void retryFailedLogs() {
        if (logQueue.isEmpty()) return;
        log.info("Retrying failed logs from cache");
        while (!logQueue.isEmpty()) {
            OperationLogEntity logEntity = logQueue.poll();
            if (logEntity != null) {
                try {
                    logRepository.save(logEntity);
                } catch (Exception e) {
                    log.error("Retry failed, putting back to queue");
                    logQueue.offer(logEntity);
                    break;
                }
            }
        }
    }
}
