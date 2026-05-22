/** 分页栏窗口内页码（最多 5 个按钮时的页码计算） */
export function windowedPageNumber(totalPages: number, currentPage: number, index: number): number {
  if (totalPages <= 5) return index + 1;
  if (currentPage <= 3) return index + 1;
  if (currentPage >= totalPages - 2) return totalPages - 4 + index;
  return currentPage - 2 + index;
}
