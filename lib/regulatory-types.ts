export type BuildingType =
  | 'nha_o_rieng_le'
  | 'nha_lien_ke'
  | 'biet_thu'
  | 'chung_cu'
  | 'van_phong'
  | 'thuong_mai'
  | 'cong_nghiep'

export type ZoningType =
  | 'dan_cu_hien_huu'
  | 'dan_cu_moi'
  | 'thuong_mai_dv'
  | 'cong_nghiep'
  | 'hanh_chinh'

export type CheckStatus = 'pending' | 'analyzing' | 'completed' | 'error'
export type ViolationSeverity = 'error' | 'warning' | 'info'
export type ViolationCategory =
  | 'khoang_lui'
  | 'mat_do'
  | 'far'
  | 'chieu_cao'
  | 'pccc'
  | 'thong_gio'
  | 'khac'

export interface RegCheck {
  id: string
  project_name: string
  project_address: string
  building_type: BuildingType
  zoning_type: ZoningType
  land_area: number
  land_width: number
  land_depth: number
  floors: number
  total_height: number
  building_area: number
  total_floor_area: number
  setback_front: number
  setback_rear: number
  setback_left: number
  setback_right: number
  corridor_width: number
  window_ratio: number
  extra_notes: string
  floorplan_image_url?: string
  status: CheckStatus
  created_at: string
  updated_at: string
}

export interface Violation {
  category: ViolationCategory
  severity: ViolationSeverity
  title: string
  description: string
  standard_ref: string
  current_value?: string
  required_value?: string
  recommendation: string
}

export interface RegReport {
  id: string
  check_id: string
  overall_score: number
  compliance_summary: string
  violations: Violation[]
  passed_checks: string[]
  kts_notes?: string
  generated_at: string
  gemini_model: string
}

export interface CheckFormData {
  project_name: string
  project_address: string
  building_type: BuildingType
  zoning_type: ZoningType
  land_area: number
  land_width: number
  land_depth: number
  floors: number
  total_height: number
  building_area: number
  total_floor_area: number
  setback_front: number
  setback_rear: number
  setback_left: number
  setback_right: number
  corridor_width: number
  window_ratio: number
  extra_notes: string
  floorplan_image?: File | null
}
