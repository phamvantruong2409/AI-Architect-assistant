export interface Concept {
  id: string;
  name: string;
  tagline: string;
  description: string;
  style: string[];
  materials: string[];
  colorPalette: string[];
  references: string[];
  reasoning: string;
}

export interface ProjectBrief {
  type: string;
  landArea: string;
  floors: string;
  budget: string;
  styles: string[];
  description: string;
}
