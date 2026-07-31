import { useState, type DragEvent, type FormEvent } from 'react';
import { Eye, Folder, FolderMinus, LoaderCircle, LocateFixed, Plus, Trash2 } from 'lucide-react';
import type { CardDetail, CardFolderSummary } from '../../shared/contracts';
import { RichTextPreview } from './RichTextPreview';

export const CARD_GROUP_DRAG_TYPE = 'application/x-gongkao-card-group-ids';

export interface CardFolderCardGroup {
  card: CardDetail;
  cards: CardDetail[];
}

interface CardFolderShelfProps {
  actionError: string;
  actionName: string;
  activeFolderId?: string;
  activeGroups: CardFolderCardGroup[];
  contentError: string;
  contentState: 'loading' | 'ready' | 'error';
  folders: CardFolderSummary[];
  listError: string;
  listState: 'loading' | 'ready' | 'error';
  onAddCards: (folderId: string, cardIds: string[]) => void;
  onCreate: (name: string) => Promise<boolean>;
  onDelete: (folder: CardFolderSummary) => void;
  onDetail: (group: CardFolderCardGroup, trigger: HTMLButtonElement) => void;
  onLocate: (group: CardFolderCardGroup) => void;
  onRemoveCards: (folderId: string, cardIds: string[]) => void;
  onToggle: (folderId: string) => void;
}

