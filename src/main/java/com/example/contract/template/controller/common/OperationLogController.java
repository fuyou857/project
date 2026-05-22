package com.example.contract.template.controller.common;

import com.example.contract.template.entity.common.OperationLogEntity;
import com.example.contract.template.service.common.OperationLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/common/logs")
public class OperationLogController {

    @Autowired
    private OperationLogService logService;

    @PostMapping
    public ResponseEntity<Void> recordLog(@RequestBody OperationLogEntity logEntity) {
        logService.recordLog(logEntity);
        return ResponseEntity.ok().build();
    }
}
