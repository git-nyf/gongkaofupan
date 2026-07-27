import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const reviewImageMaximumBytes = 10 * 1024 * 1024;
export const reviewImageMaximumCount = 12;

const manifestVersion = 3 as const;
const manifestFileName = 'manifest.json';
const migrationJournalFileName = '.migration-v3.json';
const migrationJournalVersion = 1 as const;
const maximumNameLength = 20;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legacyStoredNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp)$/i;

const extensionByMimeType = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
} as const;

const defaultBoardDefinitions = [
  { name: '资料', sections: ['综合'] },
  { name: '言语', sections: ['中心理解', '后文推断', '逻辑填空'] },
  { name: '判断', sections: ['综合'] },
] as const;

export type ReviewImageMimeType = keyof typeof extensionByMimeType;

export interface ReviewSection {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
}

export interface ReviewBoard {
  id: string;
  name: string;
  hidden: boolean;
  createdAt: string;
  sections: ReviewSection[];
}

export interface ReviewImageItem {
  id: string;
  url: string;
  originalName: string;
  mimeType: ReviewImageMimeType;
  byteSize: number;
  createdAt: string;
  sectionId: string;
}

export interface ReviewImageUpload {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ReviewImageFile {
  content: Buffer;
  mimeType: ReviewImageMimeType;
}

export interface ReviewImageCatalog {
  items: ReviewImageItem[];
  boards: ReviewBoard[];
}

export interface ReviewImageService {
  list(): Promise<ReviewImageCatalog>;
  add(files: ReviewImageUpload[], sectionId: string): Promise<ReviewImageItem[]>;
  delete(id: string): Promise<void>;
  read(id: string): Promise<ReviewImageFile | undefined>;
  createBoard(name: string): Promise<ReviewBoard>;
  setBoardOrder(ids: string[]): Promise<ReviewBoard[]>;
  setBoardHidden(id: string, hidden: boolean): Promise<ReviewBoard>;
  createSection(boardId: string, name: string): Promise<ReviewSection>;
  setSectionOrder(boardId: string, ids: string[]): Promise<ReviewBoard>;
  setSectionHidden(id: string, hidden: boolean): Promise<ReviewSection>;
}

export class ReviewImageServiceError extends Error {
  constructor(readonly code: 'invalid_request' | 'not_found' | 'conflict') {
    super(code);
  }
}

interface StoredReviewImage {
  id: string;
  storedName: string;
  originalName: string;
  mimeType: ReviewImageMimeType;
  byteSize: number;
  createdAt: string;
  sectionId: string;
}

interface LegacyStoredReviewImage extends Omit<StoredReviewImage, 'sectionId'> {}

interface ReviewImageStore {
  boards: ReviewBoard[];
  items: StoredReviewImage[];
}

interface ReviewImageManifest extends ReviewImageStore {
  version: typeof manifestVersion;
}

interface ReviewImageV2Manifest extends ReviewImageStore {
  version: 2;
}

interface ReviewImageMigrationJournalItem {
  id: string;
  sourceStoredName: string;
  targetStoredName: string;
  byteSize: number;
  mimeType: ReviewImageMimeType;
  sha256: string;
}

interface ReviewImageMigrationJournal {
  version: typeof migrationJournalVersion;
  items: ReviewImageMigrationJournalItem[];
}

interface ReviewImageServiceOptions {
  directory: string;
  now?: () => Date;
  createId?: () => string;
}

interface SharedReviewImageState {
  loadPromise?: Promise<ReviewImageStore>;
  mutationTail: Promise<void>;
}

const sharedStates = new Map<string, SharedReviewImageState>();

export function createReviewImageService({
  directory,
  now = () => new Date(),
  createId = randomUUID,
}: ReviewImageServiceOptions): ReviewImageService {
  const root = path.resolve(directory);
  const manifestPath = path.join(root, manifestFileName);
  const shared = sharedStates.get(root) ?? { mutationTail: Promise.resolve() };
  sharedStates.set(root, shared);

  function loadStore() {
    if (!shared.loadPromise) {
      shared.loadPromise = readStore({ root, manifestPath, now, createId }).catch((error) => {
        shared.loadPromise = undefined;
        throw error;
      });
    }
    return shared.loadPromise;
  }

  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const current = shared.mutationTail.then(operation, operation);
    shared.mutationTail = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }

