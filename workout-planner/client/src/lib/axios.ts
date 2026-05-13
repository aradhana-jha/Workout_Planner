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

type DemoAccount = {
    id: string;
    email: string;
    hasProfile: boolean;
};

const DEMO_ACCOUNTS_KEY = 'demo_accounts';

const getDemoAccounts = (): DemoAccount[] => JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '[]');

const saveDemoAccounts = (accounts: DemoAccount[]) => {
    localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
};

const getLegacyStoredUser = (): { email?: string } | null => {
    return JSON.parse(localStorage.getItem('user') || 'null');
};

const findDemoAccount = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    return getDemoAccounts().find((account) => account.email === normalizedEmail) || null;
};

const upsertDemoAccount = (email: string, hasProfile = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = getDemoAccounts();
    const existing = accounts.find((account) => account.email === normalizedEmail);

    if (existing) {
        existing.hasProfile = existing.hasProfile || hasProfile;
        saveDemoAccounts(accounts);
        return existing;
    }

    const created = {
        id: `demo-user-${normalizedEmail.replace(/[^a-z0-9]+/g, '-') || 'account'}`,
        email: normalizedEmail,
        hasProfile,
    };

    accounts.push(created);
    saveDemoAccounts(accounts);
    return created;
};

const markDemoProfileComplete = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null') as { email?: string } | null;
    if (!storedUser?.email) return;
    const normalizedEmail = storedUser.email.toLowerCase();

    const accounts = getDemoAccounts();
    const account = accounts.find((item) => item.email === normalizedEmail);
    if (!account) return;

    account.hasProfile = true;
    saveDemoAccounts(accounts);
};

const buildDemoAuthPayload = (account: DemoAccount, message?: string) => ({
    token: `mock-demo-token:${account.id}`,
    user: { id: account.id, email: account.email },
    nextStep: account.hasProfile ? 'dashboard' : 'onboarding',
    ...(message ? { message } : {}),
});

type MockFocusExercise = {
    id: string;
    phase: 'warm-up' | 'main' | 'cool-down';
    name: string;
    targetSets: number;
    targetReps?: number;
    targetSeconds?: number;
    targetRestSeconds: number;
    description: string;
};

type MockFocusWorkout = {
    label: string;
    summary: string;
    exercises: MockFocusExercise[];
};

