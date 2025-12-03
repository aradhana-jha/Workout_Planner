import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Mock Data Generator
const generateMockPlan = () => {
    const days = [];
    for (let i = 1; i <= 30; i++) {
        days.push({
            id: `day-${i}`,
            dayNumber: i,
            title: i % 4 === 0 ? 'Rest Day' : `Workout Day ${i}`,
            isCompleted: false,
            completedAt: null
        });
    }
    return { id: 'mock-plan-id', days };
};

const mockExercises = [
    { id: 'ex-1', name: 'Push Ups', sets: 3, reps: 10 },
    { id: 'ex-2', name: 'Squats', sets: 3, reps: 15 },
    { id: 'ex-3', name: 'Plank', sets: 3, reps: 60 }, // seconds
];

// Global Response Interceptor for Demo Mode
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        console.warn("API Error (Demo Mode Active):", error.config?.url);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const url = error.config?.url || '';
        const method = error.config?.method || '';

        // 1. Mock Login
        if (url.includes('/auth/login') && method === 'post') {
            const email = JSON.parse(error.config.data).email;
            return {
                data: {
                    token: 'mock-demo-token',
                    user: { id: 'demo-user', email }
                }
            };
        }

        // 2. Mock Profile Creation (Onboarding)
        if (url.includes('/profile') && method === 'post') {
            return { data: { success: true } };
        }

        // 3. Mock Fetch Plan
        if (url.includes('/workout/plan/current') && method === 'get') {
            return { data: { plan: generateMockPlan() } };
        }

        // 4. Mock Fetch Workout Details
        if (url.includes('/workout/') && !url.includes('/complete') && method === 'get') {
            const dayId = url.split('/').pop();
            return {
                data: {
                    workout: {
                        id: dayId,
                        title: 'Full Body Mock Workout',
                        exercises: mockExercises.map(ex => ({
                            id: ex.id,
                            exercise: { name: ex.name, description: 'Mock description', videoUrl: null },
                            targetSets: ex.sets,
                            targetReps: ex.reps
                        }))
                    }
                }
            };
        }

        // 5. Mock Complete Workout
        if (url.includes('/complete') && method === 'post') {
            return { data: { success: true } };
        }

        return Promise.reject(error);
    }
);
