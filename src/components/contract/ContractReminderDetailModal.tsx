import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import type { ReminderRecord } from '../../services/contractReminderService';
import {
  contractReminderStatusClass,
  contractReminderStatusLabel,
  contractReminderTypeClass,
  contractReminderTypeLabel,
} from '../../utils/contractDisplayHelpers';

type ContractSummary = {
  contract_name: string;
  contract_code?: string | null;
};

type Props = {
  open: boolean;
  contract: ContractSummary | null;
  signDateLabel: string;
  reminders: ReminderRecord[];
  onClose: () => void;
};

/** 合同提醒记录详情弹窗（支出/收入合同列表共用） */
export default function ContractReminderDetailModal({
  open,
  contract,
  signDateLabel,
  reminders,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && contract && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                合同提醒记录 - {contract.contract_name}
              </h3>
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">合同编号：</span>
                  <span className="text-gray-800">{contract.contract_code || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">签订日期：</span>
                  <span className="text-gray-800">{signDateLabel}</span>
                </div>
              </div>
            </div>
            {reminders.length === 0 ? (
              <div className="text-center text-gray-500 py-8">暂无提醒记录</div>
            ) : (
              <div className="space-y-4">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${contractReminderTypeClass(reminder.reminder_type)}`}
                        >
                          {contractReminderTypeLabel(reminder.reminder_type)}
                        </span>
                        <h4 className="font-medium text-gray-800">{reminder.title}</h4>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${contractReminderStatusClass(reminder.status)}`}
                      >
                        {contractReminderStatusLabel(reminder.status)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{reminder.content}</p>
                    <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
                      <div>目标日期：{reminder.target_date}</div>
                      {reminder.days_remaining !== undefined && (
                        <div>剩余天数：{reminder.days_remaining}天</div>
                      )}
                      {reminder.amount && (
                        <div>金额：{reminder.amount.toLocaleString()}元</div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                      创建时间：{reminder.created_at?.slice(0, 19)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
