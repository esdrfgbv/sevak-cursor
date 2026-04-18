import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setSession, type UserRole } from '../../lib/api';

export function Register() {
  const nav = useNavigate();
  const [role, setRole] = useState<UserRole>('volunteer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', background: 'white', padding: 16, borderRadius: 10 }}>
      <h2 style={{ marginTop: 0 }}>Register</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={inputStyle}>
            <option value="volunteer">Volunteer</option>
            <option value="coordinator">Coordinator</option>
          </select>
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ gridColumn: '1 / span 2' }}>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>
        {role === 'volunteer' ? (
          <>
            <label>
              First name
              <input value={first} onChange={(e) => setFirst(e.target.value)} style={inputStyle} />
            </label>
            <label>
              Last name
              <input value={last} onChange={(e) => setLast(e.target.value)} style={inputStyle} />
            </label>
          </>
        ) : null}
        <label style={{ gridColumn: '1 / span 2' }}>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </label>
      </div>

      {error ? <div style={{ color: '#E74C3C', marginTop: 8 }}>{error}</div> : null}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await api.auth.register({
              email,
              password,
              phone: phone || undefined,
              role,
              first_name: first || undefined,
              last_name: last || undefined,
            });
            setSession(r.access_token, { id: r.user.id, email: r.user.email, role: r.user.role });
            nav(r.user.role === 'volunteer' ? '/volunteer' : '/coordinator');
          } catch (e: any) {
            setError(e?.message ?? 'Registration failed');
          } finally {
            setBusy(false);
          }
        }}
        style={{ marginTop: 12, background: '#27AE60', color: 'white', padding: '10px 12px', border: 0, borderRadius: 8, width: '100%' }}
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        Already have an account? <Link to="/login">Login</Link>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc' };

