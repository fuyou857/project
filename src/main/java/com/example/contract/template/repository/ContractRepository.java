package com.example.contract.template.repository;

import com.example.contract.template.entity.Contract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContractRepository extends JpaRepository<Contract, Long> {

    Optional<Contract> findByContractNoAndIsDeletedFalse(String contractNo);

    List<Contract> findByTemplateIdAndIsDeletedFalse(Long templateId);

    List<Contract> findByStatusAndIsDeletedFalse(String status);

    List<Contract> findByPartyAAndIsDeletedFalse(String partyA);

    List<Contract> findByPartyBAndIsDeletedFalse(String partyB);

    List<Contract> findByProjectNameContainingAndIsDeletedFalse(String projectName);

    List<Contract> findByIsDeletedFalseOrderByCreatedAtDesc();

    @Query("SELECT MAX(c.contractNo) FROM Contract c WHERE c.contractNo LIKE :prefix%")
    String findMaxContractNoByPrefix(@Param("prefix") String prefix);

    boolean existsByContractNo(String contractNo);
}