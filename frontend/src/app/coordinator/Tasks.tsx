import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

export function CoordinatorTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.tasks.list().then(setTasks).catch((e) => setError(e.message));
  }, []);

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'), [tasks]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ background: 'white', borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Tasks</h2>
        {error ? <div style={{ color: '#E74C3C' }}>{error}</div> : null}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={th}>Title</th>
              <th style={th}>Status</th>
              <th style={th}>Priority</th>
            </tr>
          </thead>
          <tbody>
            {openTasks.map((t) => (
              <tr
                key={t.id}
                onClick={() => {
                  setSelected(t);
                  setMatches(null);
                }}
                style={{ cursor: 'pointer', background: selected?.id === t.id ? '#ECF0F1' : 'transparent' }}
              >
                <td style={td}>{t.title}</td>
                <td style={td}>{t.status}</td>
                <td style={td}>{t.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Task details</h2>
        {!selected ? (
          <div>Select a task to view details and match volunteers.</div>
        ) : (
          <>
            <div style={{ fontWeight: 700 }}>{selected.title}</div>
            <div style={{ opacity: 0.8, marginTop: 6 }}>{selected.description}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  const m = await api.tasks.match(selected.id, 3);
                  setMatches(m);
                }}
                style={{ background: '#1F497D', color: 'white', border: 0, padding: '10px 12px', borderRadius: 8 }}
              >
                Get top matches
              </button>
            </div>

            {matches ? (
              <div style={{ marginTop: 12 }}>
                <h3 style={{ margin: '10px 0 6px' }}>Recommended volunteers</h3>
                {matches.map((m) => (
                  <div key={m.volunteer_id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{m.volunteer_id}</strong>
                      <span style={{ fontWeight: 700 }}>Score: {m.score}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>{m.justification}</div>
                    <button
                      onClick={async () => {
                        await api.assignments.create({ task_id: selected.id, volunteer_id: m.volunteer_id, matching_score: Math.round(m.score) });
                        alert('Assigned');
                      }}
                      style={{
                        marginTop: 8,
                        background: '#27AE60',
                        color: 'white',
                        border: 0,
                        padding: '8px 10px',
                        borderRadius: 8,
                      }}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #eee', fontSize: 12, opacity: 0.8 };
const td: React.CSSProperties = { padding: '10px 6px', borderBottom: '1px solid #f2f2f2' };

