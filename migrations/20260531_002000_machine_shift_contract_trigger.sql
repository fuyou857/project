-- 机械台班记录状态变更触发器
-- 当台班记录状态变为 confirmed 时，自动更新关联合同的已使用台班数和费用

CREATE OR REPLACE FUNCTION update_contract_usage_from_shift()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_warning_threshold NUMERIC;
BEGIN
  -- 只处理状态变更
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NEW.rental_contract_id IS NOT NULL THEN
    v_contract_id := NEW.rental_contract_id;
    
    -- 更新合同的已使用台班数和费用
    UPDATE expense_contracts
    SET 
      used_shifts = COALESCE(used_shifts, 0) + NEW.shift_count,
      used_amount = COALESCE(used_amount, 0) + NEW.total_cost,
      updated_at = NOW()
    WHERE id = v_contract_id;
    
    -- 检查是否超过 90% 预警阈值
    SELECT total_budget_shifts INTO v_warning_threshold
    FROM expense_contracts
    WHERE id = v_contract_id;
    
    IF v_warning_threshold IS NOT NULL THEN
      DECLARE
        v_current_shifts NUMERIC;
        v_contract_no VARCHAR;
        v_project_id UUID;
      BEGIN
        SELECT used_shifts, contract_no, project_id INTO v_current_shifts, v_contract_no, v_project_id
        FROM expense_contracts
        WHERE id = v_contract_id;
        
        IF v_current_shifts >= v_warning_threshold * 0.9 THEN
          -- 创建预警通知
          INSERT INTO notifications (user_id, title, body, category, payload, created_at)
          SELECT 
            pm.user_id,
            '合同使用量预警' AS title,
            format('机械租赁合同 %s 使用量已达 %.1f%%（%s / %s 台班），请注意合同执行情况。',
              COALESCE(v_contract_no, v_contract_id),
              (v_current_shifts / v_warning_threshold) * 100,
              v_current_shifts,
              v_warning_threshold
            ) AS body,
            'warning' AS category,
            jsonb_build_object(
              'type', 'contract_warning',
              'contract_id', v_contract_id,
              'used_shifts', v_current_shifts,
              'total_budget_shifts', v_warning_threshold
            ) AS payload,
            NOW() AS created_at
          FROM project_members pm
          WHERE pm.project_id = v_project_id;
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS trg_update_contract_usage_from_shift ON machine_shift_records;

-- 创建触发器
CREATE TRIGGER trg_update_contract_usage_from_shift
  AFTER UPDATE ON machine_shift_records
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_usage_from_shift();
