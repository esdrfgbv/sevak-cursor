import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function CoordinatorAnalytics() {
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [perf, setPerf] = useState<any[]>([]);
  const [demand, setDemand] = useState<any[]>([]);

  useEffect(() => {
    api.analytics.dashboard().then(setDashboard).catch(() => {});
    api.analytics.volunteerPerformance().then(setPerf).catch(() => {});
    api.analytics.skillDemand().then(setDemand).catch(() => {});
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ background: 'white', borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Event summary</h2>
        <pre style={{ margin: 0, background: '#f7f7f7', padding: 10, borderRadius: 8, overflowX: 'auto' }}>
          {dashboard ? JSON.stringify(dashboard, null, 2) : 'Loading…'}
        </pre>
      </div>
      <div style={{ background: 'white', borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Volunteer performance</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={th}>Volunteer</th>
              <th style={th}>Completed</th>
              <th style={th}>Avg rating</th>
            </tr>
          </thead>
          <tbody>
            {perf.map((r) => (
              <tr key={r.volunteer_id}>
                <td style={td}>{r.volunteer_id}</td>
                <td style={td}>{r.tasks_completed}</td>
                <td style={td}>{r.avg_rating ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ gridColumn: '1 / span 2', background: 'white', borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Skill demand</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={th}>Skill</th>
              <th style={th}>Requested</th>
              <th style={th}>Volunteers with skill</th>
            </tr>
          </thead>
          <tbody>
            {demand.map((d) => (
              <tr key={d.skill_id}>
                <td style={td}>{d.skill_name}</td>
                <td style={td}>{d.count}</td>
                <td style={td}>{d.filled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #eee', fontSize: 12, opacity: 0.8 };
const td: React.CSSProperties = { padding: '10px 6px', borderBottom: '1px solid #f2f2f2', fontSize: 13 };

