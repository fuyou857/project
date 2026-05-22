package com.example.contract.template.repository.common;

import com.example.contract.template.entity.common.OperationLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperationLogRepository extends JpaRepository<OperationLogEntity, Long> {
}
