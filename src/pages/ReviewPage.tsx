import { StatusNotice } from '../components/StatusNotice';

export function ReviewPage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">复盘</h1>
      </header>
      <StatusNotice state="empty" message="暂无复盘数据" />
    </section>
  );
}