  async function persist(next: ReviewImageStore) {
    await writeManifestAtomically(root, manifestPath, next, createId);
    shared.loadPromise = Promise.resolve(next);
  }

  return {
    async list() {
      await shared.mutationTail;
      const store = await loadStore();
      return {
        items: store.items.map(toPublicItem),
        boards: cloneBoards(store.boards),
      };
    },

    add(files, sectionId) {
      return mutate(async () => {
        if (
          !isReviewImageId(sectionId) ||
          files.length === 0 ||
          files.length > reviewImageMaximumCount ||
          !files.every(isValidUpload)
        ) {
          throw new ReviewImageServiceError('invalid_request');
        }

        const current = await loadStore();
        const owner = current.boards.find((board) =>
          board.sections.some((section) => section.id === sectionId),
        );
        const section = owner?.sections.find((candidate) => candidate.id === sectionId);
        if (!owner || !section || owner.hidden || section.hidden) {
          throw new ReviewImageServiceError('invalid_request');
        }

        const createdAt = now().toISOString();
        const prepared = files.map((file) => {
          const mimeType = file.mimeType as ReviewImageMimeType;
          const id = createId();
          const storedName = createStoredName(owner, section, id, createdAt, mimeType);
          const item: StoredReviewImage = {
            id,
            storedName,
            originalName: file.originalName,
            mimeType,
            byteSize: file.buffer.byteLength,
            createdAt,
            sectionId,
          };
          return { item, buffer: file.buffer, filePath: safeFilePath(root, storedName) };
        });
        if (prepared.some(({ filePath }) => !filePath)) throw new Error('invalid generated image path');

        const writtenPaths: string[] = [];
        try {
          await mkdir(sectionDirectoryPath(root, owner, section), { recursive: true });
          for (const file of prepared) {
            await writeFile(file.filePath!, file.buffer, { flag: 'wx' });
            writtenPaths.push(file.filePath!);
          }
          const next = {
            boards: current.boards,
            items: [...current.items, ...prepared.map(({ item }) => item)],
          };
          await persist(next);
          return prepared.map(({ item }) => toPublicItem(item));
        } catch (error) {
          await Promise.all(writtenPaths.map((filePath) => rm(filePath, { force: true })));
          throw error;
        }
      });
    },

    delete(id) {
      return mutate(async () => {
        if (!isReviewImageId(id)) throw new ReviewImageServiceError('invalid_request');
        const current = await loadStore();
        const item = current.items.find((candidate) => candidate.id === id);
        if (!item) throw new ReviewImageServiceError('not_found');

        const filePath = safeFilePath(root, item.storedName);
        if (!filePath) throw new Error('invalid stored image path');
        const stagedPath = path.join(root, `.delete-${createId()}.tmp`);
        let staged = false;
        try {
          try {
            await rename(filePath, stagedPath);
            staged = true;
          } catch (error) {
            if (!isMissingFileError(error)) throw error;
          }
          await persist({
            boards: current.boards,
            items: current.items.filter((candidate) => candidate.id !== id),
          });
          if (staged) await rm(stagedPath, { force: true });
        } catch (error) {
          if (staged) {
            try {
              await rename(stagedPath, filePath);
            } catch (rollbackError) {
              throw new AggregateError(
                [error, rollbackError],
                `review image delete rollback failed; staged file preserved at ${stagedPath}`,
              );
            }
          }
          throw error;
        }
      });
    },

    async read(id) {
      await shared.mutationTail;
      if (!isReviewImageId(id)) throw new ReviewImageServiceError('invalid_request');
      const item = (await loadStore()).items.find((candidate) => candidate.id === id);
      if (!item) return undefined;
      const filePath = safeFilePath(root, item.storedName);
      if (!filePath) return undefined;
      try {
        return { content: await readFile(filePath), mimeType: item.mimeType };
      } catch (error) {
        if (isMissingFileError(error)) return undefined;
        throw error;
      }
    },

    createBoard(name) {
      return mutate(async () => {
        const normalized = normalizeName(name);
        if (!normalized) throw new ReviewImageServiceError('invalid_request');
        const current = await loadStore();
        if (current.boards.some((board) => board.name === normalized)) {
          throw new ReviewImageServiceError('conflict');
        }
        const board: ReviewBoard = {
          id: createId(),
          name: normalized,
          hidden: false,
          createdAt: now().toISOString(),
          sections: [],
        };
        await mkdir(boardDirectoryPath(root, board), { recursive: true });
        await persist({ boards: [...current.boards, board], items: current.items });
        return cloneBoard(board);
      });
    },

    setBoardOrder(ids) {
      return mutate(async () => {
        const current = await loadStore();
        const boards = reorderExact(current.boards, ids);
        if (!boards) throw new ReviewImageServiceError('invalid_request');
        await persist({ boards, items: current.items });
        return cloneBoards(boards);
      });
    },

    setBoardHidden(id, hidden) {
      return mutate(async () => {
        if (!isReviewImageId(id)) throw new ReviewImageServiceError('invalid_request');
        const current = await loadStore();
        const existing = current.boards.find((board) => board.id === id);
        if (!existing) throw new ReviewImageServiceError('not_found');
        const updated = { ...existing, hidden };
        await persist({
          boards: current.boards.map((board) => (board.id === id ? updated : board)),
          items: current.items,
        });
        return cloneBoard(updated);
      });
    },

    createSection(boardId, name) {
      return mutate(async () => {
        if (!isReviewImageId(boardId)) throw new ReviewImageServiceError('invalid_request');
        const normalized = normalizeName(name);
        if (!normalized) throw new ReviewImageServiceError('invalid_request');
        const current = await loadStore();
        const board = current.boards.find((candidate) => candidate.id === boardId);
        if (!board) throw new ReviewImageServiceError('not_found');
        if (board.sections.some((section) => section.name === normalized)) {
          throw new ReviewImageServiceError('conflict');
        }
        const section: ReviewSection = {
          id: createId(),
          name: normalized,
          hidden: false,
          createdAt: now().toISOString(),
        };
        const updated = { ...board, sections: [...board.sections, section] };
        await mkdir(sectionDirectoryPath(root, board, section), { recursive: true });
        await persist({
          boards: current.boards.map((candidate) =>
            candidate.id === boardId ? updated : candidate,
          ),
          items: current.items,
        });
        return { ...section };
      });
    },

    setSectionOrder(boardId, ids) {
      return mutate(async () => {
        if (!isReviewImageId(boardId)) throw new ReviewImageServiceError('invalid_request');
        const current = await loadStore();
        const board = current.boards.find((candidate) => candidate.id === boardId);
        if (!board) throw new ReviewImageServiceError('not_found');
        const sections = reorderExact(board.sections, ids);
        if (!sections) throw new ReviewImageServiceError('invalid_request');
        const updated = { ...board, sections };
        await persist({
          boards: current.boards.map((candidate) =>
            candidate.id === boardId ? updated : candidate,
          ),
          items: current.items,
        });
        return cloneBoard(updated);
      });
    },

    setSectionHidden(id, hidden) {
      return mutate(async () => {
        if (!isReviewImageId(id)) throw new ReviewImageServiceError('invalid_request');
        const current = await loadStore();
        const owner = current.boards.find((board) =>
          board.sections.some((section) => section.id === id),
        );
        const existing = owner?.sections.find((section) => section.id === id);
        if (!owner || !existing) throw new ReviewImageServiceError('not_found');
        const updated = { ...existing, hidden };
        await persist({
          boards: current.boards.map((board) =>
            board.id === owner.id
              ? {
                  ...board,
                  sections: board.sections.map((section) =>
                    section.id === id ? updated : section,
                  ),
                }
              : board,
          ),
          items: current.items,
        });
        return { ...updated };
      });
    },
  };
}

