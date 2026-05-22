import { useState, useCallback } from 'react';
import { alertMissingRequiredFields } from '../utils/contractSubPage';
import { supabase } from '../supabase/client';
import EntitySearchSelector from './EntitySearchSelector';
import PartyUnitQuickAddModal from './PartyUnitQuickAddModal';
import { useEntityListLoader } from '../hooks/useEntityListLoader';

export interface SignatoryUnit {
  id: string;
  unit_name: string;
  unit_code: string;
  credit_code: string;
  contact_person: string;
  contact_phone: string;
  office_address: string;
  invoice_title: string;
  tax_number: string;
  bank_name: string;
  bank_account: string;
  address: string;
}

interface QuickAddModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (id: string, name: string) => void;
}

function QuickAddSignatoryModal({ show, onClose, onSuccess }: QuickAddModalProps) {
  const [form, setForm] = useState({
    unit_name: '',
    credit_code: '',
    contact_person: '',
    contact_phone: '',
    office_address: '',
    invoice_title: '',
    tax_number: '',
    bank_name: '',
    bank_account: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const missing: string[] = [];
    if (!form.unit_name?.trim()) missing.push('签约单位名称');
    if (!form.contact_person?.trim()) missing.push('联系人');
    if (!form.contact_phone?.trim()) missing.push('联系电话');
    if (!form.invoice_title?.trim()) missing.push('发票抬头');
    if (!form.tax_number?.trim()) missing.push('税号');
    if (!form.bank_name?.trim()) missing.push('开户银行');
    if (!form.bank_account?.trim()) missing.push('开户账号');
    
    if (alertMissingRequiredFields(missing)) return;

    setSaving(true);
    try {
      const newCode = generateCode();
      const { data, error } = await supabase
        .from('signatory_units')
        .insert({ ...form, unit_code: newCode })
        .select()
        .single();
      
      if (error) throw error;
      
      onSuccess(data.id, data.unit_name);
      setForm({
        unit_name: '',
        credit_code: '',
        contact_person: '',
        contact_phone: '',
        office_address: '',
        invoice_title: '',
        tax_number: '',
        bank_name: '',
        bank_account: '',
        address: '',
      });
      onClose();
    } catch (err: unknown) {
      alert('添加失败：' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  };

  function generateCode() {
    const date = new Date();
    const prefix = 'SIGN' + date.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    return prefix + suffix;
  }

  return (
    <PartyUnitQuickAddModal
      show={show}
      title="快速新增签约单位"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">签约单位名称<span className="text-red-500 ml-1">*</span></label>
              <input
                type="text"
                value={form.unit_name}
                onChange={(e) => setForm({ ...form, unit_name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">社会信用代码</label>
              <input
                type="text"
                value={form.credit_code}
                onChange={(e) => setForm({ ...form, credit_code: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">联系人<span className="text-red-500 ml-1">*</span></label>
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">联系电话<span className="text-red-500 ml-1">*</span></label>
              <input
                type="text"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">办公地址</label>
            <input
              type="text"
              value={form.office_address}
              onChange={(e) => setForm({ ...form, office_address: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">发票抬头<span className="text-red-500 ml-1">*</span></label>
              <input
                type="text"
                value={form.invoice_title}
                onChange={(e) => setForm({ ...form, invoice_title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">税号<span className="text-red-500 ml-1">*</span></label>
              <input
                type="text"
                value={form.tax_number}
                onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">开户银行<span className="text-red-500 ml-1">*</span></label>
              <input
                type="text"
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">开户账号<span className="text-red-500 ml-1">*</span></label>
              <input
                type="text"
                value={form.bank_account}
                onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">地址</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
    </PartyUnitQuickAddModal>
  );
}

interface SignatoryUnitSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  onRefresh?: () => void;
}

export default function SignatoryUnitSelector({
  value,
  onChange,
  label = '签约单位',
  placeholder = '搜索签约单位...',
  required = false,
  onRefresh,
}: SignatoryUnitSelectorProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const signatoryRest: Omit<SignatoryUnit, 'id' | 'unit_name'> = {
    unit_code: '',
    credit_code: '',
    contact_person: '',
    contact_phone: '',
    office_address: '',
    invoice_title: '',
    tax_number: '',
    bank_name: '',
    bank_account: '',
    address: '',
  };

  const loadUnits = useCallback(async () => {
    const { data } = await supabase
      .from('signatory_units')
      .select('id, unit_name')
      .order('created_at', { ascending: false });
    if (!data) return [];
    return (data as { id: string; unit_name: string | null }[]).map((row) => ({
      id: row.id,
      unit_name: row.unit_name ?? '',
      ...signatoryRest,
    }));
  }, []);

  const { items: units, refresh: refreshUnits } = useEntityListLoader(loadUnits);

  const handleQuickAdd = (id: string, _name: string) => {
    onChange(id);
    onRefresh?.();
    void refreshUnits();
  };

  return (
    <>
      <EntitySearchSelector
        value={value}
        onChange={onChange}
        items={units}
        getLabel={(item) => item.unit_name}
        label={label}
        placeholder={placeholder}
        required={required}
        emptyListMessage="暂无签约单位，点击下方按钮新增"
        noMatchMessage="未找到匹配的签约单位"
        quickAddButtonLabel="+ 新增签约单位"
        onQuickAdd={() => setShowQuickAdd(true)}
      />
      <QuickAddSignatoryModal
        show={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAdd}
      />
    </>
  );
}
