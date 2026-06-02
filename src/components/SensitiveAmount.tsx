import { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

interface SensitiveAmountProps {
  amount: number;
  className?: string;
  mask?: boolean;
}

const SensitiveAmount = ({
  amount,
  className = '',
  mask: defaultMask = true,
}: SensitiveAmountProps) => {
  const [visible, setVisible] = useState(!defaultMask);
  const [isHovered, setIsHovered] = useState(false);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const maskAmount = (value: number) => {
    if (value >= 1000000) {
      return `¥${(value / 10000).toFixed(0)}万+`;
    }
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(1)}万`;
    }
    return '¥****';
  };

  const toggleVisible = () => {
    setVisible(!visible);
  };

  return (
    <div
      className={`inline-flex items-center gap-2 cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={visible ? 'text-gray-800' : 'text-gray-500'}>
        {visible ? formatAmount(amount) : maskAmount(amount)}
      </span>
      {isHovered && (
        <button
          onClick={toggleVisible}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={visible ? '隐藏金额' : '显示金额'}
        >
          {visible ? <FaEyeSlash /> : <FaEye />}
        </button>
      )}
    </div>
  );
};

export default SensitiveAmount;