export function isReviewImageId(value: string) {
  return uuidPattern.test(value);
}

export function isReviewImageMimeType(value: string): value is ReviewImageMimeType {
  return Object.hasOwn(extensionByMimeType, value);
}

export function hasMatchingImageSignature(mimeType: string, buffer: Buffer) {
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

function isValidUpload(file: ReviewImageUpload) {
  return (
    typeof file.originalName === 'string' &&
    file.originalName.length > 0 &&
    isReviewImageMimeType(file.mimeType) &&
    Buffer.isBuffer(file.buffer) &&
    file.buffer.byteLength <= reviewImageMaximumBytes &&
    hasMatchingImageSignature(file.mimeType, file.buffer)
  );
}

async function readStore({
  root,
  manifestPath,
  now,
  createId,
}: {
  root: string;
  manifestPath: string;
  now: () => Date;
  createId: () => string;
}): Promise<ReviewImageStore> {
  await mkdir(root, { recursive: true });
  let content: string;
  try {
    content = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
    const store = createDefaultStore(now, createId);
    await ensureDirectoryLayout(root, store.boards);
    await writeManifestAtomically(root, manifestPath, store, createId);
    return store;
  }

  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('invalid review image manifest');
  }
  if (isV3Manifest(value)) {
    await ensureDirectoryLayout(root, value.boards);
    await rm(path.join(root, migrationJournalFileName), { force: true });
    return { boards: value.boards, items: value.items };
  }

  let store: ReviewImageStore;
  if (isV2Manifest(value)) {
    store = { boards: value.boards, items: value.items };
  } else if (isV1Manifest(value)) {
    store = createDefaultStore(now, createId);
    const uncategorizedBoard = createBoardDefinition(
      '其他',
      ['未分类'],
      now().toISOString(),
      createId,
    );
    store.boards.push(uncategorizedBoard);
    store.items = value.items.map((item) => ({
      ...item,
      sectionId: uncategorizedBoard.sections[0].id,
    }));
    // 移动文件前先固化分类 ID，使中断的 v1 迁移可沿确定的 v2 -> v3 路径续跑。
    await writeManifestAtomically(root, manifestPath, store, createId, 2);
  } else {
    throw new Error('invalid review image manifest');
  }

  return migrateStoreToV3(root, manifestPath, store, createId);
}

