export type ProjectStatus = 'pending' | 'in_progress' | 'completed'

export interface BriefingProject {
  id: string
  architect_id?: string | null
  client_name: string
  client_email?: string | null
  project_name: string
  client_token: string
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface FamilyMember {
  role: 'adult' | 'child' | 'elder'
  age_range: string
}

export interface SelectedImage {
  id: string
  url: string
  tags: string[]
  style: string
  dwell_time_ms: number
}

export interface LifestyleHabits {
  cooking: boolean
  wfh: boolean
  pets: boolean
  exercise: boolean
  guests_frequent: boolean
  gardening: boolean
}

export type BudgetRange = 'under_500m' | '500m_1b' | '1b_2b' | 'over_2b'

export interface QuizSession {
  id: string
  project_id: string
  selected_images: SelectedImage[]
  style_scores: Record<string, number>
  family_size: number
  family_members: FamilyMember[]
  lifestyle_habits: LifestyleHabits
  budget_range: BudgetRange
  free_text_notes: string
  started_at: string
  completed_at?: string
}

export interface DesignConstraint {
  type: 'accessibility' | 'safety' | 'functional' | 'spatial' | 'budget'
  note: string
  triggered_by: string
}

export interface SpaceRequirement {
  room: string
  note: string
  priority: 'must_have' | 'nice_to_have'
}

export interface DesignBrief {
  id: string
  project_id: string
  dominant_style: string
  style_breakdown: Record<string, number>
  color_palette: string[]
  material_preferences: string[]
  lighting_preference: string
  design_constraints: DesignConstraint[]
  space_requirements: SpaceRequirement[]
  ai_summary: string
  kts_notes?: string
  generated_at: string
  gemini_model: string
}

export interface QuizImage {
  id: string
  url: string
  alt: string
  style: string
  tags: string[]
}

export interface QuizPair {
  id: string
  question: string
  imageA: QuizImage
  imageB: QuizImage
}
