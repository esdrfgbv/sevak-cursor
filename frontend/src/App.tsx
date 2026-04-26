import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Tasks from "./pages/Tasks";
import Volunteers from "./pages/Volunteers";
import MapView from "./pages/MapView";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import RequesterDashboard from "./pages/RequesterDashboard";
import VolunteerDashboard from "./pages/VolunteerDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10000, // 10s polling for real-time simulation
      staleTime: 5000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === "admin" ? "/" : user.role === "requester" ? "/request" : "/volunteer"} replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute allowedRoles={["admin"]}><Index /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Index /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute allowedRoles={["admin"]}><Tasks /></ProtectedRoute>} />
      <Route path="/volunteers" element={<ProtectedRoute allowedRoles={["admin"]}><Volunteers /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute allowedRoles={["admin"]}><MapView /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute allowedRoles={["admin"]}><Analytics /></ProtectedRoute>} />
      <Route path="/request" element={<ProtectedRoute allowedRoles={["requester", "admin"]}><RequesterDashboard /></ProtectedRoute>} />
      <Route path="/volunteer" element={<ProtectedRoute allowedRoles={["volunteer"]}><VolunteerDashboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