async function migrateStoreToV3(
  root: string,
  manifestPath: string,
  store: ReviewImageStore,
  createId: () => string,
) {
  await ensureDirectoryLayout(root, store.boards);
  const migratedItems = store.items.map((item) => {
    const ownership = findItemOwnership(store.boards, item.sectionId);
    if (!ownership) throw new Error('invalid review image ownership');
    return {
      ...item,
      storedName: createStoredName(
        ownership.board,
        ownership.section,
        item.id,
        item.createdAt,
        item.mimeType,
      ),
    };
  });

  const journal = await loadOrCreateMigrationJournal(
    root,
    store.items,
    migratedItems,
    createId,
  );

  for (let index = 0; index < store.items.length; index += 1) {
    const sourcePath = safeLegacyFilePath(root, store.items[index].storedName);
    const targetPath = safeFilePath(root, migratedItems[index].storedName);
    if (!sourcePath || !targetPath) throw new Error('invalid review image migration path');

    const [sourceExists, targetExists] = await Promise.all([
      fileExists(sourcePath),
      fileExists(targetPath),
    ]);
    const credential = journal.items[index];
    if (sourceExists && targetExists) {
      throw new Error('review image migration target already exists');
    }
    if (sourceExists) {
      await verifyMigrationFile(sourcePath, credential);
      await rename(sourcePath, targetPath);
      continue;
    }
    if (targetExists) {
      await verifyMigrationFile(targetPath, credential);
      continue;
    }
    throw new Error('review image migration source is missing');
  }

  const migratedStore = { boards: store.boards, items: migratedItems };
  await writeManifestAtomically(root, manifestPath, migratedStore, createId);
  await rm(path.join(root, migrationJournalFileName), { force: true });
  return migratedStore;
}

