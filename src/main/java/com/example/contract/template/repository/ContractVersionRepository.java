package com.example.contract.template.repository;

import com.example.contract.template.entity.ContractVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContractVersionRepository extends JpaRepository<ContractVersion, Long> {

    List<ContractVersion> findByContractIdOrderByVersionNumberDesc(Long contractId);

    Optional<ContractVersion> findByContractIdAndVersionNumber(Long contractId, Integer versionNumber);

    Integer countByContractId(Long contractId);

    void deleteByContractId(Long contractId);
}