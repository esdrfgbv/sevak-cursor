import { useEffect, useState } from 'react';
import { api, getUser } from '../../lib/api';

export function VolunteerHome() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const user = getUser();

  useEffect(() => {
    api.assignments
      .list()
      .then(setAssignments)
      .catch((e) => setError(e.message));
  }, []);

  if (!user) return <div>Please log in.</div>;

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: 12 }}>
      <h2 style={{ marginTop: 0 }}>My Assignments</h2>
      {error ? <div style={{ color: '#E74C3C' }}>{error}</div> : null}
      {assignments.length === 0 ? <div>No assignments yet.</div> : null}
      {assignments.map((a) => (
        <div key={a.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong>Task: {a.taskId}</strong>
            <span>Status: {a.status}</span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {a.status === 'assigned' ? (
              <>
                <button
                  onClick={async () => {
                    await api.assignments.accept(a.id);
                    const list = await api.assignments.list();
                    setAssignments(list);
                  }}
                  style={btn('#27AE60')}
                >
                  Accept
                </button>
                <button
                  onClick={async () => {
                    await api.assignments.decline(a.id);
                    const list = await api.assignments.list();
                    setAssignments(list);
                  }}
                  style={btn('#E74C3C')}
                >
                  Decline
                </button>
              </>
            ) : null}
            {a.status === 'accepted' ? (
              <button
                onClick={async () => {
                  const notes = prompt('Completion notes (optional)') ?? undefined;
                  await api.assignments.complete(a.id, notes);
                  const list = await api.assignments.list();
                  setAssignments(list);
                }}
                style={btn('#16A085')}
              >
                Complete
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { background: color, color: 'white', border: 0, padding: '10px 12px', borderRadius: 8 };
}

