function toastBannerClass(type: string): string {
  if (type === 'success') return 'bg-green-600';
  if (type === 'warning') return 'bg-yellow-600';
  return 'bg-red-600';
}

/** 单条顶部固定 Toast（合同列表 / 财务 / 管理等页共用样式） */
export default function SingleToastBanner({
  type,
  message,
}: {
  type: string;
  message: string;
}) {
  return (
    <div
      className={`fixed top-4 right-4 px-4 py-2 rounded-lg text-gray-800 z-50 ${toastBannerClass(type)}`}
    >
      {message}
    </div>
  );
}
