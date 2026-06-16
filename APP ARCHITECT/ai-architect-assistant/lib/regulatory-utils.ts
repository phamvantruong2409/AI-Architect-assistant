import type { ViolationSeverity, ViolationCategory, CheckStatus } from './regulatory-types'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  error: {
    label: 'Vi phạm',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  warning: {
    label: 'Cảnh báo',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  info: {
    label: 'Lưu ý',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-400',
  },
}

export const CATEGORY_LABELS: Record<ViolationCategory, string> = {
  khoang_lui: 'Khoảng lùi',
  mat_do:     'Mật độ xây dựng',
  far:        'Hệ số sử dụng đất',
  chieu_cao:  'Chiều cao công trình',
  pccc:       'PCCC & Thoát nạn',
  thong_gio:  'Thông gió & Chiếu sáng',
  khac:       'Khác',
}

export const STATUS_CONFIG: Record<CheckStatus, { label: string; color: string }> = {
  pending:   { label: 'Chờ phân tích', color: 'bg-stone-100 text-stone-600' },
  analyzing: { label: 'Đang phân tích', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
  error:     { label: 'Lỗi', color: 'bg-red-100 text-red-700' },
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

export function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100'
  if (score >= 60) return 'bg-amber-100'
  return 'bg-red-100'
}
