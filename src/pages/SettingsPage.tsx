import { StatusNotice } from '../components/StatusNotice';

export function SettingsPage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">设置</h1>
      </header>
      <StatusNotice state="empty" message="暂无本地设置" />
    </section>
  );
}
