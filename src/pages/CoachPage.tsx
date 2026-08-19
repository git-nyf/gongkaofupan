import { SendHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type {
  CardDetail,
  CardSearchResult,
  CoachConversationMessage,
  CoachMessageInput,
  CoachMode,
  CoachResponse,
  CoachStatus,
} from '../../shared/contracts';
import { api } from '../api/client';
import '../styles/coach.css';

const modeOptions: Array<{ value: CoachMode; label: string }> = [
  { value: 'auto', label: '自动识别' },
  { value: 'logic', label: '判断推理' },
  { value: 'data', label: '资料分析' },
  { value: 'quantity', label: '数量关系' },
  { value: 'verbal', label: '言语理解' },
];

const statusLabels: Record<CoachStatus[keyof CoachStatus], string> = {
  ready: '可用',
  not_configured: '未配置',
  unavailable: '暂不可用',
};

const statusNames: Array<{ key: keyof CoachStatus; label: string }> = [
  { key: 'deepseek', label: 'DeepSeek' },
  { key: 'huasheng', label: '花生十三' },
  { key: 'zhangGong', label: '张弓言语' },
  { key: 'webSearch', label: '联网搜索' },
];

type ChatMessage = CoachConversationMessage;

export function CoachPage() {
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [mode, setMode] = useState<CoachMode>('auto');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [response, setResponse] = useState<CoachResponse | null>(null);
  const [requestState, setRequestState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [requestMessage, setRequestMessage] = useState('');
  const [includeWebSearch, setIncludeWebSearch] = useState(false);
  const [cardQuery, setCardQuery] = useState('');
  const [cardResults, setCardResults] = useState<CardDetail[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api<CoachStatus>('/api/coach/status', { signal: controller.signal })
      .then(setStatus)
      .catch((error: unknown) => {
        if (!isAbortError(error)) setStatus({ deepseek: 'unavailable', huasheng: 'unavailable', zhangGong: 'unavailable', webSearch: 'unavailable' });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const query = cardQuery.trim();
    if (!query) {
      setCardResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const queryString = new URLSearchParams({
        contentVersion: 'original',
        archived: 'false',
        page: '1',
        pageSize: '8',
        query,
      }).toString();
      api<CardSearchResult>(
        `/api/cards?${queryString}`,
        { signal: controller.signal },
      ).then((result) => setCardResults(result.items)).catch(() => setCardResults([]));
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cardQuery]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || requestState !== 'sending') return;
      controllerRef.current?.abort();
      controllerRef.current = null;
      setRequestState('idle');
      setRequestMessage('已中止本次请求，草稿和对话仍保留');
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [requestState]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const send = async () => {
    const content = draft.trim();
    if (!content || requestState === 'sending') return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setResponse(null);
    setRequestMessage('');
    setRequestState('sending');
    const controller = new AbortController();
    controllerRef.current = controller;
    const payload: CoachMessageInput = {
      mode,
      messages: nextMessages,
      ...(selectedCard ? { cardId: selectedCard.id } : {}),
      includeWebSearch,
    };
    try {
      const result = await api<CoachResponse>('/api/coach/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      setResponse(result);
      setMessages((current) => [...current, { role: 'assistant', content: result.answer }]);
      setDraft('');
      setRequestState('idle');
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        setRequestState('error');
        setRequestMessage('本轮回答失败，请检查能力状态后重试');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setRequestState((current) => current === 'sending' && controller.signal.aborted ? 'idle' : current);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter'
      && event.ctrlKey
      && !composingRef.current
      && !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <main className="coach-page">
      <header className="coach-page__header">
        <div>
          <p className="coach-page__eyebrow">专项训练</p>
          <h1>AI 公考教练</h1>
        </div>
        <section aria-label="能力状态" className="coach-status liquid-glass liquid-glass--thin">
          {statusNames.map(({ key, label }) => {
            const state = status?.[key] ?? 'unavailable';
            return <div className="coach-status__item" key={key} data-state={state}><span>{label}</span><strong>{status ? statusLabels[state] : '加载中'}</strong></div>;
          })}
        </section>
      </header>

      <div className="coach-layout">
        <section aria-label="教练对话" className="coach-conversation liquid-glass liquid-glass--regular">
          <div className="coach-conversation__toolbar">
            <div aria-label="题型模式" className="coach-mode" role="radiogroup">
              {modeOptions.map((option) => (
                <label className="coach-mode__option" key={option.value}>
                  <input checked={mode === option.value} name="coach-mode" onChange={() => setMode(option.value)} type="radio" value={option.value} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <label className="coach-search">
              <span>关联卡片</span>
              <input aria-label="搜索关联卡片" onChange={(event) => setCardQuery(event.target.value)} placeholder="输入关键词模糊搜索" type="search" value={cardQuery} />
            </label>
          </div>

          {cardResults.length > 0 && !selectedCard ? (
            <ul aria-label="卡片搜索结果" className="coach-card-results" role="listbox">
              {cardResults.map((cardItem) => <li key={cardItem.id}><button onClick={() => { setSelectedCard(cardItem); setCardResults([]); }} role="option" type="button">{cardItem.rawInput.slice(0, 80)}</button></li>)}
            </ul>
          ) : null}
          {selectedCard ? <div className="coach-card-chip"><span>已关联：{selectedCard.rawInput}</span><small>{selectedCard.categories.map(({ name }) => name).join(' · ')}{selectedCard.tags.length ? ` · ${selectedCard.tags.map(({ name }) => name).join('、')}` : ''}</small><button aria-label="移除关联卡片" onClick={() => setSelectedCard(null)} title="移除关联卡片" type="button"><X aria-hidden="true" size={16} /></button></div> : null}

          <div aria-live="polite" className="coach-chat" role="log">
            {messages.length === 0 ? <div className="coach-chat__empty"><span>等待题目</span></div> : messages.map((message, index) => <div className={`coach-message coach-message--${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'user' ? '你' : '教练'}</span><p>{message.content}</p></div>)}
          </div>

          <div className="coach-composer">
            <textarea aria-label="输入题目或追问" disabled={requestState === 'sending'} onChange={(event) => setDraft(event.target.value)} onCompositionEnd={() => { composingRef.current = false; }} onCompositionStart={() => { composingRef.current = true; }} onKeyDown={handleInputKeyDown} placeholder="粘贴题目，或继续追问…" rows={5} value={draft} />
            <div className="coach-composer__footer">
              <label className="coach-search-toggle"><input aria-label="联网搜索" checked={includeWebSearch} onChange={(event) => setIncludeWebSearch(event.target.checked)} type="checkbox" />联网搜索</label>
              <span>{draft.length} / 10000</span>
              <button aria-label={requestState === 'sending' ? '正在发送' : '发送'} className="coach-send" disabled={requestState === 'sending' || !draft.trim()} onClick={() => void send()} type="button"><SendHorizontal aria-hidden="true" size={16} />{requestState === 'sending' ? '正在发送' : '发送'}</button>
            </div>
            {requestMessage ? <p className="coach-feedback" role="status">{requestMessage}</p> : null}
          </div>
        </section>

        <aside aria-label="训练辅助" className="coach-assist liquid-glass liquid-glass--thin">
          <h2>训练辅助</h2>
          {response ? <ResponseSummary response={response} /> : <div className="coach-assist__empty">答复后的方法、易错点和训练计划会显示在这里。</div>}
        </aside>
      </div>
    </main>
  );
}

function ResponseSummary({ response }: { response: CoachResponse }) {
  return <div className="coach-response">
    <section><span className="coach-response__label">当前老师 · 识别题型</span><strong>{response.teacher === 'huasheng13' ? '花生十三' : '张弓言语'} · {response.questionType}</strong></section>
    <section><span className="coach-response__label">结论</span><p>{response.conclusion}</p></section>
    <section><span className="coach-response__label">解题步骤</span><ol>{response.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
    <section><span className="coach-response__label">易错点</span><ul>{response.pitfalls.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section><span className="coach-response__label">训练计划</span><ul>{response.trainingPlan.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section><span className="coach-response__label">AI 原创练习</span>{response.followUps.length ? <ul>{response.followUps.map((item) => <li key={item}>{item}</li>)}</ul> : <p>暂无原创练习</p>}</section>
    <section><span className="coach-response__label">方法来源</span>{response.methodReferences.length ? <ul>{response.methodReferences.map((method) => <li key={method.id}><strong>{method.name}</strong><span>{method.summary}</span></li>)}</ul> : <p>暂无方法卡</p>}</section>
    <section><span className="coach-response__label">联网来源</span>{response.webSearchStatus === 'disabled' ? <p>本轮未启用联网搜索</p> : response.webSearchStatus === 'failed' ? <p>联网搜索失败，本轮回答未受影响</p> : response.sources.length ? <ul>{response.sources.map((source) => <li key={source.url}><a href={source.url} rel="noreferrer" target="_blank">{source.title} · {source.domain}</a><span>{source.summary}</span></li>)}</ul> : <p>暂无外部来源</p>}</section>
  </div>;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
