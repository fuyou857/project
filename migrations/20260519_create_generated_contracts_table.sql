-- 创建生成的合同主表
CREATE TABLE generated_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no VARCHAR(100) NOT NULL UNIQUE,
  template_id UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  template_file_version_id UUID NOT NULL REFERENCES contract_template_file_versions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  party_a_id UUID REFERENCES party_a(id) ON DELETE SET NULL,
  party_b_id UUID REFERENCES party_b(id) ON DELETE SET NULL,
  payment_method_text TEXT,
  variables_values JSONB DEFAULT '{}'::JSONB,
  merged_pdf_storage_path TEXT,
  generated_docx_storage_path TEXT,
  rich_text_draft TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  approval_id UUID,
  seal_annotation TEXT,
  sealed_pdf_storage_path TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  delete_reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 创建生成合同修订版表
CREATE TABLE generated_contract_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_id UUID NOT NULL REFERENCES generated_contracts(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  rich_text_html TEXT,
  merged_pdf_storage_path TEXT,
  change_summary TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建修订版索引
CREATE INDEX idx_generated_contract_revisions_generated_id ON generated_contract_revisions(generated_id);
CREATE UNIQUE INDEX idx_generated_contract_revisions_unique ON generated_contract_revisions(generated_id, revision);

-- 创建合同编号索引
CREATE INDEX idx_generated_contracts_contract_no ON generated_contracts(contract_no);

-- 启用 RLS
ALTER TABLE generated_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_contract_revisions ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "所有人可查看生成合同" ON generated_contracts FOR SELECT USING (true);
CREATE POLICY "所有人可创建生成合同" ON generated_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "所有人可更新生成合同" ON generated_contracts FOR UPDATE USING (true);
CREATE POLICY "所有人可删除生成合同" ON generated_contracts FOR DELETE USING (true);

CREATE POLICY "所有人可查看合同修订版" ON generated_contract_revisions FOR SELECT USING (true);
CREATE POLICY "所有人可创建合同修订版" ON generated_contract_revisions FOR INSERT WITH CHECK (true);
CREATE POLICY "所有人可更新合同修订版" ON generated_contract_revisions FOR UPDATE USING (true);
CREATE POLICY "所有人可删除合同修订版" ON generated_contract_revisions FOR DELETE USING (true);