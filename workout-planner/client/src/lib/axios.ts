import axios from 'axios';
import { MUSCLE_GAIN_PLAN } from './customPlan';

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

// Old mockExercises removed in favor of customPlan.ts logic

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
            const dayIndex = parseInt(dayId?.replace('day-', '') || '1');

            // 7-Day Cycle Logic
            // Day 1 -> 1, Day 7 -> 7, Day 8 -> 1...
            let cycleDay = dayIndex % 7;
            if (cycleDay === 0) cycleDay = 7;

            // Import plan (Dynamically or top-level, simplifying here by assuming import)
            // Note: Since we are inside the interceptor, we need access to the data. 
            // We will import it at the top of the file in the full file context, 
            // but here we just use the variable name assuming it's available.

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
                            targetSets: typeof ex.sets === 'string' ? 1 : ex.sets, // Handle simple sets
                            targetReps: ex.reps, // Pass the string directly (e.g. "30 seconds")
                            // Note: We might need to adjust the UI to handle string reps if it expects number
                            // But usually UI just displays it.
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
