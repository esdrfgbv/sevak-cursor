import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (name: string, role: string, skills?: string[]) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("sevak_user");
    const savedToken = localStorage.getItem("sevak_token");
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {
        localStorage.removeItem("sevak_user");
        localStorage.removeItem("sevak_token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (name: string, role: string, skills: string[] = []) => {
    const res = await authApi.login({ name, role, lat: 12.9716, lng: 77.5946, skills });
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem("sevak_user", JSON.stringify(res.user));
    localStorage.setItem("sevak_token", res.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("sevak_user");
    localStorage.removeItem("sevak_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
