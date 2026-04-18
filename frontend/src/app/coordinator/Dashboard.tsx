import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getUser } from '../../lib/api';

export function CoordinatorDashboard() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const user = getUser();

  useEffect(() => {
    let alive = true;
    api.analytics
      .dashboard()
      .then((m) => alive && setMetrics(m))
      .catch(() => {});
    api.tasks
      .list()
      .then((t) => alive && setTasks(t))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socket.emit('subscribe:tasks', { event_id: 'global' });
    socket.on('task_updated', () => {
      api.tasks.list().then(setTasks).catch(() => {});
      api.analytics.dashboard().then(setMetrics).catch(() => {});
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const open = useMemo(() => tasks.filter((t) => t.status === 'open').length, [tasks]);
  const inProgress = useMemo(() => tasks.filter((t) => t.status === 'in_progress').length, [tasks]);
  const completed = useMemo(() => tasks.filter((t) => t.status === 'completed').length, [tasks]);

  if (!user) return <div>Please log in.</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Coordinator Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Card title="Open tasks" value={String(open)} color="#F39C12" />
        <Card title="In progress" value={String(inProgress)} color="#1F497D" />
        <Card title="Completed" value={String(completed)} color="#16A085" />
        <Card title="Time saved (min)" value={metrics ? String(metrics.time_saved_minutes ?? 0) : '…'} color="#27AE60" />
      </div>

      <div style={{ marginTop: 16, background: 'white', borderRadius: 10, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Recent tasks</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={th}>Title</th>
              <th style={th}>Status</th>
              <th style={th}>Priority</th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(0, 8).map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.title}</td>
                <td style={td}>{t.status}</td>
                <td style={td}>{t.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card(props: { title: string; value: string; color: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: 12, borderLeft: `6px solid ${props.color}` }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{props.title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{props.value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #eee', fontSize: 12, opacity: 0.8 };
const td: React.CSSProperties = { padding: '10px 6px', borderBottom: '1px solid #f2f2f2' };