export function CardFolderShelf({
  actionError,
  actionName,
  activeFolderId,
  activeGroups,
  contentError,
  contentState,
  folders,
  listError,
  listState,
  onAddCards,
  onCreate,
  onDelete,
  onDetail,
  onLocate,
  onRemoveCards,
  onToggle,
}: CardFolderShelfProps) {
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string>();
  const activeFolder = folders.find(({ id }) => id === activeFolderId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();
    if (nextName.length < 1 || nextName.length > 40) {
      setValidationError('请输入 1-40 个字符的文件夹名称');
      return;
    }
    setValidationError('');
    if (await onCreate(nextName)) setName('');
  };

  const acceptDrop = (event: DragEvent<HTMLElement>, folderId: string) => {
    event.preventDefault();
    setDragOverFolderId(undefined);
    const cardIds = readDraggedCardIds(event.dataTransfer);
    if (cardIds.length > 0) onAddCards(folderId, cardIds);
  };

  return (
    <section aria-label="初始稿文件夹" className="cards-folder-shelf">
      <div className="cards-folder-shelf__header">
        <div>
          <h2>初始稿文件夹</h2>
          <span>{folders.length} 个文件夹</span>
        </div>
        <form className="cards-folder-create" onSubmit={(event) => void submit(event)}>
          <input
            aria-label="文件夹名称"
            disabled={actionName === 'create-folder'}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            placeholder="新文件夹名称"
            value={name}
          />
          <button
            aria-label="新建文件夹"
            className="cards-icon-button liquid-pressable"
            disabled={actionName === 'create-folder'}
            title="新建文件夹"
            type="submit"
          >
            {actionName === 'create-folder'
              ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} />
              : <Plus aria-hidden="true" size={17} />}
          </button>
        </form>
      </div>

      {validationError ? <div className="cards-folder-error" role="alert">{validationError}</div> : null}
      {actionError ? <div className="cards-folder-error" role="alert">{actionError}</div> : null}
      {listError ? <div className="cards-folder-error" role="alert">{listError}</div> : null}
      {listState === 'loading' ? <div className="cards-folder-loading" role="status">正在加载文件夹</div> : null}

      {folders.length > 0 ? (
        <div className="cards-folder-scroll">
          <ul aria-label="初始稿文件夹列表" className="cards-folder-list">
            {folders.map((folder) => {
              const expanded = activeFolderId === folder.id;
              return (
                <li
                  className={`cards-folder-tile liquid-glass liquid-glass--thin${dragOverFolderId === folder.id ? ' is-drag-over' : ''}`}
                  key={folder.id}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(undefined)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(event) => acceptDrop(event, folder.id)}
                >
                  <button
                    aria-expanded={expanded}
                    aria-label={(expanded ? '收起' : '打开') + folder.name}
                    className="cards-folder-tile__open liquid-pressable"
                    onClick={() => onToggle(folder.id)}
                    title={(expanded ? '收起' : '打开') + folder.name}
                    type="button"
                  >
                    <Folder aria-hidden="true" size={19} />
                    <span>
                      <strong>{folder.name}</strong>
                      <small>{folder.originalCount} 份初始稿</small>
                    </span>
                  </button>
                  <button
                    aria-label={'删除' + folder.name}
                    className="cards-folder-tile__delete liquid-pressable"
                    disabled={actionName === 'delete-folder:' + folder.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(folder);
                    }}
                    title={'删除' + folder.name}
                    type="button"
                  >
                    {actionName === 'delete-folder:' + folder.id
                      ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} />
                      : <Trash2 aria-hidden="true" size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : listState === 'ready' ? <p className="cards-folder-empty">暂无文件夹</p> : null}

      {activeFolder ? (
        <div className="cards-folder-contents">
          <div className="cards-folder-contents__heading">
            <h3>{activeFolder.name}</h3>
            {contentState === 'loading' ? <span role="status">正在加载文件夹内容</span> : null}
          </div>
          {contentError ? <div className="cards-folder-error" role="alert">{contentError}</div> : null}
          {contentState === 'ready' && activeGroups.length === 0
            ? <p className="cards-folder-empty">文件夹中暂无初始稿</p>
            : null}
          {activeGroups.length > 0 ? (
            <ul aria-label={activeFolder.name + '中的卡片'} className="cards-folder-preview-grid">
              {activeGroups.map((group) => {
                const card = group.card;
                const title = card.normalizedStatement || '待生成知识点';
                const content = card.rawInput || '未填写原始内容';
                return (
                  <li className="cards-card cards-folder-preview liquid-glass liquid-glass--regular" key={card.id}>
                    <div className="cards-card__preview">
                      <div className="cards-card__status">
                        <span>用户初始稿</span>
                        {group.cards.length > 1 ? <span className="cards-card__group-count">衍生 {group.cards.length} 个问题</span> : null}
                      </div>
                      <h4 className="cards-card__title" title={content}>
                        <RichTextPreview contentJson={card.rawContentJson} fallback={content} />
                      </h4>
                    </div>
                    <div className="cards-folder-preview__footer">
                      <a
                        aria-label={'定位' + title + '在卡片库中的原卡'}
                        className="cards-folder-preview__locate liquid-pressable"
                        href={'#card-library-' + card.id}
                        onClick={(event) => {
                          event.preventDefault();
                          onLocate(group);
                        }}
                        title="定位原卡"
                      >
                        <LocateFixed aria-hidden="true" size={16} />
                      </a>
                      <button
                        aria-label={'查看' + title + '详情'}
                        className="liquid-pressable"
                        onClick={(event) => onDetail(group, event.currentTarget)}
                        title="查看详情"
                        type="button"
                      >
                        <Eye aria-hidden="true" size={16} />
                      </button>
                      <button
                        aria-label={'从' + activeFolder.name + '移除' + title}
                        className="cards-folder-preview__remove liquid-pressable"
                        disabled={actionName === 'remove-folder-card:' + card.id}
                        onClick={() => onRemoveCards(activeFolder.id, group.cards.map(({ id }) => id))}
                        title="移出文件夹"
                        type="button"
                      >
                        {actionName === 'remove-folder-card:' + card.id
                          ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} />
                          : <FolderMinus aria-hidden="true" size={16} />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function readDraggedCardIds(dataTransfer: DataTransfer) {
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(CARD_GROUP_DRAG_TYPE));
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : [];
  } catch {
    return [];
  }
}
