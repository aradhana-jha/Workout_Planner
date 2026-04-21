import axios from 'axios';
import { MUSCLE_GAIN_PLAN } from './customPlan';

const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

const getBaseUrl = () => import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
    baseURL: getBaseUrl(),
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

// Old mockExercises removed in favor of customPlan.ts logic

if (DEMO_MODE_ENABLED) {
    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            console.warn('API Error (Demo Mode Active):', error.config?.url);

            await new Promise(resolve => setTimeout(resolve, 300));

            const url = error.config?.url || '';
            const method = error.config?.method || '';

            if (url.includes('/auth/login') && method === 'post') {
                const email = JSON.parse(error.config.data).email;
                return {
                    data: {
                        token: 'mock-demo-token',
                        user: { id: 'demo-user', email }
                    }
                };
            }

            if (url.includes('/profile') && method === 'post') {
                return { data: { success: true } };
            }

            if (url.includes('/workout/plan/current') && method === 'get') {
                return { data: { plan: getMockPlan() } };
            }

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

            if (url.includes('/workout/') && !url.includes('/complete') && method === 'get') {
                const dayIdFromQuery = url.includes('?')
                    ? new URL(url, 'http://local').searchParams.get('dayId')
                    : null;
                const dayId = dayIdFromQuery || url.split('/').pop();
                const dayIndex = parseInt(dayId?.replace('day-', '') || '1', 10);

                let cycleDay = dayIndex % 7;
                if (cycleDay === 0) cycleDay = 7;

                const dayPlan = (MUSCLE_GAIN_PLAN as any)[cycleDay];

                if (!dayPlan) {
                    return { data: { workoutDay: null } };
                }

                return {
                    data: {
                        workoutDay: {
                            id: dayId,
                            title: `Day ${dayIndex}: ${dayPlan.title}`,
                            exercises: dayPlan.exercises.map((ex: any) => ({
                                id: ex.id,
                                exerciseId: ex.id,
                                exercise: {
                                    id: ex.id,
                                    name: ex.name,
                                    description: 'Guided exercise from Muscle Gain Plan.',
                                    videoUrl: null,
                                    difficulty: 'beginner',
                                    muscleGroup: ex.muscleGroup
                                },
                                targetSets: typeof ex.sets === 'string' ? 1 : ex.sets,
                                targetReps: ex.reps,
                                logs: []
                            }))
                        }
                    }
                };
            }

            if (url.includes('/complete') && method === 'post') {
                const data = error.config.data ? JSON.parse(error.config.data) : {};
                const dayId = data.dayId || url.split('/')[3];
                if (dayId) updateMockDayComplete(dayId);
                return { data: { success: true } };
            }

            return Promise.reject(error);
        }
    );
}
