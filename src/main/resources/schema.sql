CREATE TABLE IF NOT EXISTS template_category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    level INT NOT NULL,
    parent_id BIGINT,
    sort_order INT,
    description VARCHAR(500),
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (parent_id) REFERENCES template_category(id)
);

CREATE TABLE IF NOT EXISTS contract_template (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    category_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    file_size BIGINT,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    description VARCHAR(1000),
    variables_json TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (category_id) REFERENCES template_category(id)
);

CREATE TABLE IF NOT EXISTS template_version (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    change_log VARCHAR(1000),
    created_at DATETIME NOT NULL,
    created_by VARCHAR(50),
    FOREIGN KEY (template_id) REFERENCES contract_template(id)
);

CREATE TABLE IF NOT EXISTS template_variable (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    default_value VARCHAR(500),
    required BOOLEAN DEFAULT FALSE,
    options TEXT,
    sort_order INT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (template_id) REFERENCES contract_template(id)
);

CREATE TABLE IF NOT EXISTS contract (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contract_no VARCHAR(50) NOT NULL UNIQUE,
    template_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    party_a VARCHAR(200),
    party_b VARCHAR(200),
    project_name VARCHAR(300),
    contract_amount DECIMAL(18,2),
    sign_date DATETIME,
    start_date DATETIME,
    end_date DATETIME,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    file_path VARCHAR(500),
    variables_json TEXT,
    approval_status VARCHAR(20) DEFAULT 'PENDING',
    approval_flow_id BIGINT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (template_id) REFERENCES contract_template(id)
);

CREATE TABLE IF NOT EXISTS contract_version (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contract_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    change_log VARCHAR(1000),
    created_at DATETIME NOT NULL,
    created_by VARCHAR(50),
    FOREIGN KEY (contract_id) REFERENCES contract(id)
);