package com.example.contract.template.entity.common;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "operation_logs")
public class OperationLogEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "operation_time")
    private LocalDateTime operationTime;

    @Column(name = "module")
    private String module;

    @Column(name = "action_type")
    private String actionType;

    @Column(name = "element_id")
    private String elementId;

    @Column(name = "route")
    private String route;

    @Column(name = "x_coordinate")
    private Integer xCoordinate;

    @Column(name = "y_coordinate")
    private Integer yCoordinate;

    @Column(name = "api_url")
    private String apiUrl;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "error_level")
    private String errorLevel;

    @Column(name = "error_stack", columnDefinition = "TEXT")
    private String errorStack;

    @Column(name = "log_type")
    private String logType; // CLICK_OP, ERROR, etc.
}
