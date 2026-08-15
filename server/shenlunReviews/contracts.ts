export type ShenlunTemplate = 200 | 400 | 800 | 1000;

export interface ShenlunMark {
  id: string;
  type: 'bold' | 'underline' | 'strike' | 'color';
  color?: 'red' | 'blue' | 'green';
  start: number;
  end: number;
}

export interface ShenlunAnnotation {
  id: string;
  start: number;
  end: number;
  quote: string;
  body: string;
  createdAt: string;
  detached: boolean;
}

export interface ShenlunReviewWriteInput {
  title: string;
  template: ShenlunTemplate;
  text: string;
  marks: ShenlunMark[];
  notes: string;
  standardAnswer: string;
  annotations: ShenlunAnnotation[];
}

export interface ShenlunReview extends ShenlunReviewWriteInput {
  id: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShenlunReviewSummary {
  id: string;
  title: string;
  template: ShenlunTemplate;
  excerpt: string;
  characterCount: number;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShenlunReviewStateUpdate {
  pinned?: boolean;
  archived?: boolean;
}
