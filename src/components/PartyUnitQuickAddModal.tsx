import { motion } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';

type Props = {
  show: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  children: React.ReactNode;
};

/** 甲方/乙方/签章单位快速新增弹窗壳（表单内容由各选择器注入） */
export default function PartyUnitQuickAddModal({
  show,
  title,
  onClose,
  onSubmit,
  saving,
  children,
}: Props) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