async function loadOrCreateMigrationJournal(
  root: string,
  sourceItems: StoredReviewImage[],
  targetItems: StoredReviewImage[],
  createId: () => string,
) {
  const journalPath = path.join(root, migrationJournalFileName);
  try {
    const value = JSON.parse(await readFile(journalPath, 'utf8')) as unknown;
    if (!isMigrationJournal(value, sourceItems, targetItems)) {
      throw new Error('invalid review image migration credential');
    }
    return value;
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }

  const items: ReviewImageMigrationJournalItem[] = [];
  for (let index = 0; index < sourceItems.length; index += 1) {
    const source = sourceItems[index];
    const target = targetItems[index];
    const sourcePath = safeLegacyFilePath(root, source.storedName);
    const targetPath = safeFilePath(root, target.storedName);
    if (!sourcePath || !targetPath) throw new Error('invalid review image migration path');
    const [sourceExists, targetExists] = await Promise.all([
      fileExists(sourcePath),
      fileExists(targetPath),
    ]);
    if (targetExists) throw new Error('review image migration target already exists without credential');
    if (!sourceExists) throw new Error('review image migration source is missing without credential');
    const content = await readFile(sourcePath);
    if (content.byteLength !== source.byteSize || !hasMatchingImageSignature(source.mimeType, content)) {
      throw new Error('review image migration source content is invalid');
    }
    items.push({
      id: source.id,
      sourceStoredName: source.storedName,
      targetStoredName: target.storedName,
      byteSize: source.byteSize,
      mimeType: source.mimeType,
      sha256: hashBuffer(content),
    });
  }

  const journal: ReviewImageMigrationJournal = {
    version: migrationJournalVersion,
    items,
  };
  await writeJsonAtomically(root, journalPath, journal, createId, '.migration');
  return journal;
}

function isMigrationJournal(
  value: unknown,
  sourceItems: StoredReviewImage[],
  targetItems: StoredReviewImage[],
): value is ReviewImageMigrationJournal {
  if (
    !isRecord(value) ||
    value.version !== migrationJournalVersion ||
    !Array.isArray(value.items) ||
    value.items.length !== sourceItems.length
  ) {
    return false;
  }
  return value.items.every((entry, index) => {
    const source = sourceItems[index];
    const target = targetItems[index];
    return (
      isRecord(entry) &&
      entry.id === source.id &&
      entry.sourceStoredName === source.storedName &&
      entry.targetStoredName === target.storedName &&
      entry.byteSize === source.byteSize &&
      entry.mimeType === source.mimeType &&
      typeof entry.sha256 === 'string' &&
      /^[0-9a-f]{64}$/i.test(entry.sha256)
    );
  });
}

async function verifyMigrationFile(
  filePath: string,
  credential: ReviewImageMigrationJournalItem,
) {
  const content = await readFile(filePath);
  if (
    content.byteLength !== credential.byteSize ||
    !hasMatchingImageSignature(credential.mimeType, content) ||
    hashBuffer(content) !== credential.sha256
  ) {
    throw new Error('review image migration hash mismatch');
  }
}

function hashBuffer(content: Buffer) {
  return createHash('sha256').update(content).digest('hex');
}

function createDefaultStore(now: () => Date, createId: () => string): ReviewImageStore {
  const createdAt = now().toISOString();
  return {
    boards: defaultBoardDefinitions.map(({ name, sections }) =>
      createBoardDefinition(name, [...sections], createdAt, createId),
    ),
    items: [],
  };
}

function createBoardDefinition(
  name: string,
  sectionNames: string[],
  createdAt: string,
  createId: () => string,
): ReviewBoard {
  return {
    id: createId(),
    name,
    hidden: false,
    createdAt,
    sections: sectionNames.map((sectionName) => ({
      id: createId(),
      name: sectionName,
      hidden: false,
      createdAt,
    })),
  };
}

function isV3Manifest(value: unknown): value is ReviewImageManifest {
  if (
    !isRecord(value) ||
    value.version !== manifestVersion ||
    !Array.isArray(value.boards) ||
    !Array.isArray(value.items)
  ) {
    return false;
  }
  if (!areValidBoards(value.boards)) return false;
  return areValidItems(value.items, value.boards, (item, board, section) =>
    item.storedName ===
    createStoredName(board, section, item.id, item.createdAt, item.mimeType),
  );
}

function isV2Manifest(value: unknown): value is ReviewImageV2Manifest {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !Array.isArray(value.boards) ||
    !Array.isArray(value.items)
  ) {
    return false;
  }
  if (!areValidBoards(value.boards)) return false;
  return areValidItems(value.items, value.boards, (item) =>
    legacyStoredNamePattern.test(item.storedName),
  );
}

function isV1Manifest(
  value: unknown,
): value is { version: 1; items: LegacyStoredReviewImage[] } {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.items) &&
    areValidLegacyItems(value.items)
  );
}

