import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './app/auth/Login';
import { Register } from './app/auth/Register';
import { getUser } from './lib/api';
import { CoordinatorDashboard } from './app/coordinator/Dashboard';
import { CoordinatorTasks } from './app/coordinator/Tasks';
import { CoordinatorVolunteers } from './app/coordinator/Volunteers';
import { CoordinatorAnalytics } from './app/coordinator/Analytics';
import { VolunteerHome } from './app/volunteer/Home';

function App() {
  const user = getUser();
  const home = user?.role === 'volunteer' ? '/volunteer' : '/coordinator';

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={user ? home : '/login'} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/coordinator" element={<CoordinatorDashboard />} />
        <Route path="/coordinator/tasks" element={<CoordinatorTasks />} />
        <Route path="/coordinator/volunteers" element={<CoordinatorVolunteers />} />
        <Route path="/coordinator/analytics" element={<CoordinatorAnalytics />} />

        <Route path="/volunteer" element={<VolunteerHome />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App
