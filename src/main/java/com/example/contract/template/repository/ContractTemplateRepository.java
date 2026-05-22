package com.example.contract.template.repository;

import com.example.contract.template.entity.ContractTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContractTemplateRepository extends JpaRepository<ContractTemplate, Long> {

    List<ContractTemplate> findByCategoryIdAndIsDeletedFalse(Long categoryId);

    List<ContractTemplate> findByStatusAndIsDeletedFalse(String status);

    Optional<ContractTemplate> findByCodeAndIsDeletedFalse(String code);

    List<ContractTemplate> findByIsDeletedFalseOrderByCreatedAtDesc();

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, Long id);

    List<ContractTemplate> findByNameContainingAndIsDeletedFalse(String name);
}