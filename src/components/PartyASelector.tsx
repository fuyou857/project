import { useState, useCallback } from 'react';
import { supabase } from '../supabase/client';
import { SegmentedControl } from './ui';
import EntitySearchSelector from './EntitySearchSelector';
import PartyUnitQuickAddModal from './PartyUnitQuickAddModal';
import { useEntityListLoader } from '../hooks/useEntityListLoader';

export interface PartyA {
  id: string;
  name: string;
  unit_type: string;
  credit_code: string;
  bank_name: string;
  bank_account: string;
  phone: string;
}

const initialPartyAForm = {
  name: '',
  unit_type: 'construction',
  credit_code: '',
  bank_name: '',
  bank_account: '',
  phone: '',
};

function QuickAddPartyAModal({
  show,
  onClose,
  onSuccess,
}: {
  show: boolean;
  onClose: () => void;
  onSuccess: (id: string, name: string) => void;
}) {
  const [form, setForm] = useState(initialPartyAForm);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      alert('请填写单位名称');
      return;
    }
    setSaving(true);
    try {
      // 只插入数据库中已存在的字段
      const insertData = {
        name: form.name,
        unit_type: form.unit_type,
        credit_code: form.credit_code,
        phone: form.phone,
        address: '', // 添加 address 字段
      };
      const { data, error } = await supabase.from('party_a').insert(insertData).select().single();
      if (error) throw error;
      onSuccess(data.id, data.name);
      setForm(initialPartyAForm);
      onClose();
    } catch (err: unknown) {
      alert('添加失败：' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PartyUnitQuickAddModal
      show={show}
      title="快速新增建设单位"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
    >
      <div>
        <label className="block text-sm text-gray-600 mb-2">
          单位名称<span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-2">单位类别</label>
        <SegmentedControl
          value={form.unit_type as 'construction' | 'general' | 'subcontract'}
          onChange={(v) => setForm({ ...form, unit_type: v })}
          options={[
            { value: 'construction', label: '建设单位' },
            { value: 'general', label: '总包单位' },
            { value: 'subcontract', label: '分包单位' },
          ]}
          aria-label="单位类别"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">统一信用代码</label>
          <input
            type="text"
            value={form.credit_code}
            onChange={(e) => setForm({ ...form, credit_code: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-2">电话</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">开户行</label>
          <input
            type="text"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-2">开户账号</label>
          <input
            type="text"
            value={form.bank_account}
            onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </PartyUnitQuickAddModal>
  );
}

interface PartyASelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  onRefresh?: () => void;
}

export default function PartyASelector({
  value,
  onChange,
  label = '建设单位',
  placeholder = '搜索建设单位...',
  required = false,
  onRefresh,
}: PartyASelectorProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const loadPartyA = useCallback(async () => {
    const { data, error } = await supabase
      .from('party_a')
      .select(
        'id, name, unit_type, credit_code, bank_name, bank_account, phone',
      )
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as PartyA[];
  }, []);

  const { items: partyAList, refresh: refreshPartyA } = useEntityListLoader(loadPartyA);

  const handleQuickAdd = (id: string, _name: string) => {
    onChange(id);
    onRefresh?.();
    void refreshPartyA();
  };

  return (
    <>
      <EntitySearchSelector
        value={value}
        onChange={onChange}
        items={partyAList}
        getLabel={(item) => item.name}
        label={label}
        placeholder={placeholder}
        required={required}
        emptyListMessage="暂无建设单位，点击下方按钮新增"
        noMatchMessage="未找到匹配的建设单位"
        quickAddButtonLabel="+ 新增建设单位"
        onQuickAdd={() => setShowQuickAdd(true)}
      />
      <QuickAddPartyAModal
        show={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAdd}
      />
    </>
  );
}
