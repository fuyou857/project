import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** 合同删除确认弹窗（支出/收入合同列表共用） */
export default function ContractDeleteConfirmModal({ open, onClose, onConfirm }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
            <p className="text-gray-700 mb-6">确定要删除该合同吗？此操作不可恢复。</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">
                取消
              </button>
              <button type="button" onClick={onConfirm} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">
                确认删除
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
