export interface CustomExercise {
    id: string;
    name: string;
    sets: number | string;
    reps: string;
    type: 'warmup' | 'strength' | 'core' | 'stretching' | 'rest';
    muscleGroup: string;
}

export interface DayPlan {
    day: number;
    title: string;
    exercises: CustomExercise[];
}

type SplitKey =
    | 'glutes-thighs'
    | 'arms-chest'
    | 'waist-core'
    | 'glutes-hamstrings'
    | 'full-body-cardio';

const WEEKLY_SPLITS: Record<3 | 4 | 5, SplitKey[]> = {
    3: ['glutes-thighs', 'arms-chest', 'full-body-cardio'],
    4: ['glutes-thighs', 'arms-chest', 'waist-core', 'glutes-hamstrings'],
    5: ['glutes-thighs', 'arms-chest', 'waist-core', 'glutes-hamstrings', 'full-body-cardio'],
};

export interface PlanPreferences {
    goal?: string;
    equipment?: string | string[];
    experienceLevel?: string;
    intensityPreference?: string;
}

const parseEquipment = (value?: string | string[]) => {
    if (Array.isArray(value)) return value;
    if (!value) return ['No equipment'];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [String(value)];
    } catch {
        return value.split(/[;,]/).map(item => item.trim()).filter(Boolean);
    }
};

const NO_EQUIPMENT_REPLACEMENTS: Record<string, string> = {
    'Goblet squat': 'Wall sit',
    'Band pull-apart': 'Prone W raise',
    'Dumbbell floor press': 'Knee push-up',
    'Dumbbell shoulder press': 'Pike push-up',
    'Band row': 'Prone W raise',
    'Pallof press': 'Dead bug',
    'Dumbbell Romanian deadlift': 'Single-leg bodyweight Romanian deadlift',
};

const FULL_GYM_REPLACEMENTS: Record<string, string> = {
    'Tempo bodyweight squat': 'Dumbbell goblet squat',
    'Goblet squat': 'Kettlebell goblet squat',
    'Reverse lunge': 'Dumbbell walking lunge',
    'Low step-up': 'Dumbbell step-up',
    'Glute bridge': 'Dumbbell glute bridge',
    'Incline push-up': 'Dumbbell floor press',
    'Dumbbell floor press': 'Dumbbell bench press',
    'Band row': 'One-arm dumbbell row',
    'Chair triceps dips': 'Dumbbell triceps extension',
    'Hip thrust': 'Dumbbell hip thrust',
    'Clamshell': 'Banded clamshell',
};

const personalizeExercise = (exercise: CustomExercise, preferences: PlanPreferences): CustomExercise => {
    const equipment = parseEquipment(preferences.equipment);
    const fullGym = equipment.includes('Full gym access');
    const bodyweightOnly = equipment.includes('No equipment');
    const goal = (preferences.goal || '').toLowerCase();
    const experience = (preferences.experienceLevel || '').toLowerCase();
    const intensity = preferences.intensityPreference || 'Moderate';
    const replacement = fullGym
        ? FULL_GYM_REPLACEMENTS[exercise.name]
        : bodyweightOnly ? NO_EQUIPMENT_REPLACEMENTS[exercise.name] : undefined;

    let sets = exercise.sets;
    let reps = exercise.reps;
    if (exercise.type === 'strength' || exercise.type === 'core') {
        const baseSets = typeof sets === 'number' ? sets : Number.parseInt(String(sets), 10) || 2;
        if (goal.includes('muscle') || goal.includes('shape')) {
            sets = Math.min(3, baseSets + (experience.includes('beginner') ? 0 : 1));
            reps = '8-12';
        } else if (goal.includes('strong')) {
            sets = Math.min(3, baseSets + 1);
            reps = fullGym ? '5-8' : '6-10';
        } else if (goal.includes('fat') || goal.includes('conditioning')) {
            sets = Math.max(2, baseSets);
            reps = reps.includes('seconds') ? (intensity === 'Hard' ? '40 seconds' : '30 seconds') : '12-15';
        }
    }

    if (replacement === 'Wall sit') reps = intensity === 'Hard' ? '45 seconds' : '30 seconds';

    return { ...exercise, name: replacement || exercise.name, sets: typeof sets === 'number' ? Math.min(3, sets) : sets, reps };
};

const TRAINING_DAY_POSITIONS: Record<3 | 4 | 5, number[]> = {
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
};

const REST_DAY: DayPlan = {
    day: 0,
    title: 'Rest Day',
    exercises: [],
};

