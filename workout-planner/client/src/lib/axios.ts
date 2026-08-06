import axios from 'axios';
import { getBodyPartPlanForDay, getTrainingDaysFromProfile } from './customPlan';

const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true'
    || (import.meta.env.DEV && !import.meta.env.VITE_API_URL);
const DEMO_PLAN_VERSION = 'personalized-recommendations-v2';
const DEMO_PROFILE_KEY = 'demo_profile';

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
const getDemoProfile = () => {
    try {
        return JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) || 'null') as Record<string, unknown> | null;
    } catch {
        return null;
    }
};

const getDemoTrainingDays = () => {
    const profile = getDemoProfile();
    return getTrainingDaysFromProfile(String(profile?.recentConsistency || '5 days per week'));
};

const getCustomPlanDay = (dayNumber: number) => {
    const profile = getDemoProfile() || {};
    return getBodyPartPlanForDay(dayNumber, getDemoTrainingDays(), {
        goal: String(profile.goal || ''),
        equipment: profile.equipment as string | string[] | undefined,
        experienceLevel: String(profile.experienceLevel || ''),
        intensityPreference: String(profile.intensityPreference || ''),
    });
};

const getMockPlan = () => {
    const stored = localStorage.getItem('demo_plan');
    const trainingDays = getDemoTrainingDays();

    if (stored) {
        const parsed = JSON.parse(stored);
        const reconciledDays = Array.from({ length: 30 }, (_, index) => {
            const dayNumber = index + 1;
            const existingDay = parsed.days?.find((day: any) => day.dayNumber === dayNumber) ?? parsed.days?.[index] ?? {};
            const dayPlan = getCustomPlanDay(dayNumber);

            return {
                id: existingDay.id ?? `day-${dayNumber}`,
                dayNumber,
                title: dayPlan?.title ?? existingDay.title ?? `Workout Day ${dayNumber}`,
                isCompleted: Boolean(existingDay.isCompleted),
                completedAt: existingDay.completedAt ?? null,
            };
        });

        const reconciledPlan = {
            ...parsed,
            id: parsed.id ?? 'mock-plan-id',
            planVersion: DEMO_PLAN_VERSION,
            trainingDays,
            days: reconciledDays,
        };

        localStorage.setItem('demo_plan', JSON.stringify(reconciledPlan));
        return reconciledPlan;
    }

    const days = [];
    for (let i = 1; i <= 30; i++) {
        const dayPlan = getCustomPlanDay(i);
        days.push({
            id: `day-${i}`,
            dayNumber: i,
            title: dayPlan?.title ?? `Workout Day ${i}`,
            isCompleted: false,
            completedAt: null
        });
    }
    const plan = { id: 'mock-plan-id', days };
    const planWithVersion = { ...plan, planVersion: DEMO_PLAN_VERSION, trainingDays };
    localStorage.setItem('demo_plan', JSON.stringify(planWithVersion));
    return planWithVersion;
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

const buildDemoAuthPayload = (
    account: DemoAccount,
    message?: string,
    nextStepOverride?: 'dashboard' | 'onboarding',
) => ({
    token: `mock-demo-token:${account.id}`,
    user: { id: account.id, email: account.email },
    nextStep: nextStepOverride ?? (account.hasProfile ? 'dashboard' : 'onboarding'),
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
        label: 'Full body + cardio',
        summary: 'A balanced low-impact conditioning session with warm-up, strength work, and a short cool-down.',
        exercises: [
            { id: 'ff-w1', phase: 'warm-up', name: 'Worlds greatest stretch', targetSets: 1, targetReps: 6, targetRestSeconds: 15, description: 'Open the hips, spine, and shoulders before the session.' },
            { id: 'ff-w2', phase: 'warm-up', name: 'Arm circles', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Loosen the shoulders before lifting.' },
            { id: 'ff-m1', phase: 'main', name: 'Bodyweight squats', targetSets: 3, targetReps: 12, targetRestSeconds: 35, description: 'Drive evenly through both feet and stay tall through the chest.' },
            { id: 'ff-m2', phase: 'main', name: 'Incline push-up', targetSets: 3, targetReps: 10, targetRestSeconds: 35, description: 'Keep the body line tight and lower under control.' },
            { id: 'ff-m3', phase: 'main', name: 'Dead bug', targetSets: 2, targetReps: 10, targetRestSeconds: 25, description: 'Brace the trunk and move limbs without letting the back arch.' },
            { id: 'ff-c1', phase: 'cool-down', name: 'Child’s pose', targetSets: 1, targetSeconds: 40, targetRestSeconds: 15, description: 'Finish with easy breathing and a full-body reset.' },
        ],
    },
    abs: {
        label: 'Waist + core',
        summary: 'Core-focused work that mixes Pilates control, anti-extension, and controlled holds.',
        exercises: [
            { id: 'ab-w1', phase: 'warm-up', name: 'Cat-camel', targetSets: 1, targetReps: 8, targetRestSeconds: 15, description: 'Wake up the spine before the core block.' },
            { id: 'ab-m1', phase: 'main', name: 'Dead bug', targetSets: 3, targetReps: 10, targetRestSeconds: 30, description: 'Keep the ribs down and move with control.' },
            { id: 'ab-m2', phase: 'main', name: 'Front plank (knees)', targetSets: 2, targetSeconds: 30, targetRestSeconds: 25, description: 'Hold steady without letting the hips sag.' },
            { id: 'ab-m3', phase: 'main', name: 'Hollow hold', targetSets: 2, targetSeconds: 20, targetRestSeconds: 25, description: 'Stay braced and avoid arching through the lower back.' },
            { id: 'ab-c1', phase: 'cool-down', name: 'Child’s pose with reach', targetSets: 1, targetSeconds: 35, targetRestSeconds: 15, description: 'Lengthen the trunk and slow your breathing.' },
        ],
    },
    legs: {
        label: 'Glutes + thighs',
        summary: 'Lower-body training built around squat, lunge, and thigh-focused patterns.',
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
        label: 'Glutes + hamstrings',
        summary: 'Posterior-chain work with bridges, hinges, and unilateral control.',
        exercises: [
            { id: 'bt-w1', phase: 'warm-up', name: 'Glute bridge march', targetSets: 1, targetReps: 10, targetRestSeconds: 15, description: 'Activate the hips before heavier glute work.' },
            { id: 'bt-m1', phase: 'main', name: 'Glute bridge', targetSets: 3, targetReps: 12, targetRestSeconds: 35, description: 'Press through the heels and squeeze hard at the top.' },
            { id: 'bt-m2', phase: 'main', name: 'Single-leg glute bridge', targetSets: 2, targetReps: 10, targetRestSeconds: 35, description: 'Keep the pelvis level as you drive up.' },
            { id: 'bt-m3', phase: 'main', name: 'Bulgarian split squat', targetSets: 2, targetReps: 8, targetRestSeconds: 35, description: 'Use a controlled descent and push through the front foot.' },
            { id: 'bt-c1', phase: 'cool-down', name: 'Figure four glute stretch', targetSets: 1, targetSeconds: 30, targetRestSeconds: 15, description: 'Release the glutes and hips before finishing.' },
        ],
    },
    arms: {
        label: 'Arms + chest',
        summary: 'Upper-body push and pull work focused on chest, arms, and shoulder support.',
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

const DEMO_VIDEO_URL_BY_EXERCISE_NAME: Record<string, string> = {
    '90/90 hip switches': '/exercise-videos/90-90-hip-switches.mp4',
    'Ankle rocks': '/exercise-videos/ankle-rocks.mp4',
    'Arm circles': '/exercise-videos/arm-circles.mp4',
    'Arm swings': '/exercise-videos/arm-swings.mp4',
    'Band chest press': '/exercise-videos/band-chest-press.mp4',
    'Band face pull': '/exercise-videos/band-face-pull.mp4',
    'Band pull-apart': '/exercise-videos/band-pull-apart.mp4',
    'Band row': '/exercise-videos/band-row.mp4',
    'Bird dog reach': '/exercise-videos/bird-dog-reach.mp4',
    'Bodyweight squats': '/exercise-videos/tempo-bodyweight-squat.mp4',
    'Bulgarian split squat': '/exercise-videos/bulgarian-split-squat.mp4',
    'Cat-cow spinal flow': '/exercise-videos/cat-cow-spinal-flow.mp4',
    'Cat–cow': '/exercise-videos/cat-cow-spinal-flow.mp4',
    'Cat–cow (slow)': '/exercise-videos/cat-cow-spinal-flow.mp4',
    'Chair triceps dips': '/exercise-videos/chair-triceps-dips.mp4',
    'Chest stretch against wall': '/exercise-videos/chest-stretch-against-wall.mp4',
    "Child's pose": '/exercise-videos/childs-pose.mp4',
    'Child’s pose': '/exercise-videos/childs-pose.mp4',
    'Close-grip push-up': '/exercise-videos/close-grip-push-up.mp4',
    'Dead bug': '/exercise-videos/dead-bug-activation.mp4',
    'Dead bug activation': '/exercise-videos/dead-bug-activation.mp4',
    'Decline push-up': '/exercise-videos/decline-push-up.mp4',
    'Dumbbell biceps curl': '/exercise-videos/dumbbell-biceps-curl.mp4',
    'Dumbbell bench press': '/exercise-videos/dumbbell-bench-press.mp4',
    'Dumbbell floor press': '/exercise-videos/dumbbell-floor-press.mp4',
    'Dumbbell glute bridge': '/exercise-videos/dumbbell-glute-bridge.mp4',
    'Dumbbell goblet squat': '/exercise-videos/goblet-squat.mp4',
    'Dumbbell hip thrust': '/exercise-videos/hip-thrust.mp4',
    'Dumbbell Romanian deadlift': '/exercise-videos/dumbbell-romanian-deadlift.mp4',
    'Dumbbell shoulder press': '/exercise-videos/dumbbell-shoulder-press.mp4',
    'Dumbbell shoulder press (seated/standing)': '/exercise-videos/dumbbell-shoulder-press.mp4',
    'Dumbbell step-up': '/exercise-videos/dumbbell-step-up.mp4',
    'Dumbbell triceps extension': '/exercise-videos/dumbbell-triceps-extension.mp4',
    'Dumbbell walking lunge': '/exercise-videos/dumbbell-walking-lunge.mp4',
    'Figure four glute stretch': '/exercise-videos/figure-four-glute-stretch.mp4',
    'Figure-four glute stretch': '/exercise-videos/figure-four-glute-stretch.mp4',
    'Forearm plank': '/exercise-videos/forearm-plank.mp4',
    'Glute bridge': '/exercise-videos/pilots/glute-bridge-pilot.mp4?v=2',
    'Glute bridge march activation': '/exercise-videos/glute-bridge-march-activation.mp4',
    'Goblet squat': '/exercise-videos/goblet-squat.mp4',
    'Goblet squat with dumbbell': '/exercise-videos/goblet-squat.mp4',
    'Half-kneeling hip flexor stretch': '/exercise-videos/hip-flexor-lunge-stretch.mp4',
    'Half-kneeling dumbbell press': '/exercise-videos/half-kneeling-dumbbell-press.mp4',
    'Hamstring walkout': '/exercise-videos/hamstring-walkout.mp4',
    'Hip circles': '/exercise-videos/hip-circles.mp4',
    'Hip hinge drill': '/exercise-videos/hip-hinge-drill.mp4',
    'Hip flexor lunge stretch': '/exercise-videos/hip-flexor-lunge-stretch.mp4',
    'Hip thrust': '/exercise-videos/hip-thrust.mp4',
    'Incline push-up': '/exercise-videos/incline-push-up.mp4',
    'Incline push-up (hands on bench/chair)': '/exercise-videos/incline-push-up.mp4',
    'Inchworm walkout': '/exercise-videos/inchworm-walkout.mp4',
    'Knee push-up': '/exercise-videos/knee-push-up.mp4',
    'Kettlebell goblet squat': '/exercise-videos/kettlebell-goblet-squat.mp4',
    'Lateral lunge reach': '/exercise-videos/lateral-lunge-reach.mp4',
    'Lateral lunge': '/exercise-videos/lateral-lunge.mp4',
    'Low-impact jumping jacks': '/exercise-videos/low-impact-jumping-jacks.mp4',
    'Low step-up': '/exercise-videos/low-step-up.mp4',
    'Neck circles': '/exercise-videos/neck-circles.mp4',
    'One-arm dumbbell row': '/exercise-videos/one-arm-dumbbell-row.mp4',
    'Pike push-up': '/exercise-videos/pike-push-up.mp4',
    'Bear hover': '/exercise-videos/bear-hover.mp4',
    'Hollow body tuck': '/exercise-videos/hollow-body-tuck.mp4',
    'Modified Pilates roll-up': '/exercise-videos/modified-pilates-roll-up.mp4',
    'Pallof press': '/exercise-videos/pallof-press.mp4',
    'Pilates hundred': '/exercise-videos/pilates-hundred.mp4',
    'Pilates double-leg stretch': '/exercise-videos/pilates-double-leg-stretch.mp4',
    'Pilates saw': '/exercise-videos/pilates-saw.mp4',
    'Pilates single-leg stretch': '/exercise-videos/pilates-single-leg-stretch.mp4',
    'Pilates spine stretch forward': '/exercise-videos/pilates-spine-stretch-forward.mp4',
    'Pilates swimming': '/exercise-videos/pilates-swimming.mp4',
    'Plank shoulder tap': '/exercise-videos/plank-shoulder-tap.mp4',
    'Plank': '/exercise-videos/forearm-plank.mp4',
    'Prone cobra hold': '/exercise-videos/prone-cobra-hold.mp4',
    'Prone Y-T-W raise': '/exercise-videos/prone-y-t-w-raise.mp4',
    'Reverse lunge': '/exercise-videos/reverse-lunge.mp4',
    'Reverse lunges': '/exercise-videos/reverse-lunge.mp4',
    'Reverse lunges (bodyweight)': '/exercise-videos/reverse-lunge.mp4',
    'Reverse snow angel': '/exercise-videos/reverse-snow-angel.mp4',
    'Romanian deadlift with dumbbells': '/exercise-videos/dumbbell-romanian-deadlift.mp4',
    'Scapular wall slides': '/exercise-videos/scapular-wall-slides.mp4',
    'Seated glute stretch': '/exercise-videos/seated-glute-stretch.mp4',
    'Seated hamstring stretch': '/exercise-videos/seated-hamstring-stretch.mp4',
    'Shoulder CARs': '/exercise-videos/shoulder-cars.mp4',
    'Shoulder cross-body stretch': '/exercise-videos/shoulder-cross-body-stretch.mp4',
    'Shoulder rolls': '/exercise-videos/shoulder-rolls.mp4',
    'Single-leg glute bridge': '/exercise-videos/single-leg-glute-bridge.mp4',
    'Side lying leg raises': '/exercise-videos/side-lying-leg-raises.mp4',
    'Side-lying leg lift': '/exercise-videos/side-lying-leg-raises.mp4',
    'Side plank': '/exercise-videos/side-plank.mp4',
    'Sit-to-stand squat': '/exercise-videos/sit-to-stand-squat.mp4',
    'Standing calf raise': '/exercise-videos/standing-calf-raise.mp4',
    'Standard push-up': '/exercise-videos/standard-push-up.mp4',
    'Standing calf stretch': '/exercise-videos/standing-calf-stretch.mp4',
    'Standing hamstring stretch': '/exercise-videos/standing-hamstring-stretch.mp4',
    'Standing quad stretch': '/exercise-videos/standing-quad-stretch.mp4',
    'Split squat': '/exercise-videos/split-squat.mp4',
    'Squat-to-stand prying stretch': '/exercise-videos/squat-to-stand-prying-stretch.mp4',
    'Superman': '/exercise-videos/superman.mp4',
    'Thoracic open book rotation': '/exercise-videos/thoracic-open-book-rotation.mp4',
    'Tempo bodyweight squat': '/exercise-videos/pilots/tempo-bodyweight-squat-pilot.mp4?v=2',
    'Torso twists (standing)': '/exercise-videos/torso-twists-standing.mp4',
    'Wall calf stretch': '/exercise-videos/standing-calf-stretch.mp4',
    'Wall push-up': '/exercise-videos/wall-push-up.mp4',
    'Wall sit': '/exercise-videos/wall-sit.mp4',
    'Worlds greatest stretch': '/exercise-videos/worlds-greatest-stretch.mp4',
    "World's greatest stretch": '/exercise-videos/worlds-greatest-stretch.mp4',
    'Clamshell': '/exercise-videos/clamshell.mp4',
    'Banded clamshell': '/exercise-videos/clamshell.mp4',
    'Cross-body mountain climber': '/exercise-videos/cross-body-mountain-climber.mp4',
    'Donkey kick': '/exercise-videos/donkey-kick.mp4',
    'Fire hydrant': '/exercise-videos/fire-hydrant.mp4',
    'Heel taps': '/exercise-videos/heel-taps.mp4',
    'Lateral shuffle reach': '/exercise-videos/lateral-shuffle-reach.mp4',
    'Low-impact skater step': '/exercise-videos/low-impact-skater-step.mp4',
    'Reverse crunch': '/exercise-videos/reverse-crunch.mp4',
    'Slow mountain climber': '/exercise-videos/slow-mountain-climber.mp4',
    'Squat to calf raise': '/exercise-videos/squat-to-calf-raise.mp4',
    'Bear crawl': '/exercise-videos/bear-crawl.mp4',
    'Boxing cross-body combo': '/exercise-videos/boxing-cross-body-combo.mp4',
    'Child pose lat reach': '/exercise-videos/child-pose-lat-reach.mp4',
    'Couch stretch': '/exercise-videos/couch-stretch.mp4',
    'Inchworm to plank': '/exercise-videos/inchworm-to-plank.mp4',
    'Plank jack': '/exercise-videos/plank-jack.mp4',
    'Reverse lunge to knee drive': '/exercise-videos/reverse-lunge-to-knee-drive.mp4',
    'Skater hop': '/exercise-videos/skater-hop.mp4',
    'Squat thrust': '/exercise-videos/squat-thrust.mp4',
    'Step-back burpee': '/exercise-videos/step-back-burpee.mp4',
    '90/90 breathing reset': '/exercise-videos/90-90-breathing-reset.mp4',
    'Doorway pec stretch': '/exercise-videos/doorway-pec-stretch.mp4',
    'Hamstring strap stretch': '/exercise-videos/hamstring-strap-stretch.mp4',
    'Jog in place (fallback only)': '/exercise-videos/jog-in-place.mp4',
    'March in place (fallback only)': '/exercise-videos/march-in-place.mp4',
    'Shadow boxing (fallback only)': '/exercise-videos/shadow-boxing.mp4',
    'Stair walk (fallback only)': '/exercise-videos/stair-walk.mp4',
    'Step jacks (fallback only)': '/exercise-videos/step-jacks.mp4',
    'Supine twist': '/exercise-videos/supine-twist.mp4',
    'Thread-the-needle stretch': '/exercise-videos/thread-the-needle-stretch.mp4',
    'Treadmill walk-jog intervals (fallback only)': '/exercise-videos/treadmill-walk-jog-intervals.mp4',
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
            videoUrl: DEMO_VIDEO_URL_BY_EXERCISE_NAME[exercise.name] ?? null,
            targetLabel: exercise.targetReps != null ? `${exercise.targetReps} reps` : `${exercise.targetSeconds} seconds`,
        })),
    };
};

