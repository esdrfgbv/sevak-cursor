import { Link, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getUser } from '../lib/api';

export function Layout() {
  const nav = useNavigate();
  const user = getUser();

  return (
    <div style={{ minHeight: '100vh', background: '#ECF0F1', color: '#2C3E50' }}>
      <header
        style={{
          background: '#1F497D',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <strong>Sevak</strong>
          {user?.role === 'coordinator' || user?.role === 'admin' ? (
            <>
              <Link style={{ color: 'white' }} to="/coordinator">
                Dashboard
              </Link>
              <Link style={{ color: 'white' }} to="/coordinator/tasks">
                Tasks
              </Link>
              <Link style={{ color: 'white' }} to="/coordinator/volunteers">
                Volunteers
              </Link>
              <Link style={{ color: 'white' }} to="/coordinator/analytics">
                Analytics
              </Link>
            </>
          ) : user?.role === 'volunteer' ? (
            <>
              <Link style={{ color: 'white' }} to="/volunteer">
                My Tasks
              </Link>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ fontSize: 12, opacity: 0.9 }}>
                {user.email} ({user.role})
              </span>
              <button
                onClick={() => {
                  clearSession();
                  nav('/login');
                }}
                style={{ background: '#E74C3C', border: 0, color: 'white', padding: '8px 10px', borderRadius: 6 }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link style={{ color: 'white' }} to="/login">
              Login
            </Link>
          )}
        </div>
      </header>
      <main style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

