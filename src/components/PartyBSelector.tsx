import { useState, useCallback } from 'react';
import { FaUpload } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { SegmentedControl } from './ui';
import EntitySearchSelector from './EntitySearchSelector';
import PartyUnitQuickAddModal from './PartyUnitQuickAddModal';
import { useEntityListLoader } from '../hooks/useEntityListLoader';

export interface PartyB {
  id: string;
  name: string;
  unit_type: string;
  tax_type: string;
  credit_code: string;
  legal_person: string;
  phone: string;
  bank_name: string;
  bank_account: string;
  fax: string;
  is_certified: boolean;
  business_license: string;
  bank_license: string;
}

const initialPartyBForm = {
  name: '',
  unit_type: 'labor',
  tax_type: 'general',
  credit_code: '',
  legal_person: '',
  phone: '',
  bank_name: '',
  bank_account: '',
  fax: '',
  is_certified: false,
  business_license: '',
  bank_license: '',
};

function QuickAddPartyBModal({
  show,
  onClose,
  onSuccess,
}: {
  show: boolean;
  onClose: () => void;
  onSuccess: (id: string, name: string) => void;
}) {
  const [form, setForm] = useState(initialPartyBForm);
  const [saving, setSaving] = useState(false);
  const [creditCodeError, setCreditCodeError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      alert('请填写乙方单位名称');
      return;
    }
    if (!form.credit_code?.trim()) {
      alert('请填写社会信用代码');
      return;
    }

    setSaving(true);
    setCreditCodeError(null);

    try {
      // 唯一性校验
      const { data: existing, error: checkError } = await supabase
        .from('party_b')
        .select('id, unit_name')
        .eq('credit_code', form.credit_code.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setCreditCodeError(`此单位已经存在基础数据库中（${existing.unit_name}），一个单位仅可保留一个，不允许重复创建`);
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.from('party_b').insert({
        unit_name: form.name.trim(),
        unit_type: form.unit_type === 'labor' ? '劳务类' : form.unit_type === 'material' ? '材料类' : form.unit_type === 'professional' ? '专业分包' : '其他',
        taxpayer_type: form.tax_type === 'general' ? '一般纳税人' : '小规模纳税人',
        credit_code: form.credit_code.trim(),
        legal_person: form.legal_person,
        phone: form.phone,
        bank_name: form.bank_name,
        bank_account: form.bank_account,
        is_certified: form.is_certified,
      }).select().single();

      if (error) throw error;
      alert('保存成功');
      onSuccess(data.id, data.unit_name);
      setForm(initialPartyBForm);
      onClose();
    } catch (err: unknown) {
      alert('添加失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PartyUnitQuickAddModal
      show={show}
      title="快速新增乙方单位"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
    >
      <div>
        <label className="block text-sm text-gray-600 mb-2">
          乙方单位名称<span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">
            单位类别<span className="text-red-500 ml-1">*</span>
          </label>
          <SegmentedControl
            value={form.unit_type as 'labor' | 'material' | 'professional' | 'other'}
            onChange={(v) => setForm({ ...form, unit_type: v })}
            options={[
              { value: 'labor', label: '劳务供应商' },
              { value: 'material', label: '材料供应商' },
              { value: 'professional', label: '专业分包供应商' },
              { value: 'other', label: '其他' },
            ]}
            aria-label="单位类别"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-2">
            纳税人类别<span className="text-red-500 ml-1">*</span>
          </label>
          <SegmentedControl
            value={form.tax_type as 'general' | 'small' | 'other'}
            onChange={(v) => setForm({ ...form, tax_type: v })}
            options={[
              { value: 'general', label: '一般纳税人' },
              { value: 'small', label: '小规模纳税人' },
              { value: 'other', label: '其他' },
            ]}
            aria-label="纳税人类别"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">
            社会信用代码<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            required
            value={form.credit_code}
            onChange={(e) => setForm({ ...form, credit_code: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {creditCodeError && (
            <p className="text-xs text-red-600 mt-1">{creditCodeError}</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-2">法人代表</label>
          <input
            type="text"
            value={form.legal_person}
            onChange={(e) => setForm({ ...form, legal_person: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">联系电话</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-2">传真</label>
          <input
            type="text"
            value={form.fax}
            onChange={(e) => setForm({ ...form, fax: e.target.value })}
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
      <div className="flex items-center gap-3">
        <label className="block text-sm text-gray-600">是否认证</label>
        <button
          type="button"
          onClick={() => setForm({ ...form, is_certified: !form.is_certified })}
          className={`relative w-12 h-6 rounded-full transition-colors ${form.is_certified ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.is_certified ? 'translate-x-7' : 'translate-x-1'}`}
          />
        </button>
        <span className="text-sm text-gray-500">{form.is_certified ? '已认证' : '未认证'}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">营业执照</label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="ui-file-input-safe" data-file-upload-field="true"
              id="businessLicense"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setForm({ ...form, business_license: file.name });
              }}
            />
            <label
              htmlFor="businessLicense"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-pointer hover:bg-gray-200"
            >
              <FaUpload className="w-4 h-4" />
              {form.business_license || '选择文件'}
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-2">开户许可证</label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="ui-file-input-safe" data-file-upload-field="true"
              id="bankLicense"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setForm({ ...form, bank_license: file.name });
              }}
            />
            <label
              htmlFor="bankLicense"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-pointer hover:bg-gray-200"
            >
              <FaUpload className="w-4 h-4" />
              {form.bank_license || '选择文件'}
            </label>
          </div>
        </div>
      </div>
    </PartyUnitQuickAddModal>
  );
}

interface PartyBSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  onRefresh?: () => void;
}

export default function PartyBSelector({
  value,
  onChange,
  label = '乙方单位',
  placeholder = '搜索乙方单位...',
  required = false,
  onRefresh,
}: PartyBSelectorProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const emptyPartyBFields: Omit<PartyB, 'id' | 'name'> = {
    unit_type: '',
    tax_type: '',
    credit_code: '',
    legal_person: '',
    phone: '',
    bank_name: '',
    bank_account: '',
    fax: '',
    is_certified: false,
    business_license: '',
    bank_license: '',
  };

  const loadPartyB = useCallback(async () => {
    const { data } = await supabase.from('party_b').select('id, unit_name').order('created_at', { ascending: false });
    if (!data) return [];
    return (data as { id: string; unit_name: string | null }[]).map((row) => ({
      id: row.id,
      name: row.unit_name ?? '',
      ...emptyPartyBFields,
    }));
  }, []);

  const { items: partyBList, refresh: refreshPartyB } = useEntityListLoader(loadPartyB);

  const handleQuickAdd = (id: string, _name: string) => {
    onChange(id);
    onRefresh?.();
    void refreshPartyB();
  };

  return (
    <>
      <EntitySearchSelector
        value={value}
        onChange={onChange}
        items={partyBList}
        getLabel={(item) => item.name}
        label={label}
        placeholder={placeholder}
        required={required}
        emptyListMessage="暂无乙方单位，点击下方按钮新增"
        noMatchMessage="未找到匹配的乙方单位"
        quickAddButtonLabel="+ 新增乙方单位"
        onQuickAdd={() => setShowQuickAdd(true)}
      />
      <QuickAddPartyBModal
        show={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAdd}
      />
    </>
  );
}