function areValidBoards(values: unknown[]): values is ReviewBoard[] {
  const allIds = new Set<string>();
  const boardNames = new Set<string>();
  for (const value of values) {
    if (!isReviewBoard(value) || allIds.has(value.id) || boardNames.has(value.name)) return false;
    allIds.add(value.id);
    boardNames.add(value.name);
    const sectionNames = new Set<string>();
    for (const section of value.sections) {
      if (allIds.has(section.id) || sectionNames.has(section.name)) return false;
      allIds.add(section.id);
      sectionNames.add(section.name);
    }
  }
  return true;
}

function isReviewBoard(value: unknown): value is ReviewBoard {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isReviewImageId(value.id) &&
    isStoredName(value.name) &&
    typeof value.hidden === 'boolean' &&
    isIsoDate(value.createdAt) &&
    Array.isArray(value.sections) &&
    value.sections.every(isReviewSection)
  );
}

function isReviewSection(value: unknown): value is ReviewSection {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isReviewImageId(value.id) &&
    isStoredName(value.name) &&
    typeof value.hidden === 'boolean' &&
    isIsoDate(value.createdAt)
  );
}

function areValidItems(
  values: unknown[],
  boards: ReviewBoard[],
  isValidStoredName: (
    item: StoredReviewImage,
    board: ReviewBoard,
    section: ReviewSection,
  ) => boolean,
): values is StoredReviewImage[] {
  const ids = new Set<string>();
  const storedNames = new Set<string>();
  for (const value of values) {
    if (!isStoredItem(value)) return false;
    const ownership = findItemOwnership(boards, value.sectionId);
    if (
      !ownership ||
      !isValidStoredName(value, ownership.board, ownership.section) ||
      ids.has(value.id) ||
      storedNames.has(value.storedName)
    ) {
      return false;
    }
    ids.add(value.id);
    storedNames.add(value.storedName);
  }
  return true;
}

function areValidLegacyItems(values: unknown[]): values is LegacyStoredReviewImage[] {
  const ids = new Set<string>();
  const storedNames = new Set<string>();
  for (const value of values) {
    if (
      !isLegacyStoredItem(value) ||
      ids.has(value.id) ||
      storedNames.has(value.storedName)
    ) {
      return false;
    }
    ids.add(value.id);
    storedNames.add(value.storedName);
  }
  return true;
}

function isStoredItem(value: unknown): value is StoredReviewImage {
  const sectionId = isRecord(value) ? value.sectionId : undefined;
  return (
    isStoredImageBase(value) &&
    typeof sectionId === 'string' &&
    isReviewImageId(sectionId)
  );
}

function isLegacyStoredItem(value: unknown): value is LegacyStoredReviewImage {
  return isStoredImageBase(value) && legacyStoredNamePattern.test(value.storedName);
}

function isStoredImageBase(value: unknown): value is LegacyStoredReviewImage {
  const mimeType = isRecord(value) ? value.mimeType : undefined;
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isReviewImageId(value.id) ||
    typeof value.storedName !== 'string' ||
    !hasSupportedStoredExtension(value.storedName) ||
    typeof value.originalName !== 'string' ||
    typeof mimeType !== 'string' ||
    !isReviewImageMimeType(mimeType) ||
    !Number.isInteger(value.byteSize) ||
    (value.byteSize as number) < 0 ||
    (value.byteSize as number) > reviewImageMaximumBytes ||
    !isIsoDate(value.createdAt)
  ) {
    return false;
  }
  return path.extname(value.storedName).toLowerCase() === extensionByMimeType[mimeType];
}

async function writeManifestAtomically(
  root: string,
  manifestPath: string,
  store: ReviewImageStore,
  createId: () => string,
  version: 2 | typeof manifestVersion = manifestVersion,
) {
  await writeJsonAtomically(
    root,
    manifestPath,
    { version, ...store },
    createId,
    '.manifest',
  );
}

