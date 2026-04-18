import { useState } from 'react';
import { api } from '../../lib/api';

export function CoordinatorVolunteers() {
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: 12 }}>
      <h2 style={{ marginTop: 0 }}>Volunteer Directory</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} style={input} />
        <input placeholder="Skill (e.g. CPR)" value={skill} onChange={(e) => setSkill(e.target.value)} style={input} />
        <button
          onClick={async () => {
            setError(null);
            try {
              const r = await api.volunteers.search(q || undefined, skill || undefined);
              setList(r);
            } catch (e: any) {
              setError(e?.message ?? 'Search failed');
            }
          }}
          style={{ background: '#1F497D', color: 'white', border: 0, padding: '10px 12px', borderRadius: 8 }}
        >
          Search
        </button>
      </div>
      {error ? <div style={{ color: '#E74C3C', marginTop: 8 }}>{error}</div> : null}

      <div style={{ marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={th}>Name</th>
              <th style={th}>Workload</th>
              <th style={th}>Max/week</th>
              <th style={th}>Verification</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td style={td}>
                  {v.firstName} {v.lastName}
                </td>
                <td style={td}>{v.currentWorkload}</td>
                <td style={td}>{v.maxTasksPerWeek}</td>
                <td style={td}>{v.verificationStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const input: React.CSSProperties = { padding: 10, borderRadius: 8, border: '1px solid #ccc', minWidth: 220 };
const th: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #eee', fontSize: 12, opacity: 0.8 };
const td: React.CSSProperties = { padding: '10px 6px', borderBottom: '1px solid #f2f2f2' };

