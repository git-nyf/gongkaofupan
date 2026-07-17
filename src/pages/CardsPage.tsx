import { StatusNotice } from '../components/StatusNotice';

export function CardsPage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">卡片库</h1>
      </header>
      <StatusNotice state="empty" message="暂无卡片" />
    </section>
  );
}
