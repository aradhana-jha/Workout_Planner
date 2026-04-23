import { PrismaClient, type Exercise, type Profile } from '@prisma/client';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

type FocusKey = 'full-body' | 'abs' | 'legs' | 'butt' | 'arms';

const FOCUS_CONFIG: Record<FocusKey, { label: string; summary: string }> = {
    'full-body': {
        label: 'Full Body Workout',
        summary: 'Balanced work across lower body, upper body, and core.',
    },
    abs: {
        label: 'Abs Workout',
        summary: 'Core strength, bracing, and controlled trunk work.',
    },
    legs: {
        label: 'Legs Workout',
        summary: 'Squat, hinge, lunge, and step-based lower-body work.',
    },
    butt: {
        label: 'Butt Workout',
        summary: 'Glute-focused strength through bridges, thrusts, and hinges.',
    },
    arms: {
        label: 'Arms Workout',
        summary: 'Upper-body push and pull work targeting chest, back, and arms.',
    },
};

function verifyToken(req: VercelRequest): { userId: string } | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    } catch {
        return null;
    }
}

function titleCase(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseStringArray(value: string | null | undefined) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
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
            if (!hasNoEquipment && !hasMatchingEquipment) return false;
        }

        if (!painAreas.includes('None')) {
            for (const pain of painAreas) {
                if (avoidFlags.includes(pain)) return false;
            }
        }

        for (const restriction of movementRestrictions) {
            if (restriction === 'None') continue;
            if (restriction === 'Squatting down is difficult') {
                if (exercise.movementPattern === 'Squat' && !exercise.name.toLowerCase().includes('chair') && !exercise.name.toLowerCase().includes('sit-to-stand')) {
                    return false;
                }
            }
            if (restriction === 'Lunges are difficult' && exercise.movementPattern.toLowerCase().includes('lunge')) return false;
            if (restriction === 'Push-ups are difficult') {
                const lowerName = exercise.name.toLowerCase();
                if (lowerName.includes('push-up') && !lowerName.includes('wall') && !lowerName.includes('incline')) return false;
            }
            if (restriction === 'Pull-ups are difficult') {
                const lowerName = exercise.name.toLowerCase();
                if (lowerName.includes('pull-up') && !lowerName.includes('dead hang')) return false;
            }
            if ((restriction === 'Jumping is difficult' || restriction === 'Running is difficult') && exercise.impactLevel === 'high') return false;
        }

        if (!preferenceExclusions.includes('None')) {
            for (const exclusion of preferenceExclusions) {
                const lowerName = exercise.name.toLowerCase();
                if (exclusionFlags.includes(exclusion)) return false;
                if (exclusion === 'Running' && lowerName.includes('run')) return false;
                if (exclusion === 'Jumping' && (exercise.impactLevel === 'high' || lowerName.includes('jump'))) return false;
                if (exclusion === 'Burpees' && lowerName.includes('burpee')) return false;
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

    if (focusKey === 'full-body') return exercise.workoutType !== 'Mobility and recovery';
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

    if (exercise.workoutType === 'Strength training') score += 12;
    if (focusKey === 'full-body') {
        if (['squat', 'hinge', 'push', 'pull', 'lunge', 'core'].some((value) => lowerPattern.includes(value))) score += 16;
        if (focusAreas.includes('Full body balance')) score += 12;
    }
    if (focusKey === 'abs' && (focusAreas.includes('Core') || lowerPattern.includes('core'))) score += 24;
    if (focusKey === 'legs' && focusAreas.includes('Glutes and legs')) score += 24;
    if (focusKey === 'butt') {
        if (lowerName.includes('glute') || lowerName.includes('bridge') || lowerName.includes('thrust')) score += 28;
        if (lowerPattern.includes('hinge')) score += 12;
    }
    if (focusKey === 'arms' && focusAreas.includes('Chest and arms')) score += 22;
    if ((profile.goal === 'Build muscle' || profile.goal === 'Get stronger') && exercise.workoutType === 'Strength training') score += 10;
    if ((profile.goal === 'Improve stamina' || profile.goal === 'Lose body fat') && exercise.workoutType === 'Cardio conditioning') score += 6;

    const difficultyGap = getDifficultyRank(exercise.difficultyMax) - Math.min(getUserExperienceRank(profile.experienceLevel), 2);
    if (difficultyGap > 0) score -= difficultyGap * 8;

    if (profile.intensityPreference === 'Easy' && exercise.impactLevel === 'high') score -= 12;
    if (profile.workoutStylePreference === 'Mostly cardio' && exercise.workoutType === 'Cardio conditioning') score += 10;
    if (profile.workoutStylePreference === 'Mostly strength training' && exercise.workoutType === 'Strength training') score += 10;
    return score;
}

function buildExerciseTarget(exercise: Exercise, profile: Profile) {
    const lowerName = exercise.name.toLowerCase();
    const lowerPattern = exercise.movementPattern.toLowerCase();
    const sets = getSetCount(profile);
    const restSeconds = getRestSeconds(profile);
    const experienceRank = getUserExperienceRank(profile.experienceLevel);
    const isHold = lowerName.includes('plank') || lowerName.includes('hold') || lowerName.includes('dead hang') || lowerName.includes('wall sit');

    if (exercise.workoutType === 'Mobility and recovery') {
        const seconds = profile.timePerWorkout <= 25 ? 35 : 45;
        return { targetLabel: `2 x ${seconds}s`, restSeconds: 20 };
    }

    if (exercise.workoutType === 'Cardio conditioning') {
        const seconds = experienceRank <= 1 ? 30 : experienceRank === 2 ? 40 : 45;
        return { targetLabel: `${Math.max(2, sets - 1)} rounds x ${seconds}s`, restSeconds: 25 };
    }

    if (isHold || lowerPattern.includes('core')) {
        const seconds = experienceRank <= 1 ? 30 : experienceRank === 2 ? 40 : 45;
        return { targetLabel: `${sets} x ${seconds}s`, restSeconds };
    }

    const reps = experienceRank <= 0 ? 10 : experienceRank === 1 ? 12 : experienceRank === 2 ? 10 : 8;
    return { targetLabel: `${sets} x ${reps} reps`, restSeconds };
}

function transformSuggestedExercise(exercise: Exercise, profile: Profile) {
    const focusAreas = parseStringArray(exercise.focusAreaTags);
    const difficultyMin = titleCase(exercise.difficultyMin);
    const difficultyMax = titleCase(exercise.difficultyMax);

    return {
        id: exercise.id,
        name: exercise.name,
        muscleGroup: titleCase(focusAreas[0] ?? exercise.movementPattern ?? 'Full body'),
        difficulty: difficultyMin === difficultyMax ? difficultyMin : `${difficultyMin} - ${difficultyMax}`,
        description: exercise.description ?? exercise.notes ?? '',
        ...buildExerciseTarget(exercise, profile),
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
        (exercise: Exercise) => ['squat', 'lunge', 'step'].some((value) => exercise.movementPattern.toLowerCase().includes(value)),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('hinge'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('push'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('pull'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('core') || exercise.name.toLowerCase().includes('plank'),
        (exercise: Exercise) => exercise.workoutType === 'Cardio conditioning',
    ];

    const selected: Exercise[] = [];
    for (const matcher of buckets) {
        const match = ranked.find((entry) => matcher(entry.exercise) && !selected.some((exercise) => exercise.id === entry.exercise.id));
        if (match) selected.push(match.exercise);
        if (selected.length >= limit) break;
    }

    for (const entry of ranked) {
        if (selected.length >= limit) break;
        if (!selected.some((exercise) => exercise.id === entry.exercise.id)) selected.push(entry.exercise);
    }

    return selected;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const rawFocusKey = Array.isArray(req.query.focusKey) ? req.query.focusKey[0] : req.query.focusKey;
    const focusKey = rawFocusKey as FocusKey;

    if (!rawFocusKey || !(focusKey in FOCUS_CONFIG)) {
        return res.status(400).json({ error: 'Invalid focus key' });
    }

    const profile = await prisma.profile.findUnique({ where: { userId: user.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const exercises = await prisma.exercise.findMany();
    const allowedPool = filterExercisesForProfile(exercises, profile);
    const selected = selectFocusExercises(allowedPool, profile, focusKey);
    const config = FOCUS_CONFIG[focusKey];

    return res.status(200).json({
        focusWorkout: {
            key: focusKey,
            label: config.label,
            summary: config.summary,
            profileSummary: getProfileSummary(profile),
            estimatedMinutes: profile.timePerWorkout,
            experienceLevel: titleCase(profile.experienceLevel),
            exercises: selected.map((exercise) => transformSuggestedExercise(exercise, profile)),
        }
    });
}
