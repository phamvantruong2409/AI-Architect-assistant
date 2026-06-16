export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export const BUDGET_LABELS: Record<string, string> = {
  under_500m: 'Dưới 500 triệu',
  '500m_1b': '500 triệu – 1 tỷ',
  '1b_2b': '1 tỷ – 2 tỷ',
  over_2b: 'Trên 2 tỷ',
}

export const CONSTRAINT_TYPE_LABELS: Record<string, string> = {
  accessibility: 'Tiếp cận',
  safety: 'An toàn',
  functional: 'Chức năng',
  spatial: 'Không gian',
  budget: 'Ngân sách',
}

export const CONSTRAINT_TYPE_COLORS: Record<string, string> = {
  accessibility: 'bg-blue-100 text-blue-700',
  safety: 'bg-red-100 text-red-700',
  functional: 'bg-green-100 text-green-700',
  spatial: 'bg-purple-100 text-purple-700',
  budget: 'bg-yellow-100 text-yellow-700',
}
