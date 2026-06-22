import type { BuildingType, ZoningType } from './regulatory-types'

export interface SetbackRule {
  floors_min: number
  floors_max: number
  front_min: number
  side_min: number
  rear_min: number
}

export const SETBACK_RULES: SetbackRule[] = [
  { floors_min: 1, floors_max: 3,  front_min: 3.0, side_min: 1.5, rear_min: 2.0 },
  { floors_min: 4, floors_max: 9,  front_min: 4.5, side_min: 2.0, rear_min: 3.0 },
  { floors_min: 10, floors_max: 19, front_min: 6.0, side_min: 3.0, rear_min: 4.5 },
  { floors_min: 20, floors_max: 99, front_min: 9.0, side_min: 4.5, rear_min: 6.0 },
]

export function getSetbackRule(floors: number): SetbackRule {
  return SETBACK_RULES.find(r => floors >= r.floors_min && floors <= r.floors_max)
    ?? SETBACK_RULES[SETBACK_RULES.length - 1]
}

export const MAX_DENSITY: Record<BuildingType, number> = {
  nha_o_rieng_le: 90,
  nha_lien_ke:    90,
  biet_thu:       40,
  chung_cu:       60,
  van_phong:      70,
  thuong_mai:     80,
  cong_nghiep:    60,
}

export const MAX_FAR: Record<BuildingType, number> = {
  nha_o_rieng_le: 4.0,
  nha_lien_ke:    5.0,
  biet_thu:       2.0,
  chung_cu:       8.0,
  van_phong:      8.0,
  thuong_mai:     6.0,
  cong_nghiep:    2.5,
}

export function getMaxHeightForFloors(floors: number): number {
  return floors * 3.6 + 3.5
}

export const PCCC_RULES = {
  corridor_width_min: 1.2,
  stair_width_min: 1.2,
  max_distance_to_exit: 25,
  exit_door_width_min: 0.9,
}

export const LIGHTING_RULES = {
  window_ratio_min: 12.5,
}

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  nha_o_rieng_le: 'Nhà ở riêng lẻ',
  nha_lien_ke:    'Nhà liên kế (phố)',
  biet_thu:       'Biệt thự',
  chung_cu:       'Chung cư',
  van_phong:      'Văn phòng',
  thuong_mai:     'Thương mại / Dịch vụ',
  cong_nghiep:    'Công nghiệp',
}

export const ZONING_TYPE_LABELS: Record<ZoningType, string> = {
  dan_cu_hien_huu: 'Khu dân cư hiện hữu',
  dan_cu_moi:      'Khu dân cư mới quy hoạch',
  thuong_mai_dv:   'Thương mại - Dịch vụ',
  cong_nghiep:     'Khu công nghiệp',
  hanh_chinh:      'Hành chính - Công cộng',
}
