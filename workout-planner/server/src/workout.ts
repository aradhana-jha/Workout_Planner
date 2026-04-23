import { Router, Request, Response } from 'express';
import { PrismaClient, type Exercise, type Profile } from '../generated/client';
import { z } from 'zod';
import { authMiddleware } from './auth';

const prisma = new PrismaClient();
const router = Router();
type FocusKey = 'full-body' | 'abs' | 'legs' | 'butt' | 'arms';

const FOCUS_CONFIG: Record<FocusKey, { label: string; summary: string }> = {
    'full-body': {
        label: 'Full Body Workout',
        summary: 'Balanced full-body work with push, pull, legs, and core.'
    },
    abs: {
        label: 'Abs Workout',
        summary: 'Core-focused work with bracing, anti-rotation, and controlled holds.'
    },
    legs: {
        label: 'Legs Workout',
        summary: 'Lower-body work built around squats, hinges, lunges, and step patterns.'
    },
    butt: {
        label: 'Butt Workout',
        summary: 'Glute-focused work with bridges, hinges, thrusts, and split-stance patterns.'
    },
    arms: {
        label: 'Arms Workout',
        summary: 'Upper-body work with presses, rows, pull patterns, and arm-driven movements.'
    },
};

const FOCUS_KEYS = Object.keys(FOCUS_CONFIG) as FocusKey[];

