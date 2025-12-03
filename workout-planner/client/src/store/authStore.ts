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
        try {
            const res = await api.post('/auth/login', { email });
            const { token, user } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            set({ token, user });
        } catch (error) {
            console.warn("Backend unreachable, switching to Demo Mode");
            // Mock Login
            const demoUser = { id: 'demo-user-id', email: email };
            const demoToken = 'demo-token-mock';

            localStorage.setItem('token', demoToken);
            localStorage.setItem('user', JSON.stringify(demoUser));
            set({ token: demoToken, user: demoUser });
        }
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