async function writeJsonAtomically(
  root: string,
  targetPath: string,
  value: unknown,
  createId: () => string,
  prefix: string,
) {
  await mkdir(root, { recursive: true });
  const temporaryPath = path.join(root, `${prefix}-${createId()}.tmp`);
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      { flag: 'wx' },
    );
    await rename(temporaryPath, targetPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function toPublicItem(item: StoredReviewImage): ReviewImageItem {
  return {
    id: item.id,
    url: `/api/review-images/${item.id}/content`,
    originalName: item.originalName,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    createdAt: item.createdAt,
    sectionId: item.sectionId,
  };
}

function normalizeName(value: string) {
  const normalized = value.trim();
  return [...normalized].length >= 1 && [...normalized].length <= maximumNameLength
    ? normalized
    : undefined;
}

function isStoredName(value: unknown): value is string {
  return typeof value === 'string' && normalizeName(value) === value;
}

function reorderExact<T extends { id: string }>(items: T[], ids: string[]) {
  if (ids.length !== items.length || new Set(ids).size !== ids.length) return undefined;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const reordered: T[] = [];
  for (const id of ids) {
    const item = itemById.get(id);
    if (!item) return undefined;
    reordered.push(item);
  }
  return reordered;
}

function cloneBoards(boards: ReviewBoard[]) {
  return boards.map(cloneBoard);
}

function cloneBoard(board: ReviewBoard): ReviewBoard {
  return { ...board, sections: board.sections.map((section) => ({ ...section })) };
}

function createStoredName(
  board: ReviewBoard,
  section: ReviewSection,
  imageId: string,
  createdAt: string,
  mimeType: ReviewImageMimeType,
) {
  const boardName = sanitizePathSegment(board.name);
  const sectionName = sanitizePathSegment(section.name);
  const boardDirectory = `${boardName}--${board.id.slice(0, 8)}`;
  const sectionDirectory = `${sectionName}--${section.id.slice(0, 8)}`;
  const fileName = `${boardName}_${sectionName}_${formatShanghaiTimestamp(createdAt)}_${imageId}${extensionByMimeType[mimeType]}`;
  return [boardDirectory, sectionDirectory, fileName].join('/');
}

function sanitizePathSegment(value: string) {
  let sanitized = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '_');
  if (!sanitized || sanitized === '.' || sanitized === '..') sanitized = '_';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized;
}

function formatShanghaiTimestamp(value: string) {
  const date = new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}-${milliseconds}`;
}

function findItemOwnership(boards: ReviewBoard[], sectionId: string) {
  for (const board of boards) {
    const section = board.sections.find((candidate) => candidate.id === sectionId);
    if (section) return { board, section };
  }
  return undefined;
}

async function ensureDirectoryLayout(root: string, boards: ReviewBoard[]) {
  await mkdir(root, { recursive: true });
  for (const board of boards) {
    await mkdir(boardDirectoryPath(root, board), { recursive: true });
    for (const section of board.sections) {
      await mkdir(sectionDirectoryPath(root, board, section), { recursive: true });
    }
  }
}

function boardDirectoryPath(root: string, board: ReviewBoard) {
  const directory = resolveUnderRoot(root, [
    `${sanitizePathSegment(board.name)}--${board.id.slice(0, 8)}`,
  ]);
  if (!directory) throw new Error('invalid review board directory');
  return directory;
}

function sectionDirectoryPath(root: string, board: ReviewBoard, section: ReviewSection) {
  const directory = resolveUnderRoot(root, [
    `${sanitizePathSegment(board.name)}--${board.id.slice(0, 8)}`,
    `${sanitizePathSegment(section.name)}--${section.id.slice(0, 8)}`,
  ]);
  if (!directory) throw new Error('invalid review section directory');
  return directory;
}

function safeFilePath(root: string, storedName: string) {
  const segments = storedName.split(/[\\/]/);
  if (segments.length !== 3 || !hasSupportedStoredExtension(segments[2])) return undefined;
  return resolveUnderRoot(root, segments);
}

function safeLegacyFilePath(root: string, storedName: string) {
  if (!legacyStoredNamePattern.test(storedName)) return undefined;
  return resolveUnderRoot(root, [storedName]);
}

function resolveUnderRoot(root: string, segments: string[]) {
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || /[\\/]/.test(segment))) {
    return undefined;
  }
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return undefined;
  }
  return resolved;
}

function hasSupportedStoredExtension(storedName: string) {
  return /\.(?:png|jpg|webp)$/i.test(storedName);
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isMissingFileError(error: unknown) {
  return isRecord(error) && error.code === 'ENOENT';
}
