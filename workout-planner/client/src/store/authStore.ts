import { create } from 'zustand';
import { api } from '../lib/axios';

interface User {
    id: string;
    email: string;
}

type NextStep = 'dashboard' | 'onboarding';

type AuthResponse = {
    token: string;
    user: User;
    nextStep: NextStep;
    message?: string;
};

interface AuthState {
    user: User | null;
    token: string | null;
    login: (email: string) => Promise<AuthResponse>;
    signup: (email: string) => Promise<AuthResponse>;
    logout: () => void;
    checkAuth: () => void;
}

const persistAuthState = ({ token, user }: Pick<AuthResponse, 'token' | 'user'>) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
};

export const useAuthStore = create<AuthState>((set) => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token'),

    login: async (email: string) => {
        const res = await api.post('/auth/login', { email });
        const payload = res.data as AuthResponse;
        persistAuthState(payload);
        set({ token: payload.token, user: payload.user });
        return payload;
    },

    signup: async (email: string) => {
        const res = await api.post('/auth/signup', { email });
        const payload = res.data as AuthResponse;
        persistAuthState(payload);
        set({ token: payload.token, user: payload.user });
        return payload;
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
