import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi, usersApi, volunteersApi, type User } from "@/lib/api";
import { getBrowserLocation, type Coordinates } from "@/services/location";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (name: string, role: string, skills?: string[]) => Promise<void>;
  refreshLocation: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  refreshLocation: async () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = (nextUser: User, nextToken = token) => {
    setUser(nextUser);
    if (nextToken) setToken(nextToken);
    localStorage.setItem("sevak_user", JSON.stringify(nextUser));
    if (nextToken) localStorage.setItem("sevak_token", nextToken);
  };

  const updateUserLocation = async (currentUser: User, coords: Coordinates) => {
    const updated =
      currentUser.role === "volunteer"
        ? await volunteersApi.updateLocation(currentUser.id, coords)
        : await usersApi.updateLocation(currentUser.id, coords);
    persistSession(updated);
    return updated;
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("sevak_user");
    const savedToken = localStorage.getItem("sevak_token");
    if (savedUser && savedToken) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        setUser(parsedUser);
        setToken(savedToken);
        getBrowserLocation()
          .then((coords) => updateUserLocation(parsedUser, coords))
          .catch((error) => console.info("Location permission unavailable:", error));
      } catch {
        localStorage.removeItem("sevak_user");
        localStorage.removeItem("sevak_token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (name: string, role: string, skills: string[] = []) => {
    const fallbackLocation = { lat: 17.3850, lng: 78.4867 };
    const location = await getBrowserLocation().catch((error) => {
      console.info("Using Hyderabad fallback location:", error);
      return fallbackLocation;
    });
    const res = await authApi.login({ name, role, lat: location.lat, lng: location.lng, skills });
    persistSession(res.user, res.token);
  };

  const refreshLocation = async () => {
    if (!user) return;
    const location = await getBrowserLocation();
    await updateUserLocation(user, location);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("sevak_user");
    localStorage.removeItem("sevak_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshLocation, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
