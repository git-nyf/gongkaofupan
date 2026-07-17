export type EntryMode = 'mistake' | 'knowledge';
export type AiStatus = 'processing' | 'ready' | 'pending' | 'needs_input';
export type Mastery = 'unseen' | 'again' | 'hard' | 'good';
export type QuizDirection = 'single' | 'forward' | 'reverse';

export interface NormalizeCardInput {
  entry_mode: EntryMode;
  raw_input: string;
  selected_categories: string[];
  template: string;
  existing_fields: {
    wrong_point: string;
    analysis: string;
    mnemonic: string;
    extension: string;
    notes: string;
  };
}

export interface NormalizedQuizItem {
  direction: QuizDirection;
  question: string;
  answer: string;
}

export interface NormalizedCard {
  normalized_statement: string;
  question_type: 'single' | 'bidirectional' | 'unstructured';
  wrong_point: string;
  analysis: string;
  mnemonic: string;
  extension: string;
  notes: string;
  tags: string[];
  quiz_items: NormalizedQuizItem[];
}

export interface AttachmentInput {
  id: string;
  storedName: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
}

export interface CreateCardInput {
  entryMode: EntryMode;
  rawInput: string;
  rawContentJson: string | null;
  wrongPoint: string;
  analysis: string;
  mnemonic: string;
  extension: string;
  notes: string;
  categoryIds: string[];
  userTags: string[];
  template: string;
  sourceType: string;
  sourceDetail: string;
  rating: 1 | 2 | 3 | 4 | 5;
  initialMastery: Mastery;
  attachments: AttachmentInput[];
}

export interface CardDetail {
  id: string;
  entryMode: EntryMode;
  rawInput: string;
  rawContentJson: string | null;
  template: string;
  normalizedStatement: string;
  wrongPoint: string;
  analysis: string;
  mnemonic: string;
  extension: string;
  notes: string;
  aiStatus: AiStatus;
  sourceType: string;
  sourceDetail: string;
  rating: number;
  mastery: Mastery;
  wrongCount: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  tags: Array<{ id: string; name: string; origin: 'user' | 'ai' }>;
  attachments: Array<{
    id: string;
    url: string;
    originalName: string;
    mimeType: string;
    byteSize: number;
  }>;
  quizItems: Array<{
    id: string;
    direction: QuizDirection;
    question: string;
    answer: string;
    dueAt: string;
  }>;
}

export interface CardSearchInput {
  query: string;
  categoryIds: string[];
  tagIds: string[];
  rating?: 1 | 2 | 3 | 4 | 5;
  mastery?: Mastery;
  aiStatus?: AiStatus;
  archived: boolean;
  createdFrom?: string;
  createdTo?: string;
  page: number;
  pageSize: number;
}

export interface CardSearchResult {
  items: CardDetail[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CardUpdateInput {
  rawInput?: string;
  rawContentJson?: string | null;
  normalizedStatement?: string;
  wrongPoint?: string;
  analysis?: string;
  mnemonic?: string;
  extension?: string;
  notes?: string;
  categoryIds?: string[];
  userTags?: string[];
  template?: string;
  sourceType?: string;
  sourceDetail?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  mastery?: Mastery;
  archived?: boolean;
}

export interface BulkCardUpdateInput {
  rating?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  archived?: boolean;
}

export interface QuizItemSchedulingState {
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReviewAt: string | null;
}

export interface StudyItem {
  quizItemId: string;
  cardId: string;
  question: string;
  answer: string;
  normalizedStatement: string;
  analysis: string;
  mnemonic: string;
  extension: string;
  notes: string;
  rating: number;
  mastery: Mastery;
  archived: boolean;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  tags: Array<{ id: string; name: string; origin: 'user' | 'ai' }>;
}

export interface StudySessionInput {
  categoryIds: string[];
  cardIds: string[];
  tagIds: string[];
  rating?: 1 | 2 | 3 | 4 | 5;
  mastery?: Mastery;
  createdFrom?: string;
  createdTo?: string;
  count: number;
  order: 'fixed' | 'random';
  dueFirst: boolean;
}

export interface StudySessionResult {
  items: StudyItem[];
}

export interface ReviewInput {
  quizItemId: string;
  rating: 'again' | 'hard' | 'good';
}

export interface ReviewResult {
  quizItemId: string;
  cardId: string;
  rating: 'again' | 'hard' | 'good';
  nextDueAt: string;
  quizMastery: Mastery;
  cardMastery: Mastery;
  wrongCount: number;
}
