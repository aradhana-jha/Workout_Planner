import { create } from 'zustand';
import { api } from '../lib/axios';

interface User {
    id: string;
    email: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    login: (email: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: localStorage.getItem('token'),

    login: async (email: string) => {
        const res = await api.post('/auth/login', { email });
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        set({ token, user });
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null });
    },

    checkAuth: () => {
        const token = localStorage.getItem('token');
        if (token) {
            // Ideally verify token with backend, but for now just set state
            // We could add a /me endpoint later
            set({ token });
        }
    }
}));
