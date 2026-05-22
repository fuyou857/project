import { useCallback, useState } from 'react';
import {
  getReminderRecords,
  type ReminderRecord,
} from '../services/contractReminderService';

type ContractType = 'income' | 'expense';

/**
 * 合同列表提醒角标与详情弹窗状态（支出/收入合同列表共用）
 */
export function useContractReminders(contractType: ContractType) {
  const [contractReminders, setContractReminders] = useState<Map<string, number>>(new Map());
  const [showReminderDetail, setShowReminderDetail] = useState(false);
  const [selectedContract, setSelectedContract] = useState<{
    id: string;
    contract_name: string;
    contract_code?: string | null;
    sign_date?: string | null;
    signing_date?: string | null;
  } | null>(null);
  const [contractReminderList, setContractReminderList] = useState<ReminderRecord[]>([]);

  const fetchReminders = useCallback(async () => {
    try {
      const reminders = await getReminderRecords({ status: 'pending', contractType });
      const countMap = new Map<string, number>();
      reminders.forEach((r) => {
        countMap.set(r.contract_id, (countMap.get(r.contract_id) || 0) + 1);
      });
      setContractReminders(countMap);
    } catch (error) {
      console.error('获取提醒记录失败:', error);
    }
  }, [contractType]);

  const openReminderDetail = useCallback(
    async (contract: NonNullable<typeof selectedContract>, onError?: (msg: string) => void) => {
      try {
        setSelectedContract(contract);
        const reminders = await getReminderRecords({
          contractId: contract.id,
          contractType,
        });
        setContractReminderList(reminders);
        setShowReminderDetail(true);
      } catch (error) {
        console.error('获取合同提醒记录失败:', error);
        onError?.('获取提醒记录失败');
      }
    },
    [contractType],
  );

  const closeReminderDetail = useCallback(() => {
    setShowReminderDetail(false);
  }, []);

  return {
    contractReminders,
    showReminderDetail,
    selectedContract,
    contractReminderList,
    fetchReminders,
    openReminderDetail,
    closeReminderDetail,
  };
}