const MOCK_FOCUS_WORKOUTS: Record<string, MockFocusWorkout> = {
    'full-body': {
        label: 'Full body',
        summary: 'A balanced full-body session with warm-up, strength work, and a short cool-down.',
        exercises: [
            { id: 'ff-w1', phase: 'warm-up', name: 'March in place', targetSets: 1, targetSeconds: 45, targetRestSeconds: 15, description: 'Raise body temperature and settle into the session.' },
            { id: 'ff-w2', phase: 'warm-up', name: 'Arm circles', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Loosen the shoulders before lifting.' },
            { id: 'ff-m1', phase: 'main', name: 'Bodyweight squats', targetSets: 3, targetReps: 12, targetRestSeconds: 35, description: 'Drive evenly through both feet and stay tall through the chest.' },
            { id: 'ff-m2', phase: 'main', name: 'Incline push-up', targetSets: 3, targetReps: 10, targetRestSeconds: 35, description: 'Keep the body line tight and lower under control.' },
            { id: 'ff-m3', phase: 'main', name: 'Dead bug', targetSets: 2, targetReps: 10, targetRestSeconds: 25, description: 'Brace the trunk and move limbs without letting the back arch.' },
            { id: 'ff-c1', phase: 'cool-down', name: 'Child’s pose', targetSets: 1, targetSeconds: 40, targetRestSeconds: 15, description: 'Finish with easy breathing and a full-body reset.' },
        ],
    },
    abs: {
        label: 'Abs',
        summary: 'Core-focused work that mixes trunk control, anti-extension, and controlled holds.',
        exercises: [
            { id: 'ab-w1', phase: 'warm-up', name: 'Cat-camel', targetSets: 1, targetReps: 8, targetRestSeconds: 15, description: 'Wake up the spine before the core block.' },
            { id: 'ab-m1', phase: 'main', name: 'Dead bug', targetSets: 3, targetReps: 10, targetRestSeconds: 30, description: 'Keep the ribs down and move with control.' },
            { id: 'ab-m2', phase: 'main', name: 'Front plank (knees)', targetSets: 2, targetSeconds: 30, targetRestSeconds: 25, description: 'Hold steady without letting the hips sag.' },
            { id: 'ab-m3', phase: 'main', name: 'Hollow hold', targetSets: 2, targetSeconds: 20, targetRestSeconds: 25, description: 'Stay braced and avoid arching through the lower back.' },
            { id: 'ab-c1', phase: 'cool-down', name: 'Child’s pose with reach', targetSets: 1, targetSeconds: 35, targetRestSeconds: 15, description: 'Lengthen the trunk and slow your breathing.' },
        ],
    },
    legs: {
        label: 'Legs',
        summary: 'Lower-body training built around squat, hinge, and single-leg patterns.',
        exercises: [
            { id: 'lg-w1', phase: 'warm-up', name: 'Hip circles', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Prepare the hips and knees for leg work.' },
            { id: 'lg-w2', phase: 'warm-up', name: 'Reverse lunges (bodyweight)', targetSets: 1, targetReps: 8, targetRestSeconds: 15, description: 'Prime balance and range before the work sets.' },
            { id: 'lg-m1', phase: 'main', name: 'Bodyweight squats', targetSets: 3, targetReps: 12, targetRestSeconds: 35, description: 'Stay stacked and move through a smooth depth.' },
            { id: 'lg-m2', phase: 'main', name: 'Reverse lunge', targetSets: 3, targetReps: 8, targetRestSeconds: 35, description: 'Step back under control and press strongly to stand.' },
            { id: 'lg-m3', phase: 'main', name: 'Glute bridge', targetSets: 2, targetReps: 12, targetRestSeconds: 30, description: 'Squeeze at the top without overextending the back.' },
            { id: 'lg-c1', phase: 'cool-down', name: 'Standing hamstring stretch', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Cool down the back line after the main effort.' },
        ],
    },
    butt: {
        label: 'Butt',
        summary: 'Glute-biased work with bridges, hinges, and unilateral control.',
        exercises: [
            { id: 'bt-w1', phase: 'warm-up', name: 'Glute bridge march', targetSets: 1, targetReps: 10, targetRestSeconds: 15, description: 'Activate the hips before heavier glute work.' },
            { id: 'bt-m1', phase: 'main', name: 'Glute bridge', targetSets: 3, targetReps: 12, targetRestSeconds: 35, description: 'Press through the heels and squeeze hard at the top.' },
            { id: 'bt-m2', phase: 'main', name: 'Single-leg glute bridge', targetSets: 2, targetReps: 10, targetRestSeconds: 35, description: 'Keep the pelvis level as you drive up.' },
            { id: 'bt-m3', phase: 'main', name: 'Bulgarian split squat', targetSets: 2, targetReps: 8, targetRestSeconds: 35, description: 'Use a controlled descent and push through the front foot.' },
            { id: 'bt-c1', phase: 'cool-down', name: 'Figure four glute stretch', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Release the glutes and hips before finishing.' },
        ],
    },
    arms: {
        label: 'Arms',
        summary: 'Upper-body push and pull work focused on arms and shoulder support.',
        exercises: [
            { id: 'ar-w1', phase: 'warm-up', name: 'Shoulder rolls', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Warm the shoulders and elbows before the set work.' },
            { id: 'ar-w2', phase: 'warm-up', name: 'Band pull-apart', targetSets: 1, targetReps: 12, targetRestSeconds: 15, description: 'Open the upper back to improve pressing posture.' },
            { id: 'ar-m1', phase: 'main', name: 'Dumbbell biceps curl', targetSets: 3, targetReps: 10, targetRestSeconds: 35, description: 'Keep the elbows quiet and lower with control.' },
            { id: 'ar-m2', phase: 'main', name: 'Bench dips', targetSets: 2, targetReps: 10, targetRestSeconds: 35, description: 'Stay close to the bench and keep the range controlled.' },
            { id: 'ar-m3', phase: 'main', name: 'Dumbbell overhead press', targetSets: 2, targetReps: 10, targetRestSeconds: 35, description: 'Brace through the trunk and press in a smooth line.' },
            { id: 'ar-c1', phase: 'cool-down', name: 'Shoulder cross-body stretch', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Ease the shoulders down after the session.' },
        ],
    },
};

const getMockFocusWorkout = (focusKey: keyof typeof MOCK_FOCUS_WORKOUTS) => {
    const entry = MOCK_FOCUS_WORKOUTS[focusKey];
    if (!entry) return null;

    return {
        key: focusKey,
        label: entry.label,
        summary: entry.summary,
        profileSummary: 'Beginner • 25 min',
        estimatedMinutes: 25,
        experienceLevel: 'Beginner',
        exercises: entry.exercises.map((exercise) => ({
            ...exercise,
            muscleGroup: entry.label,
            difficulty: 'Beginner',
            videoUrl: null,
            targetLabel: exercise.targetReps != null ? `${exercise.targetReps} reps` : `${exercise.targetSeconds} seconds`,
        })),
    };
};

if (DEMO_MODE_ENABLED) {
    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            console.warn('API Error (Demo Mode Active):', error.config?.url);

            await new Promise(resolve => setTimeout(resolve, 300));

            const url = error.config?.url || '';
            const method = error.config?.method || '';

            if (url.includes('/auth/login') && method === 'post') {
                const email = JSON.parse(error.config.data).email as string;
                let account = findDemoAccount(email);

                if (!account) {
                    const legacyUser = getLegacyStoredUser();
                    const normalizedEmail = email.trim().toLowerCase();
                    const hasLegacyMatch = legacyUser?.email?.trim().toLowerCase() === normalizedEmail;

                    if (hasLegacyMatch) {
                        account = upsertDemoAccount(normalizedEmail, Boolean(localStorage.getItem('demo_plan')));
                    }
                }

                if (!account) {
                    return Promise.reject({
                        ...error,
                        response: {
                            status: 404,
                            data: { error: 'account_not_found' },
                        },
                    });
                }

                return {
                    data: buildDemoAuthPayload(account),
                };
            }

            if (url.includes('/auth/signup') && method === 'post') {
                const email = JSON.parse(error.config.data).email as string;
                const existingAccount = findDemoAccount(email);

                if (existingAccount) {
                    return {
                        data: buildDemoAuthPayload(
                            existingAccount,
                            existingAccount.hasProfile
                                ? 'Account already exists. Signed you in.'
                                : 'Account already exists. Continue onboarding to build your plan.',
                        ),
                    };
                }

                const createdAccount = upsertDemoAccount(email, false);
                return {
                    data: buildDemoAuthPayload(
                        createdAccount,
                        'Account created. Continue onboarding to build your plan.',
                    ),
                };
            }

            if (url.includes('/profile') && method === 'post') {
                markDemoProfileComplete();
                return { data: { success: true } };
            }

            if (url.includes('/workout/plan/current') && method === 'get') {
                return { data: { plan: getMockPlan() } };
            }

            if (url.includes('/workout/focus') && method === 'get') {
                const focusKey = error.config?.params?.focusKey || 'full-body';
                return { data: { focusWorkout: getMockFocusWorkout(focusKey) } };
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
