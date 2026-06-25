import type { BuildingType } from './regulatory-types'
import {
  MAX_DENSITY,
  MAX_FAR,
  getSetbackRule,
  getMaxHeightForFloors,
} from './regulatory-regulations'

/**
 * Tính NGƯỢC chỉ tiêu quy hoạch: từ DIỆN TÍCH LÔ + LOẠI CÔNG TRÌNH → quy mô xây
 * dựng TỐI ĐA được phép theo QCVN 01:2021 (mật độ, hệ số sử dụng đất, tầng cao,
 * khoảng lùi). Tính thuần bằng công thức — không gọi AI, kết quả tức thì & ổn định.
 *
 * Lưu ý: đây là ƯỚC TÍNH ĐỊNH HƯỚNG để KTS sàng lọc nhanh; con số chính thức phải
 * tra theo quy hoạch chi tiết 1/500 của từng khu vực.
 */
export interface CapacityInput {
  landArea: number // m²
  buildingType: BuildingType
  /** Số tầng dự kiến (để suy khoảng lùi & chiều cao). Mặc định 1 nếu bỏ trống. */
  plannedFloors?: number
}

export interface CapacityResult {
  /** % mật độ xây dựng tối đa cho loại công trình. */
  maxDensityPct: number
  /** Diện tích xây dựng (footprint) tối đa = land × density. */
  maxBuildingArea: number
  /** Hệ số sử dụng đất tối đa (FAR). */
  maxFar: number
  /** Tổng diện tích sàn tối đa = land × FAR. */
  maxFloorArea: number
  /**
   * Số tầng tối đa ƯỚC TÍNH = floor(tổng sàn tối đa / footprint tối đa).
   * Giả định mỗi tầng xây kín tới mật độ cho phép.
   */
  maxFloorsEstimate: number
  /** Chiều cao tối đa tham khảo ứng với plannedFloors (hoặc maxFloorsEstimate). */
  maxHeight: number
  /** Khoảng lùi tối thiểu (m) theo số tầng dự kiến. */
  setback: { front: number; side: number; rear: number }
}

/** Làm tròn 2 chữ số, bỏ đuôi 0 thừa. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeCapacity(input: CapacityInput): CapacityResult {
  const land = Math.max(0, input.landArea || 0)
  const type = input.buildingType
  const maxDensityPct = MAX_DENSITY[type]
  const maxFar = MAX_FAR[type]

  const maxBuildingArea = round2((land * maxDensityPct) / 100)
  const maxFloorArea = round2(land * maxFar)

  // Số tầng tối đa ước tính: tổng sàn / footprint (cùng giả định mật độ tối đa).
  const maxFloorsEstimate =
    maxBuildingArea > 0 ? Math.max(1, Math.floor(maxFloorArea / maxBuildingArea)) : 0

  const floorsForRules =
    input.plannedFloors && input.plannedFloors > 0
      ? input.plannedFloors
      : maxFloorsEstimate || 1

  const rule = getSetbackRule(floorsForRules)

  return {
    maxDensityPct,
    maxBuildingArea,
    maxFar,
    maxFloorArea,
    maxFloorsEstimate,
    maxHeight: round2(getMaxHeightForFloors(floorsForRules)),
    setback: { front: rule.front_min, side: rule.side_min, rear: rule.rear_min },
  }
}
