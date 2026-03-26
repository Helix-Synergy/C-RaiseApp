import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { BASE_URL, SOCKET_URL } from "../config/api";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "employee" | "admin";
  companyId: string;
  companyName?: string;
}
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  socket: Socket | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<any>; // ✅ FIXED
  createAdmin: (name: string, email: string, password: string) => Promise<any>; // ✅ ADD THIS
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// --- AXIOS CONFIGURATION ---
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10s timeout
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // 1. JWT Interceptor: Automatically attach token to every request if it exists
  api.interceptors.request.use(async (config) => {
    const t = await AsyncStorage.getItem("token");
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
  });

  // 2. Initialize Socket Connection when user changes
  useEffect(() => {
    if (user && user.companyId) {
      const newSocket = io(SOCKET_URL, {
        reconnectionAttempts: 5,
        timeout: 20000,
      });

      newSocket.on("connect", () => {
        newSocket.emit("joinCompany", user.companyId);
        console.log(`📡 Real-time connected for company: ${user.companyName || user.companyId}`);
      });

      setSocket(newSocket);
      return () => {
        newSocket.disconnect();
        setSocket(null);
      };
    }
  }, [user]);

  // 3. Restore session on startup
  useEffect(() => {
    const restore = async () => {
      try {
        const savedToken = await AsyncStorage.getItem("token");
        const savedUser = await AsyncStorage.getItem("user");
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.error("Session restoration error:", e);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { token: tk, user: u } = res.data;
    await AsyncStorage.setItem("token", tk);
    await AsyncStorage.setItem("user", JSON.stringify(u));
    setToken(tk);
    setUser(u);
  };
  const signup = async (name: string, email: string, password: string) => {
    const res = await api.post("/auth/signup", { name, email, password });

    const { token: tk, user: u } = res.data;

    await AsyncStorage.setItem("token", tk);
    await AsyncStorage.setItem("user", JSON.stringify(u));

    // setToken(tk);
    // setUser(u);
    return res.data;
  };
  const createAdmin = async (name: string, email: string, password: string) => {
    try {
      const res = await api.post("/auth/create-admin", {
        name,
        email,
        password,
      });

      return res.data;
    } catch (err) {
      throw err;
    }
  };
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await api.put("/auth/change-password", { currentPassword, newPassword });
      return res.data;
    } catch (err) {
      throw err;
    }
  };
  const logout = async () => {
    await AsyncStorage.multiRemove(["token", "user"]);
    setToken(null);
    setUser(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, socket, login, signup, createAdmin, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { api }; // Export for other services to use the same logic
