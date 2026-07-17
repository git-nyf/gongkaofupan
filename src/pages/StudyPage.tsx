import { StatusNotice } from '../components/StatusNotice';

export function StudyPage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">背诵</h1>
      </header>
      <StatusNotice state="empty" message="暂无背诵卡组" />
    </section>
  );
}
