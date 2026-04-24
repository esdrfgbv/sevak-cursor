import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import RequesterDashboard from "./pages/RequesterDashboard";
import VolunteerDashboard from "./pages/VolunteerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { login } from "./services/api";

const SESSION_KEY = "disasteriq-user";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
        setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogin = async (payload) => {
    setLoading(true);
    setLoginError("");
    try {
      const nextUser = await login(payload);
      setUser(nextUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    } catch (error) {
      setLoginError(error.response?.data?.detail || error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchRole = async (role) => {
    if (!user || user.role === role) {
      return user;
    }

    setLoading(true);
    try {
      const skills = user.skills?.map((skill) => skill.name) || [];
      const nextUser = await login({
        name: user.name,
        role,
        phone: user.phone,
        lat: user.lat,
        lng: user.lng,
        skills: role === "volunteer" ? skills.length ? skills : ["Medical"] : [],
      });
      handleUserChange(nextUser);
      return nextUser;
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to={`/${user.role}`} replace /> : <Login onLogin={handleLogin} loading={loading} error={loginError} />}
        />
        <Route
          path="/requester"
          element={
            user?.role === "requester" ? (
              <RequesterDashboard user={user} onUserChange={handleUserChange} onSwitchRole={handleSwitchRole} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/volunteer"
          element={
            user?.role === "volunteer" ? (
              <VolunteerDashboard user={user} onUserChange={handleUserChange} onSwitchRole={handleSwitchRole} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={user?.role === "admin" ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
