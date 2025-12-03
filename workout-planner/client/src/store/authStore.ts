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
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token'),

    login: async (email: string) => {
        const res = await api.post('/auth/login', { email });
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null });
    },

    checkAuth: () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (token && user) {
            set({ token, user });
        }
    }
}));
