import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setSession } from '../../lib/api';

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('coordinator@sevak.local');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', background: 'white', padding: 16, borderRadius: 10 }}>
      <h2 style={{ marginTop: 0 }}>Login</h2>
      <p style={{ marginTop: 0, color: '#555' }}>Use the seeded demo accounts after you run migrations + seed.</p>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Email
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
        />
      </label>
      {error ? <div style={{ color: '#E74C3C', marginBottom: 8 }}>{error}</div> : null}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await api.auth.login(email, password);
            setSession(r.access_token, { id: r.user.id, email: r.user.email, role: r.user.role });
            nav(r.user.role === 'volunteer' ? '/volunteer' : '/coordinator');
          } catch (e: any) {
            setError(e?.message ?? 'Login failed');
          } finally {
            setBusy(false);
          }
        }}
        style={{ background: '#27AE60', color: 'white', padding: '10px 12px', border: 0, borderRadius: 8, width: '100%' }}
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        No account? <Link to="/register">Register</Link>
      </div>
    </div>
  );
}

