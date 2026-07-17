import { StatusNotice } from '../components/StatusNotice';

export function DashboardPage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">总览</h1>
      </header>
      <StatusNotice state="empty" message="暂无学习概览" />
    </section>
  );
}