const parseRequestData = (data: unknown) => {
    if (!data) return {};

    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    return data as Record<string, unknown>;
};

const getRequestPath = (url?: string) => {
    if (!url) return '';

    try {
        const parsedUrl = new URL(url, 'http://demo.local');
        return parsedUrl.pathname.replace(/^\/api/, '') || '/';
    } catch {
        return url.split('?')[0].replace(/^\/api/, '');
    }
};

const getDayNumberFromDayId = (dayId: string | null | undefined) => {
    const normalized = dayId || 'day-1';
    const match = normalized.match(/day-(\d+)/i);
    const dayNumber = match ? Number(match[1]) : Number.parseInt(normalized, 10);

    return Number.isFinite(dayNumber) && dayNumber > 0 ? dayNumber : 1;
};

const getTargetParts = (target: string) => {
    const normalized = target.toLowerCase();
    const number = Number.parseInt(target.match(/\d+/)?.[0] ?? '', 10);

    if (normalized.includes('second') || normalized.includes(' sec')) {
        return {
            targetReps: null,
            targetSeconds: Number.isFinite(number) ? number : null,
        };
    }

    return {
        targetReps: target,
        targetSeconds: null,
    };
};

const buildDemoWorkoutDay = (dayId: string | null | undefined) => {
    const dayNumber = getDayNumberFromDayId(dayId);
    const plan = getMockPlan();
    const planDay = plan.days.find((day: any) => day.dayNumber === dayNumber) ?? plan.days[dayNumber - 1];
    const dayPlan = getCustomPlanDay(dayNumber);

    if (!dayPlan) {
        return null;
    }

    return {
        id: planDay?.id ?? dayId ?? `day-${dayNumber}`,
        dayNumber,
        title: `Day ${dayNumber}: ${dayPlan.title}`,
        isCompleted: Boolean(planDay?.isCompleted),
        completedAt: planDay?.completedAt ?? null,
        exercises: dayPlan.exercises.map((exercise) => {
            const targetParts = getTargetParts(exercise.reps);

            return {
                id: exercise.id,
                exerciseId: exercise.id,
                exercise: {
                    id: exercise.id,
                    name: exercise.name,
                    description: 'Guided exercise from your body-part plan.',
                    videoUrl: DEMO_VIDEO_URL_BY_EXERCISE_NAME[exercise.name] ?? null,
                    difficulty: 'beginner',
                    muscleGroup: exercise.muscleGroup,
                },
                targetSets: typeof exercise.sets === 'string' ? 1 : exercise.sets,
                targetReps: targetParts.targetReps,
                targetSeconds: targetParts.targetSeconds,
                targetRestSeconds: exercise.type === 'stretching' || exercise.type === 'warmup' ? 15 : 35,
                logs: [],
            };
        }),
    };
};

