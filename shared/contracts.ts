export type EntryMode = 'mistake' | 'knowledge';
export type AiStatus = 'processing' | 'ready' | 'pending' | 'needs_input';
export type Mastery = 'unseen' | 'again' | 'hard' | 'good';
export type QuizDirection = 'single' | 'forward' | 'reverse';
export type FocusMinutes = 5 | 15 | 25 | 45;

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

export interface CardFolderSummary {
  id: string;
  name: string;
  originalCount: number;
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CardFolderContents {
  folder: CardFolderSummary;
  cards: CardDetail[];
}

export type ShenlunReviewTemplate = 200 | 400 | 800 | 1000;
export type ShenlunReviewTextColor = 'red' | 'blue' | 'green';
export type ShenlunReviewMarkType = 'bold' | 'underline' | 'strike' | 'color';

export interface ShenlunReviewMark {
  id: string;
  type: ShenlunReviewMarkType;
  color?: ShenlunReviewTextColor;
  start: number;
  end: number;
}

export interface ShenlunReviewAnnotation {
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
  template: ShenlunReviewTemplate;
  text: string;
  marks: ShenlunReviewMark[];
  notes: string;
  standardAnswer: string;
  annotations: ShenlunReviewAnnotation[];
}

export interface ShenlunReviewSummary {
  id: string;
  title: string;
  template: ShenlunReviewTemplate;
  excerpt: string;
  characterCount: number;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShenlunReviewDetail extends ShenlunReviewWriteInput {
  id: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeMapSummary {
  id: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeMapNode {
  id: string;
  mapId: string;
  cardId: string | null;
  title: string;
  content: string;
  level: number;
  x: number;
  y: number;
  z: number;
  createdAt: string;
  updatedAt: string;
  card: CardDetail | null;
}

export interface KnowledgeMapEdge {
  id: string;
  mapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeMapDetail {
  map: KnowledgeMapSummary;
  nodes: KnowledgeMapNode[];
  edges: KnowledgeMapEdge[];
}

export interface KnowledgeMapCreateNodeInput {
  cardId?: string | null;
  title?: string;
  content?: string;
  level?: number;
  x: number;
  y: number;
  z: number;
}

export interface KnowledgeMapUpdateNodeInput {
  title?: string;
  content?: string;
  level?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface CardSearchInput {
  contentVersion: 'optimized' | 'original';
  query: string;
  categoryIds: string[];
  tagIds: string[];
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
  archived?: boolean;
  quizItems?: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

export interface OriginalCardRewriteInput {
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
}

export interface OriginalCardRewriteResult {
  card: CardDetail;
  derivedCount: number;
}

export interface BulkCardUpdateInput {
  tags?: string[];
  archived?: boolean;
  position?: 'top' | 'bottom';
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
  rawInput: string;
  normalizedStatement: string;
  analysis: string;
  mnemonic: string;
  extension: string;
  notes: string;
  wrongCount: number;
  archived: boolean;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  tags: Array<{ id: string; name: string; origin: 'user' | 'ai' }>;
}

export interface StudySessionInput {
  categoryIds: string[];
  cardIds: string[];
  tagIds: string[];
  createdFrom?: string;
  createdTo?: string;
  count: number;
  order: 'fixed' | 'random';
  dueFirst: boolean;
}

export interface StudySessionResult {
  items: StudyItem[];
  totalAvailable: number;
}

export interface ReviewInput {
  quizItemId: string;
  result: 'unknown' | 'known';
}

export interface ReviewResult {
  quizItemId: string;
  cardId: string;
  result: 'unknown' | 'known';
  nextDueAt: string;
  wrongCount: number;
}

export interface DashboardSummary {
  dueToday: number;
  addedToday: number;
  conquestPending: number;
  weakness: Array<{
    categoryId: string;
    categoryName: string;
    score: number;
    cardCount: number;
  }>;
}

export interface AppSettings {
  defaultSessionSize: number;
  defaultOrder: 'fixed' | 'random';
  dueFirst: boolean;
  defaultFocusMinutes: FocusMinutes;
  qqMusicPath: string;
  qqMusicAvailable: boolean;
  deepseekConfigured: boolean;
}

export type CoachMode = 'auto' | 'logic' | 'data' | 'quantity' | 'verbal';
export type CoachModule = Exclude<CoachMode, 'auto'>;
export type CoachTeacher = 'huasheng13' | 'zhang_gong';
export type CoachCapabilityState = 'ready' | 'not_configured' | 'unavailable';

export interface CoachStatus {
  deepseek: CoachCapabilityState;
  huasheng: CoachCapabilityState;
  zhangGong: CoachCapabilityState;
  webSearch: CoachCapabilityState;
}

export interface CoachConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachMessageInput {
  mode: CoachMode;
  messages: CoachConversationMessage[];
  cardId?: string;
  includeWebSearch: boolean;
}

export interface CoachMethodReference<TSource extends CoachTeacher = CoachTeacher> {
  id: string;
  name: string;
  source: TSource;
  summary: string;
}

export interface CoachWebSource {
  title: string;
  url: string;
  domain: string;
  summary: string;
}

interface CoachResponseFields<TSource extends CoachTeacher> {
  questionType: string;
  answer: string;
  steps: string[];
  conclusion: string;
  pitfalls: string[];
  followUps: string[];
  trainingPlan: string[];
  methodReferences: CoachMethodReference<TSource>[];
  sources: CoachWebSource[];
  webSearchStatus: 'ready' | 'disabled' | 'failed' | 'empty';
}

export type CoachResponse =
  | (CoachResponseFields<'huasheng13'> & {
      resolvedModule: 'logic' | 'data' | 'quantity';
      teacher: 'huasheng13';
    })
  | (CoachResponseFields<'zhang_gong'> & {
      resolvedModule: 'verbal';
      teacher: 'zhang_gong';
    });