function titleCase(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseStringArray(value: string | null | undefined) {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

function getUserId(req: Request) {
    return (req as any).user.userId as string;
}

function getDifficultyRank(level: string | null | undefined) {
    const normalized = (level ?? '').trim().toLowerCase();
    if (normalized === 'beginner') return 0;
    if (normalized === 'intermediate') return 1;
    if (normalized === 'advanced') return 2;
    return 1;
}

function getUserExperienceRank(experienceLevel: string) {
    const normalized = experienceLevel.trim().toLowerCase();
    if (normalized.startsWith('beginner')) return 0;
    if (normalized.startsWith('some')) return 1;
    if (normalized.startsWith('intermediate')) return 2;
    if (normalized.startsWith('advanced')) return 3;
    return 1;
}

function getSetCount(profile: Profile) {
    const rank = getUserExperienceRank(profile.experienceLevel);
    if (rank <= 0) return 2;
    if (rank === 1) return 3;
    return 4;
}

function getRestSeconds(profile: Profile) {
    const rank = getUserExperienceRank(profile.experienceLevel);
    if (rank <= 0) return 60;
    if (rank === 1) return 50;
    if (rank === 2) return 45;
    return 40;
}

function getExerciseCount(timePerWorkout: number) {
    if (timePerWorkout <= 15) return 4;
    if (timePerWorkout <= 25) return 5;
    if (timePerWorkout <= 40) return 6;
    return 8;
}

function getProfileSummary(profile: Profile) {
    return `${titleCase(profile.experienceLevel)} • ${profile.timePerWorkout} min sessions`;
}

function filterExercisesForProfile(exercises: Exercise[], profile: Profile) {
    const userEquipment = parseStringArray(profile.equipment);
    const painAreas = parseStringArray(profile.painAreas);
    const movementRestrictions = parseStringArray(profile.movementRestrictions);
    const preferenceExclusions = parseStringArray(profile.preferenceExclusions);

    return exercises.filter((exercise) => {
        const equipmentTags = parseStringArray(exercise.equipmentTags);
        const avoidFlags = parseStringArray(exercise.avoidModifyFlags);
        const exclusionFlags = parseStringArray(exercise.preferenceExclusionFlags);

        if (equipmentTags.length > 0) {
            const hasNoEquipment = equipmentTags.includes('No equipment');
            const hasMatchingEquipment = equipmentTags.some((tag) => userEquipment.includes(tag));
            if (!hasNoEquipment && !hasMatchingEquipment) {
                return false;
            }
        }

        if (!painAreas.includes('None')) {
            for (const pain of painAreas) {
                if (avoidFlags.includes(pain)) {
                    return false;
                }
            }
        }

        for (const restriction of movementRestrictions) {
            if (restriction === 'None') continue;

            if (restriction === 'Squatting down is difficult') {
                if (exercise.movementPattern === 'Squat' && !exercise.name.toLowerCase().includes('chair') && !exercise.name.toLowerCase().includes('sit-to-stand')) {
                    return false;
                }
            }

            if (restriction === 'Lunges are difficult' && exercise.movementPattern.toLowerCase().includes('lunge')) {
                return false;
            }

            if (restriction === 'Push-ups are difficult') {
                const lowerName = exercise.name.toLowerCase();
                if (lowerName.includes('push-up') && !lowerName.includes('wall') && !lowerName.includes('incline')) {
                    return false;
                }
            }

            if (restriction === 'Pull-ups are difficult') {
                const lowerName = exercise.name.toLowerCase();
                if (lowerName.includes('pull-up') && !lowerName.includes('dead hang')) {
                    return false;
                }
            }

            if ((restriction === 'Jumping is difficult' || restriction === 'Running is difficult') && exercise.impactLevel === 'high') {
                return false;
            }
        }

        if (!preferenceExclusions.includes('None')) {
            for (const exclusion of preferenceExclusions) {
                const lowerName = exercise.name.toLowerCase();
                if (exclusionFlags.includes(exclusion)) {
                    return false;
                }

                if (exclusion === 'Running' && lowerName.includes('run')) {
                    return false;
                }

                if (exclusion === 'Jumping' && (exercise.impactLevel === 'high' || lowerName.includes('jump'))) {
                    return false;
                }

                if (exclusion === 'Burpees' && lowerName.includes('burpee')) {
                    return false;
                }
            }
        }

        return true;
    });
}

function matchesFocus(exercise: Exercise, focusKey: FocusKey) {
    const focusAreas = parseStringArray(exercise.focusAreaTags);
    const lowerName = exercise.name.toLowerCase();
    const lowerPattern = exercise.movementPattern.toLowerCase();
    const isStrength = exercise.workoutType === 'Strength training';

    if (focusKey === 'full-body') {
        return exercise.workoutType !== 'Mobility and recovery';
    }

    if (focusKey === 'abs') {
        return focusAreas.includes('Core')
            || lowerPattern.includes('core')
            || lowerName.includes('plank')
            || lowerName.includes('dead bug')
            || lowerName.includes('bird dog')
            || lowerName.includes('hollow')
            || lowerName.includes('pallof');
    }

    if (focusKey === 'legs') {
        return focusAreas.includes('Glutes and legs')
            || ['squat', 'lunge', 'hinge'].some((value) => lowerPattern.includes(value))
            || lowerPattern.includes('step');
    }

    if (focusKey === 'butt') {
        return focusAreas.includes('Glutes and legs')
            && (
                lowerName.includes('glute')
                || lowerName.includes('bridge')
                || lowerName.includes('thrust')
                || lowerPattern.includes('hinge')
                || lowerName.includes('romanian deadlift')
                || lowerName.includes('deadlift')
                || lowerName.includes('split squat')
                || lowerName.includes('lunge')
                || lowerName.includes('step-up')
            );
    }

    return isStrength
        && (
            focusAreas.includes('Chest and arms')
            || lowerPattern.includes('push')
            || lowerPattern.includes('pull')
            || lowerName.includes('press')
            || lowerName.includes('row')
            || lowerName.includes('dip')
            || lowerName.includes('pull-up')
            || lowerName.includes('chin-up')
        );
}

function scoreFocusExercise(exercise: Exercise, profile: Profile, focusKey: FocusKey) {
    let score = 50;
    const focusAreas = parseStringArray(exercise.focusAreaTags);
    const lowerName = exercise.name.toLowerCase();
    const lowerPattern = exercise.movementPattern.toLowerCase();

    if (exercise.workoutType === 'Strength training') {
        score += 12;
    }

    if (focusKey === 'full-body') {
        if (['squat', 'hinge', 'push', 'pull', 'lunge', 'core'].some((value) => lowerPattern.includes(value))) {
            score += 16;
        }
        if (focusAreas.includes('Full body balance')) {
            score += 12;
        }
    }

    if (focusKey === 'abs' && (focusAreas.includes('Core') || lowerPattern.includes('core'))) {
        score += 24;
    }

    if (focusKey === 'legs' && focusAreas.includes('Glutes and legs')) {
        score += 24;
    }

    if (focusKey === 'butt') {
        if (lowerName.includes('glute') || lowerName.includes('bridge') || lowerName.includes('thrust')) {
            score += 28;
        }
        if (lowerPattern.includes('hinge')) {
            score += 12;
        }
    }

    if (focusKey === 'arms' && focusAreas.includes('Chest and arms')) {
        score += 22;
    }

    if (profile.goal === 'Build muscle' || profile.goal === 'Get stronger') {
        if (exercise.workoutType === 'Strength training') {
            score += 10;
        }
    }

    if (profile.goal === 'Improve stamina' || profile.goal === 'Lose body fat') {
        if (exercise.workoutType === 'Cardio conditioning') {
            score += 6;
        }
    }

    const difficultyGap = getDifficultyRank(exercise.difficultyMax) - Math.min(getUserExperienceRank(profile.experienceLevel), 2);
    if (difficultyGap > 0) {
        score -= difficultyGap * 8;
    }

    if (profile.intensityPreference === 'Easy' && exercise.impactLevel === 'high') {
        score -= 12;
    }

    if (profile.workoutStylePreference === 'Mostly cardio' && exercise.workoutType === 'Cardio conditioning') {
        score += 10;
    }

    if (profile.workoutStylePreference === 'Mostly strength training' && exercise.workoutType === 'Strength training') {
        score += 10;
    }

    return score;
}

function buildExerciseTarget(exercise: Exercise, profile: Profile) {
    const lowerName = exercise.name.toLowerCase();
    const lowerPattern = exercise.movementPattern.toLowerCase();
    const sets = getSetCount(profile);
    const restSeconds = getRestSeconds(profile);
    const experienceRank = getUserExperienceRank(profile.experienceLevel);

    const isHold = lowerName.includes('plank')
        || lowerName.includes('hold')
        || lowerName.includes('dead hang')
        || lowerName.includes('wall sit');

    if (exercise.workoutType === 'Mobility and recovery') {
        const seconds = profile.timePerWorkout <= 25 ? 35 : 45;
        return { sets: 2, seconds, restSeconds: 20, targetLabel: `2 x ${seconds}s` };
    }

    if (exercise.workoutType === 'Cardio conditioning') {
        const seconds = experienceRank <= 1 ? 30 : experienceRank === 2 ? 40 : 45;
        return { sets: sets - 1, seconds, restSeconds: 25, targetLabel: `${Math.max(2, sets - 1)} rounds x ${seconds}s` };
    }

    if (isHold || lowerPattern.includes('core')) {
        const seconds = experienceRank <= 1 ? 30 : experienceRank === 2 ? 40 : 45;
        return { sets, seconds, restSeconds, targetLabel: `${sets} x ${seconds}s` };
    }

    const reps = experienceRank <= 0 ? 10 : experienceRank === 1 ? 12 : experienceRank === 2 ? 10 : 8;
    return { sets, reps, restSeconds, targetLabel: `${sets} x ${reps} reps` };
}

function transformSuggestedExercise(exercise: Exercise, profile: Profile) {
    const focusAreas = parseStringArray(exercise.focusAreaTags);
    const target = buildExerciseTarget(exercise, profile);
    const difficultyMin = titleCase(exercise.difficultyMin);
    const difficultyMax = titleCase(exercise.difficultyMax);

    return {
        id: exercise.id,
        name: exercise.name,
        muscleGroup: titleCase(focusAreas[0] ?? exercise.movementPattern ?? 'Full body'),
        difficulty: difficultyMin === difficultyMax ? difficultyMin : `${difficultyMin} - ${difficultyMax}`,
        videoUrl: exercise.videoUrl,
        description: exercise.description ?? exercise.notes ?? '',
        ...target,
    };
}

function selectFocusExercises(exercises: Exercise[], profile: Profile, focusKey: FocusKey) {
    const limit = getExerciseCount(profile.timePerWorkout);
    const ranked = exercises
        .filter((exercise) => matchesFocus(exercise, focusKey))
        .map((exercise) => ({ exercise, score: scoreFocusExercise(exercise, profile, focusKey) }))
        .sort((left, right) => right.score - left.score);

    if (focusKey !== 'full-body') {
        return ranked.slice(0, limit).map((entry) => entry.exercise);
    }

    const buckets = [
        (exercise: Exercise) => {
            const pattern = exercise.movementPattern.toLowerCase();
            return pattern.includes('squat') || pattern.includes('lunge') || pattern.includes('step');
        },
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('hinge'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('push'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('pull'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('core') || exercise.name.toLowerCase().includes('plank'),
        (exercise: Exercise) => exercise.workoutType === 'Cardio conditioning',
    ];

    const selected: Exercise[] = [];
    for (const matcher of buckets) {
        const match = ranked.find((entry) => matcher(entry.exercise) && !selected.some((exercise) => exercise.id === entry.exercise.id));
        if (match) {
            selected.push(match.exercise);
        }
        if (selected.length >= limit) {
            break;
        }
    }

    for (const entry of ranked) {
        if (selected.length >= limit) {
            break;
        }
        if (!selected.some((exercise) => exercise.id === entry.exercise.id)) {
            selected.push(entry.exercise);
        }
    }

    return selected;
}

async function getProfileForUser(userId: string) {
    return prisma.profile.findUnique({
        where: { userId }
    });
}

async function buildFocusWorkout(userId: string, focusKey: FocusKey) {
    const profile = await getProfileForUser(userId);
    if (!profile) {
        return null;
    }

    const exercises = await prisma.exercise.findMany();
    const allowedPool = filterExercisesForProfile(exercises, profile);
    const selected = selectFocusExercises(allowedPool, profile, focusKey);
    const config = FOCUS_CONFIG[focusKey];

    return {
        key: focusKey,
        label: config.label,
        summary: config.summary,
        profileSummary: getProfileSummary(profile),
        estimatedMinutes: profile.timePerWorkout,
        experienceLevel: titleCase(profile.experienceLevel),
        exercises: selected.map((exercise) => transformSuggestedExercise(exercise, profile)),
    };
}

async function getPlanForUser(userId: string) {
    return prisma.plan.findFirst({
        where: { userId, status: 'active' },
        include: {
            days: {
                orderBy: { dayNumber: 'asc' },
                select: {
                    id: true,
                    dayNumber: true,
                    weekNumber: true,
                    dayType: true,
                    estimatedMinutes: true,
                    isOptional: true,
                    isCompleted: true,
                    completedAt: true
                }
            }
        }
    });
}

function transformPlan(plan: Awaited<ReturnType<typeof getPlanForUser>>) {
    if (!plan) {
        return null;
    }

    return {
        ...plan,
        days: plan.days.map(day => ({
            ...day,
            title: day.dayType === 'Rest' ? 'Rest Day' : `${day.dayType} (${day.estimatedMinutes} min)`
        }))
    };
}

async function getWorkoutDayForUser(userId: string, dayId: string) {
    return prisma.workoutDay.findFirst({
        where: {
            id: dayId,
            plan: { userId }
        },
        include: {
            exercises: {
                orderBy: { sortOrder: 'asc' },
                include: {
                    exercise: true,
                    logs: { orderBy: { setNumber: 'asc' } }
                }
            }
        }
    });
}

function transformWorkoutDay(workoutDay: Awaited<ReturnType<typeof getWorkoutDayForUser>>) {
    if (!workoutDay) {
        return null;
    }

    return {
        ...workoutDay,
        title: workoutDay.dayType === 'Rest' ? 'Rest Day' : `Day ${workoutDay.dayNumber}: ${workoutDay.dayType}`,
        exercises: workoutDay.exercises.map((workoutExercise) => {
            const focusAreas = parseStringArray(workoutExercise.exercise.focusAreaTags);
            const difficultyMin = titleCase(workoutExercise.exercise.difficultyMin);
            const difficultyMax = titleCase(workoutExercise.exercise.difficultyMax);

            return {
                ...workoutExercise,
                exercise: {
                    id: workoutExercise.exercise.id,
                    name: workoutExercise.exercise.name,
                    description: workoutExercise.exercise.description ?? workoutExercise.exercise.notes ?? '',
                    videoUrl: workoutExercise.exercise.videoUrl,
                    difficulty: difficultyMin === difficultyMax ? difficultyMin : `${difficultyMin} - ${difficultyMax}`,
                    muscleGroup: titleCase(focusAreas[0] ?? workoutExercise.exercise.movementPattern ?? 'Full body'),
                },
            };
        }),
    };
}

// Get Current Plan
router.get('/plan/current', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const plan = await getPlanForUser(getUserId(req));
    res.json({ plan: transformPlan(plan) });
});

router.get('/focus/:focusKey', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const focusKey = req.params.focusKey as FocusKey;
    if (!FOCUS_KEYS.includes(focusKey)) {
        res.status(400).json({ error: 'Invalid focus key' });
        return;
    }

    const focusWorkout = await buildFocusWorkout(getUserId(req), focusKey);
    if (!focusWorkout) {
        res.status(404).json({ error: 'Profile not found' });
        return;
    }

    res.json({ focusWorkout });
});

async function handleGetWorkoutDay(req: Request, res: Response, dayId: string): Promise<void> {
    const workoutDay = await getWorkoutDayForUser(getUserId(req), dayId);
    res.json({ workoutDay: transformWorkoutDay(workoutDay) });
}

router.get('/day', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const dayId = typeof req.query.dayId === 'string' ? req.query.dayId : undefined;
    if (!dayId) {
        res.status(400).json({ error: 'dayId is required' });
        return;
    }

    await handleGetWorkoutDay(req, res, dayId);
});

// Get Workout Day Details
router.get('/day/:dayId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    await handleGetWorkoutDay(req, res, req.params.dayId);
});

// Log Set
const logSchema = z.object({
    exerciseId: z.string(),
    setNumber: z.number(),
    reps: z.number(),
    weight: z.number().nullable().optional(),
});

async function handleLogSet(req: Request, res: Response, dayId: string): Promise<void> {
    try {
        const { exerciseId, setNumber, reps, weight } = logSchema.parse(req.body);

        const workoutExercise = await prisma.workoutExercise.findFirst({
            where: {
                workoutDayId: dayId,
                exerciseId,
                workoutDay: {
                    plan: { userId: getUserId(req) }
                }
            }
        });

        if (!workoutExercise) {
            res.status(404).json({ error: 'Exercise not found in this workout' });
            return;
        }

        // Upsert Log
        const log = await prisma.exerciseLog.findFirst({
            where: { workoutExerciseId: workoutExercise.id, setNumber }
        });

        let result;
        if (log) {
            result = await prisma.exerciseLog.update({
                where: { id: log.id },
                data: { reps, weight, isDone: true }
            });
        } else {
            result = await prisma.exerciseLog.create({
                data: {
                    workoutExerciseId: workoutExercise.id,
                    setNumber,
                    reps,
                    weight,
                    isDone: true
                }
            });
        }

        res.json({ log: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

router.post('/day/log', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const dayId = typeof req.body.dayId === 'string' ? req.body.dayId : undefined;
    if (!dayId) {
        res.status(400).json({ error: 'dayId is required' });
        return;
    }

    await handleLogSet(req, res, dayId);
});

router.post('/day/:dayId/log', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    await handleLogSet(req, res, req.params.dayId);
});

// Complete Day
async function handleCompleteDay(req: Request, res: Response, dayId: string): Promise<void> {
    const workoutDay = await prisma.workoutDay.findFirst({
        where: {
            id: dayId,
            plan: { userId: getUserId(req) }
        },
        select: { id: true }
    });

    if (!workoutDay) {
        res.status(404).json({ error: 'Workout day not found' });
        return;
    }

    await prisma.workoutDay.update({
        where: { id: workoutDay.id },
        data: { isCompleted: true, completedAt: new Date() }
    });

    res.json({ message: 'Day completed' });
}

router.post('/day/complete', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const dayId = typeof req.body.dayId === 'string' ? req.body.dayId : undefined;
    if (!dayId) {
        res.status(400).json({ error: 'dayId is required' });
        return;
    }

    await handleCompleteDay(req, res, dayId);
});

router.post('/day/:dayId/complete', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    await handleCompleteDay(req, res, req.params.dayId);
});

export default router;
