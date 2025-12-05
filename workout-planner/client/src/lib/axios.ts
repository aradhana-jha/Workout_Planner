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

// Mock Data Helpers
const getMockPlan = () => {
    const stored = localStorage.getItem('demo_plan');
    if (stored) return JSON.parse(stored);

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
    const plan = { id: 'mock-plan-id', days };
    localStorage.setItem('demo_plan', JSON.stringify(plan));
    return plan;
};

const updateMockDayComplete = (dayId: string) => {
    const plan = getMockPlan();
    const dayIndex = plan.days.findIndex((d: any) => d.id === dayId);
    if (dayIndex !== -1) {
        plan.days[dayIndex].isCompleted = true;
        plan.days[dayIndex].completedAt = new Date().toISOString();
        localStorage.setItem('demo_plan', JSON.stringify(plan));
    }
};

const mockExercises = [
    { id: 'ex-warmup-1', name: 'Jumping Jacks', sets: 2, reps: 30, type: 'warmup' },
    { id: 'ex-warmup-2', name: 'Arm Circles', sets: 2, reps: 20, type: 'warmup' },
    { id: 'ex-1', name: 'Push Ups', sets: 3, reps: 10, type: 'strength' },
    { id: 'ex-2', name: 'Squats', sets: 3, reps: 15, type: 'strength' },
    { id: 'ex-3', name: 'Plank', sets: 3, reps: 60, type: 'core' },
    { id: 'ex-stretch-1', name: 'Cobra Stretch', sets: 2, reps: 30, type: 'stretching' },
    { id: 'ex-stretch-2', name: 'Child\'s Pose', sets: 2, reps: 30, type: 'stretching' },
];

// Global Response Interceptor for Demo Mode
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        console.warn("API Error (Demo Mode Active):", error.config?.url);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));

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
            return { data: { plan: getMockPlan() } };
        }

        // 4. Mock Log Set (Mark as Done)
        if (url.includes('/log') && method === 'post') {
            const data = JSON.parse(error.config.data);
            return {
                data: {
                    log: {
                        id: `mock-log-${Date.now()}`,
                        setNumber: data.setNumber,
                        reps: data.reps,
                        weight: data.weight,
                        isDone: true
                    }
                }
            };
        }

        // 5. Mock Fetch Workout Details
        if (url.includes('/workout/') && !url.includes('/complete') && method === 'get') {
            const dayId = url.split('/').pop();
            return {
                data: {
                    workoutDay: {
                        id: dayId,
                        title: 'Full Body Mock Workout',
                        exercises: mockExercises.map(ex => ({
                            id: ex.id,
                            exerciseId: ex.id,
                            exercise: {
                                id: ex.id,
                                name: ex.name,
                                description: 'Mock description for demo.',
                                videoUrl: null,
                                difficulty: 'beginner',
                                muscleGroup: 'full_body'
                            },
                            targetSets: ex.sets,
                            targetReps: ex.reps,
                            logs: []
                        }))
                    }
                }
            };
        }

        // 6. Mock Complete Workout
        if (url.includes('/complete') && method === 'post') {
            const dayId = url.split('/')[3]; // /workout/day/day-1/complete -> day-1 is index 3
            updateMockDayComplete(dayId);
            return { data: { success: true } };
        }

        return Promise.reject(error);
    }
);