const createDemoAxiosResponse = (config: any, data: unknown, status = 200, statusText = 'OK') => ({
    data,
    status,
    statusText,
    headers: {},
    config,
    request: {},
});

const createDemoAxiosError = (config: any, status: number, data: unknown) => Promise.reject({
    config,
    response: createDemoAxiosResponse(config, data, status, status === 404 ? 'Not Found' : 'Error'),
});

if (DEMO_MODE_ENABLED) {
    api.interceptors.request.use((config) => {
        config.adapter = async () => {
            await new Promise(resolve => setTimeout(resolve, 180));

            const path = getRequestPath(config.url);
            const method = (config.method || 'get').toLowerCase();
            const requestData = parseRequestData(config.data) as Record<string, any>;

            if (path === '/auth/login' && method === 'post') {
                const email = requestData.email as string;
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
                    return createDemoAxiosError(config, 404, { error: 'account_not_found' });
                }

                return createDemoAxiosResponse(config, buildDemoAuthPayload(account));
            }

            if (path === '/auth/signup' && method === 'post') {
                const email = requestData.email as string;
                const existingAccount = findDemoAccount(email);

                if (existingAccount) {
                    return createDemoAxiosResponse(
                        config,
                        buildDemoAuthPayload(
                            existingAccount,
                            existingAccount.hasProfile
                                ? 'Account already exists. We opened onboarding so you can update your plan.'
                                : 'Account already exists. Continue onboarding to build your plan.',
                            'onboarding',
                        ),
                    );
                }

                const createdAccount = upsertDemoAccount(email, false);
                return createDemoAxiosResponse(
                    config,
                    buildDemoAuthPayload(
                        createdAccount,
                        'Account created. Continue onboarding to build your plan.',
                    ),
                );
            }

            if (path === '/profile' && method === 'post') {
                localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(requestData));
                localStorage.removeItem('demo_plan');
                markDemoProfileComplete();
                return createDemoAxiosResponse(config, { success: true, profileExists: true, plan: getMockPlan() });
            }

            if (path === '/workout/plan/current' && method === 'get') {
                return createDemoAxiosResponse(config, { plan: getMockPlan(), profileExists: true });
            }

            if (path === '/workout/focus' && method === 'get') {
                const focusKey = config.params?.focusKey || 'full-body';
                return createDemoAxiosResponse(config, { focusWorkout: getMockFocusWorkout(focusKey) });
            }

            if (path === '/workout/day/log' && method === 'post') {
                return createDemoAxiosResponse(config, {
                    log: {
                        id: `mock-log-${Date.now()}`,
                        setNumber: requestData.setNumber,
                        reps: requestData.reps,
                        weight: requestData.weight,
                        isDone: true,
                    },
                });
            }

            if (path === '/workout/day' && method === 'get') {
                const dayIdFromParams = config.params?.dayId;
                const dayIdFromQuery = config.url?.includes('?')
                    ? new URL(config.url, 'http://demo.local').searchParams.get('dayId')
                    : null;
                const workoutDay = buildDemoWorkoutDay(dayIdFromParams || dayIdFromQuery);

                return createDemoAxiosResponse(config, { workoutDay });
            }

            if (path === '/workout/day/complete' && method === 'post') {
                const dayId = requestData.dayId;
                if (dayId) updateMockDayComplete(dayId);
                return createDemoAxiosResponse(config, { success: true });
            }

            return createDemoAxiosError(config, 404, { error: 'demo_route_not_found', path });
        };

        return config;
    });
}
