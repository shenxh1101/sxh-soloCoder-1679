import { create } from 'zustand';
import type { User } from '../../shared/types.js';

interface Toast { id: number; type: 'success' | 'error' | 'warning' | 'info'; message: string; }

interface AppState {
  user: User | null;
  token: string | null;
  loading: boolean;
  sidebarCollapsed: boolean;
  toasts: Toast[];
  unreadCount: number;

  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  login: (u: User, token: string) => void;
  logout: () => void;
  setLoading: (v: boolean) => void;
  toggleSidebar: () => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: number) => void;
  setUnreadCount: (n: number) => void;
}

const storedToken = localStorage.getItem('token');
const storedUser = localStorage.getItem('user');

export const useAppStore = create<AppState>((set, get) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken,
  loading: false,
  sidebarCollapsed: false,
  toasts: [],
  unreadCount: 0,

  setUser: (u) => {
    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
    set({ user: u });
  },
  setToken: (t) => {
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
    set({ token: t });
  },
  login: (u, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    set({ user: u, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
  setLoading: (v) => set({ loading: v }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  pushToast: (t) => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
  setUnreadCount: (n) => set({ unreadCount: n }),
}));

export function useToast() {
  const { pushToast } = useAppStore();
  return {
    success: (m: string) => pushToast({ type: 'success', message: m }),
    error: (m: string) => pushToast({ type: 'error', message: m }),
    warning: (m: string) => pushToast({ type: 'warning', message: m }),
    info: (m: string) => pushToast({ type: 'info', message: m }),
  };
}