const BODY_PART_WORKOUTS: Record<SplitKey, Omit<DayPlan, 'day'>> = {
    'glutes-thighs': {
        title: 'Glutes + Thighs',
        exercises: [
            { id: 'gt-w1', name: '90/90 hip switches', sets: 1, reps: '8 reps/side', type: 'warmup', muscleGroup: 'hips' },
            { id: 'gt-w2', name: 'Hip circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'hips' },
            { id: 'gt-w3', name: 'Squat-to-stand prying stretch', sets: 1, reps: '8 reps', type: 'warmup', muscleGroup: 'legs' },
            { id: 'gt-w4', name: 'Lateral lunge reach', sets: 1, reps: '8 reps/side', type: 'warmup', muscleGroup: 'thighs' },
            { id: 'gt-m1', name: 'Tempo bodyweight squat', sets: 3, reps: '10-12', type: 'strength', muscleGroup: 'thighs' },
            { id: 'gt-m2', name: 'Goblet squat', sets: 3, reps: '10-12', type: 'strength', muscleGroup: 'thighs' },
            { id: 'gt-m3', name: 'Reverse lunge', sets: 3, reps: '8-10/side', type: 'strength', muscleGroup: 'glutes' },
            { id: 'gt-m4', name: 'Low step-up', sets: 2, reps: '10/side', type: 'strength', muscleGroup: 'thighs' },
            { id: 'gt-m5', name: 'Glute bridge', sets: 3, reps: '12-15', type: 'strength', muscleGroup: 'glutes' },
            { id: 'gt-s1', name: 'Standing quad stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'thighs' },
            { id: 'gt-s2', name: 'Hip flexor lunge stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'hips' },
            { id: 'gt-s3', name: 'Figure four glute stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'glutes' },
        ],
    },
    'arms-chest': {
        title: 'Arms + Chest',
        exercises: [
            { id: 'ac-w1', name: 'Arm circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'shoulders' },
            { id: 'ac-w2', name: 'Shoulder rolls', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'shoulders' },
            { id: 'ac-w3', name: 'Scapular wall slides', sets: 1, reps: '10 reps', type: 'warmup', muscleGroup: 'posture' },
            { id: 'ac-w4', name: 'Band pull-apart', sets: 1, reps: '12 reps', type: 'warmup', muscleGroup: 'upper body' },
            { id: 'ac-m1', name: 'Incline push-up', sets: 3, reps: '8-10', type: 'strength', muscleGroup: 'chest' },
            { id: 'ac-m2', name: 'Dumbbell floor press', sets: 3, reps: '10-12', type: 'strength', muscleGroup: 'chest' },
            { id: 'ac-m3', name: 'Dumbbell shoulder press', sets: 3, reps: '10-12', type: 'strength', muscleGroup: 'arms' },
            { id: 'ac-m4', name: 'Band row', sets: 3, reps: '10-12', type: 'strength', muscleGroup: 'back' },
            { id: 'ac-m5', name: 'Chair triceps dips', sets: 2, reps: '8-10', type: 'strength', muscleGroup: 'arms' },
            { id: 'ac-s1', name: 'Chest stretch against wall', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'chest' },
            { id: 'ac-s2', name: 'Shoulder cross-body stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'shoulders' },
            { id: 'ac-s3', name: "Child's pose", sets: 1, reps: '45 seconds', type: 'stretching', muscleGroup: 'back' },
        ],
    },
    'waist-core': {
        title: 'Waist + Core',
        exercises: [
            { id: 'wc-w1', name: 'Cat-cow spinal flow', sets: 1, reps: '10 reps', type: 'warmup', muscleGroup: 'spine' },
            { id: 'wc-w2', name: 'Thoracic open book rotation', sets: 1, reps: '8 reps/side', type: 'warmup', muscleGroup: 'spine' },
            { id: 'wc-w3', name: 'Dead bug activation', sets: 1, reps: '8 reps/side', type: 'warmup', muscleGroup: 'core' },
            { id: 'wc-w4', name: 'Bird dog reach', sets: 1, reps: '8 reps/side', type: 'warmup', muscleGroup: 'core' },
            { id: 'wc-m1', name: 'Pilates hundred', sets: 3, reps: '30 seconds', type: 'core', muscleGroup: 'waist' },
            { id: 'wc-m2', name: 'Heel taps', sets: 3, reps: '10-12/side', type: 'core', muscleGroup: 'waist' },
            { id: 'wc-m3', name: 'Modified Pilates roll-up', sets: 2, reps: '8-10', type: 'core', muscleGroup: 'core' },
            { id: 'wc-m4', name: 'Side plank', sets: 2, reps: '20-30 seconds/side', type: 'core', muscleGroup: 'waist' },
            { id: 'wc-m5', name: 'Pallof press', sets: 3, reps: '10/side', type: 'core', muscleGroup: 'core' },
            { id: 'wc-s1', name: 'Child pose lat reach', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'waist' },
            { id: 'wc-s2', name: 'Supine twist', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'spine' },
            { id: 'wc-s3', name: 'Thread-the-needle stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'spine' },
        ],
    },
    'glutes-hamstrings': {
        title: 'Glutes + Hamstrings',
        exercises: [
            { id: 'gh-w1', name: 'Hip hinge drill', sets: 1, reps: '10 reps', type: 'warmup', muscleGroup: 'hamstrings' },
            { id: 'gh-w2', name: 'Glute bridge march activation', sets: 1, reps: '10/side', type: 'warmup', muscleGroup: 'glutes' },
            { id: 'gh-w3', name: 'Ankle rocks', sets: 1, reps: '10/side', type: 'warmup', muscleGroup: 'ankles' },
            { id: 'gh-w4', name: 'Hamstring walkout', sets: 1, reps: '6 reps', type: 'warmup', muscleGroup: 'hamstrings' },
            { id: 'gh-m1', name: 'Hip thrust', sets: 3, reps: '10-12', type: 'strength', muscleGroup: 'glutes' },
            { id: 'gh-m2', name: 'Dumbbell Romanian deadlift', sets: 3, reps: '10-12', type: 'strength', muscleGroup: 'hamstrings' },
            { id: 'gh-m3', name: 'Single-leg glute bridge', sets: 2, reps: '8-10/side', type: 'strength', muscleGroup: 'glutes' },
            { id: 'gh-m4', name: 'Hamstring walkout', sets: 2, reps: '6-8', type: 'strength', muscleGroup: 'hamstrings' },
            { id: 'gh-m5', name: 'Clamshell', sets: 2, reps: '12-15/side', type: 'strength', muscleGroup: 'glutes' },
            { id: 'gh-s1', name: 'Hamstring strap stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'hamstrings' },
            { id: 'gh-s2', name: 'Figure four glute stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'glutes' },
            { id: 'gh-s3', name: 'Wall calf stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'calves' },
        ],
    },
    'full-body-cardio': {
        title: 'Full Body + Cardio',
        exercises: [
            { id: 'fb-w1', name: 'Inchworm walkout', sets: 1, reps: '6 reps', type: 'warmup', muscleGroup: 'full body' },
            { id: 'fb-w2', name: 'Arm swings', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'shoulders' },
            { id: 'fb-w3', name: 'Hip circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'hips' },
            { id: 'fb-w4', name: 'Low-impact jumping jacks', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'cardio' },
            { id: 'fb-m1', name: 'Squat to calf raise', sets: 3, reps: '12 reps', type: 'strength', muscleGroup: 'legs' },
            { id: 'fb-m2', name: 'Step-back burpee', sets: 3, reps: '30 seconds', type: 'strength', muscleGroup: 'full body' },
            { id: 'fb-m3', name: 'Boxing cross-body combo', sets: 3, reps: '30 seconds', type: 'strength', muscleGroup: 'cardio' },
            { id: 'fb-m4', name: 'Plank shoulder tap', sets: 2, reps: '10/side', type: 'core', muscleGroup: 'core' },
            { id: 'fb-m5', name: 'Low-impact skater step', sets: 3, reps: '30 seconds', type: 'strength', muscleGroup: 'cardio' },
            { id: 'fb-s1', name: 'Worlds greatest stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'full body' },
            { id: 'fb-s2', name: "Child's pose", sets: 1, reps: '45 seconds', type: 'stretching', muscleGroup: 'back' },
            { id: 'fb-s3', name: 'Standing hamstring stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'hamstrings' },
        ],
    },
};

export const getTrainingDaysFromProfile = (recentConsistency?: string): 3 | 4 | 5 => {
    const normalized = (recentConsistency || '').toLowerCase();
    const explicit = normalized.match(/\b([3-5])\s*\+?\s*days?/);
    if (explicit) return Number(explicit[1]) as 3 | 4 | 5;
    if (normalized.includes('3')) return 3;
    if (normalized.includes('4')) return 4;
    return 5;
};

export const getBodyPartPlanForDay = (
    dayNumber: number,
    trainingDays: 3 | 4 | 5 = 5,
    preferences: PlanPreferences = {},
): DayPlan => {
    const dayInWeek = ((dayNumber - 1) % 7) + 1;
    const trainingPositions = TRAINING_DAY_POSITIONS[trainingDays];
    const splitIndex = trainingPositions.indexOf(dayInWeek);

    if (splitIndex === -1) {
        return {
            ...REST_DAY,
            day: dayNumber,
        };
    }

    const splitKey = WEEKLY_SPLITS[trainingDays][splitIndex];
    const workout = BODY_PART_WORKOUTS[splitKey];

    return {
        day: dayNumber,
        title: workout.title,
        exercises: workout.exercises.map((exercise) => personalizeExercise({
            ...exercise,
            id: `d${dayNumber}-${exercise.id}`,
        }, preferences)),
    };
};
