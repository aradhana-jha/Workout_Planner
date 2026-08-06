import type { Exercise, Profile } from '@prisma/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthConfigurationError, prisma, verifyAuthToken } from '../auth/_shared';
import { getExerciseVideoUrl } from './_exerciseMedia';

type FocusKey = 'full-body' | 'abs' | 'legs' | 'butt' | 'arms';

const FOCUS_CONFIG: Record<FocusKey, { label: string; summary: string }> = {
    'full-body': {
        label: 'Full Body + Cardio',
        summary: 'Low-impact conditioning with lower body, upper body, and core work.',
    },
    abs: {
        label: 'Waist + Core',
        summary: 'Pilates-style core strength, bracing, and controlled trunk work.',
    },
    legs: {
        label: 'Glutes + Thighs',
        summary: 'Squat, lunge, and step-based lower-body work.',
    },
    butt: {
        label: 'Glutes + Hamstrings',
        summary: 'Posterior-chain strength through bridges, thrusts, and hinges.',
    },
    arms: {
        label: 'Arms + Chest',
        summary: 'Upper-body push and pull work targeting chest, back, and arms.',
    },
};

type FocusPhase = 'warm-up' | 'main' | 'cool-down';

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

function exerciseNotes(exercise: Exercise) {
    return (exercise.notes ?? '').toLowerCase();
}

function isPremiumExercise(exercise: Exercise) {
    return exerciseNotes(exercise).includes('quality:premium') || (exercise.externalId ?? '').startsWith('CUR');
}

function isLegacyFallbackExercise(exercise: Exercise) {
    return exerciseNotes(exercise).includes('quality:legacy') ||
        exercise.workoutType.toLowerCase().includes('legacy') ||
        exercise.name.toLowerCase().includes('fallback only');
}

function isBasicCardioFiller(exercise: Exercise) {
    const name = exercise.name.toLowerCase();
    const notes = exerciseNotes(exercise);
    return notes.includes('family:basic-cardio') ||
        name.includes('jog in place') ||
        name.includes('march in place') ||
        name.includes('stair walk') ||
        name.includes('walk-jog') ||
        name.includes('step jack') ||
        name.includes('jumping jack') ||
        name.includes('high knees');
}

function isStrengthExercise(exercise: Exercise) {
    const type = exercise.workoutType.toLowerCase();
    return type.includes('strength') || type.includes('pilates') || type.includes('core control');
}

function isConditioningExercise(exercise: Exercise) {
    const type = exercise.workoutType.toLowerCase();
    return !type.includes('legacy') && (type.includes('conditioning') || type.includes('cardio'));
}

function isMobilityExercise(exercise: Exercise) {
    const type = exercise.workoutType.toLowerCase();
    const movement = exercise.movementPattern.toLowerCase();
    return type.includes('mobility') || type.includes('recovery') || movement.includes('mobility') || movement.includes('stretch');
}

function getDisplayKey(exercise: Exercise) {
    return exercise.name
        .toLowerCase()
        .replace(/\s*\(fallback only\)\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function preferPremiumPool(candidates: Exercise[], minimumCount: number) {
    const premium = candidates.filter((exercise) => isPremiumExercise(exercise));
    return premium.length >= minimumCount ? premium : candidates;
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
    return 3;
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

function getFocusPhaseCounts(timePerWorkout: number) {
    if (timePerWorkout <= 15) {
        return { warmUp: 1, main: 3, coolDown: 1 };
    }

    if (timePerWorkout <= 25) {
        return { warmUp: 2, main: 4, coolDown: 2 };
    }

    if (timePerWorkout <= 40) {
        return { warmUp: 2, main: 5, coolDown: 2 };
    }

    return { warmUp: 3, main: 6, coolDown: 3 };
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

        if (isLegacyFallbackExercise(exercise) || isBasicCardioFiller(exercise)) return false;

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

    if (focusKey === 'full-body') return !isMobilityExercise(exercise) && !isLegacyFallbackExercise(exercise);
    if (focusKey === 'abs') {
        return focusAreas.some((tag) => ['Waist', 'Core', 'Pilates'].includes(tag))
            || lowerPattern.includes('core')
            || lowerPattern.includes('pilates')
            || lowerName.includes('plank')
            || lowerName.includes('dead bug')
            || lowerName.includes('bird dog')
            || lowerName.includes('hollow')
            || lowerName.includes('pallof')
            || lowerName.includes('heel tap')
            || lowerName.includes('reverse crunch')
            || lowerName.includes('hundred')
            || lowerName.includes('single-leg stretch')
            || lowerName.includes('double-leg stretch');
    }
    if (focusKey === 'legs') {
        return focusAreas.some((tag) => ['Glutes', 'Thighs', 'Legs', 'Glutes and legs'].includes(tag))
            || ['squat', 'lunge', 'hinge'].some((value) => lowerPattern.includes(value))
            || lowerPattern.includes('step');
    }
    if (focusKey === 'butt') {
        return focusAreas.some((tag) => ['Glutes', 'Hamstrings', 'Glutes and legs'].includes(tag))
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
    return isStrengthExercise(exercise)
        && (
            focusAreas.some((tag) => ['Chest', 'Arms', 'Upper Body', 'Chest and arms'].includes(tag))
            || lowerPattern.includes('push')
            || lowerPattern.includes('pull')
            || lowerName.includes('press')
            || lowerName.includes('row')
            || lowerName.includes('dip')
            || lowerName.includes('pull-up')
            || lowerName.includes('chin-up')
        );
}

function isStaticStretch(exercise: Exercise) {
    const lowerName = exercise.name.toLowerCase();
    return lowerName.includes('stretch') || lowerName.includes('pose') || lowerName.includes('hang');
}

function matchesMobilityForFocus(exercise: Exercise, focusKey: FocusKey) {
    const focusAreas = parseStringArray(exercise.focusAreaTags);
    const lowerName = exercise.name.toLowerCase();
    const lowerPattern = exercise.movementPattern.toLowerCase();

    if (focusKey === 'full-body') {
        return true;
    }

    if (focusKey === 'abs') {
        return focusAreas.some((tag) => ['Waist', 'Core', 'Pilates'].includes(tag))
            || lowerPattern.includes('core')
            || lowerName.includes('thoracic')
            || lowerName.includes('open book')
            || lowerName.includes('cat')
            || lowerName.includes('child');
    }

    if (focusKey === 'legs') {
        return focusAreas.some((tag) => ['Glutes', 'Thighs', 'Legs', 'Glutes and legs'].includes(tag))
            || lowerName.includes('hip')
            || lowerName.includes('hamstring')
            || lowerName.includes('ankle')
            || lowerName.includes('calf')
            || lowerPattern.includes('hinge');
    }

    if (focusKey === 'butt') {
        return focusAreas.some((tag) => ['Glutes', 'Hamstrings', 'Glutes and legs'].includes(tag))
            || lowerName.includes('glute')
            || lowerName.includes('hip')
            || lowerName.includes('hamstring')
            || lowerName.includes('figure four');
    }

    return focusAreas.some((tag) => ['Chest', 'Arms', 'Upper Body', 'Chest and arms'].includes(tag))
        || lowerName.includes('shoulder')
        || lowerName.includes('chest')
        || lowerName.includes('lat')
        || lowerName.includes('wall slide')
        || lowerName.includes('external rotation');
}

function scoreFocusExercise(exercise: Exercise, profile: Profile, focusKey: FocusKey) {
    let score = 50;
    const focusAreas = parseStringArray(exercise.focusAreaTags);
    const lowerName = exercise.name.toLowerCase();
    const lowerPattern = exercise.movementPattern.toLowerCase();

    if (isPremiumExercise(exercise)) score += 18;
    if (isLegacyFallbackExercise(exercise) || isBasicCardioFiller(exercise)) score -= 120;
    if (isStrengthExercise(exercise)) score += 12;
    if (focusKey === 'full-body') {
        if (['squat', 'hinge', 'push', 'pull', 'lunge', 'core', 'glute', 'pilates'].some((value) => lowerPattern.includes(value))) score += 16;
        if (focusAreas.some((tag) => ['Full Body', 'Cardio', 'Full body balance'].includes(tag))) score += 12;
    }
    if (focusKey === 'abs' && (focusAreas.some((tag) => ['Waist', 'Core', 'Pilates'].includes(tag)) || lowerPattern.includes('core') || lowerPattern.includes('pilates'))) score += 24;
    if (focusKey === 'legs' && focusAreas.some((tag) => ['Glutes', 'Thighs', 'Legs', 'Glutes and legs'].includes(tag))) score += 24;
    if (focusKey === 'butt') {
        if (lowerName.includes('glute') || lowerName.includes('bridge') || lowerName.includes('thrust')) score += 28;
        if (focusAreas.includes('Hamstrings')) score += 12;
        if (lowerPattern.includes('hinge')) score += 12;
    }
    if (focusKey === 'arms' && focusAreas.some((tag) => ['Chest', 'Arms', 'Upper Body', 'Chest and arms'].includes(tag))) score += 22;
    if ((profile.goal === 'Build muscle' || profile.goal === 'Weight gain' || profile.goal === 'Build strength') && isStrengthExercise(exercise)) score += 10;
    if (profile.goal === 'Weight loss' && isConditioningExercise(exercise)) score += 6;

    const difficultyGap = getDifficultyRank(exercise.difficultyMax) - Math.min(getUserExperienceRank(profile.experienceLevel), 2);
    if (difficultyGap > 0) score -= difficultyGap * 8;

    if (profile.intensityPreference === 'Easy' && exercise.impactLevel === 'high') score -= 12;
    return score;
}

function scoreMobilityExercise(exercise: Exercise, focusKey: FocusKey, phase: FocusPhase) {
    let score = 40;

    if (matchesMobilityForFocus(exercise, focusKey)) {
        score += 26;
    }

    if (phase === 'warm-up' && !isStaticStretch(exercise)) {
        score += 18;
    }

    if (phase === 'cool-down' && isStaticStretch(exercise)) {
        score += 18;
    }

    const lowerName = exercise.name.toLowerCase();

    if (phase === 'warm-up') {
        if (lowerName.includes('drill') || lowerName.includes('rotation') || lowerName.includes('rock') || lowerName.includes('slide') || lowerName.includes('camel')) {
            score += 10;
        }
    }

    if (phase === 'cool-down') {
        if (lowerName.includes('stretch') || lowerName.includes('pose')) {
            score += 10;
        }
    }

    return score;
}

function buildExerciseTarget(exercise: Exercise, profile: Profile, phase: FocusPhase) {
    const lowerName = exercise.name.toLowerCase();
    const lowerPattern = exercise.movementPattern.toLowerCase();
    const sets = getSetCount(profile);
    const restSeconds = getRestSeconds(profile);
    const experienceRank = getUserExperienceRank(profile.experienceLevel);
    const isHold = lowerName.includes('plank') || lowerName.includes('hold') || lowerName.includes('dead hang') || lowerName.includes('wall sit');

    if (isMobilityExercise(exercise)) {
        if (phase === 'warm-up' && !isStaticStretch(exercise)) {
            const reps = experienceRank <= 1 ? 8 : 10;
            return { targetSets: 1, targetReps: reps, targetSeconds: null, targetRestSeconds: 15, targetLabel: `1 x ${reps} reps` };
        }

        const seconds = profile.timePerWorkout <= 25 ? 30 : 40;
        return { targetSets: 1, targetReps: null, targetSeconds: seconds, targetRestSeconds: 15, targetLabel: `1 x ${seconds}s` };
    }

    if (isConditioningExercise(exercise)) {
        const seconds = experienceRank <= 1 ? 30 : experienceRank === 2 ? 40 : 45;
        return {
            targetSets: Math.max(2, sets - 1),
            targetReps: null,
            targetSeconds: seconds,
            targetRestSeconds: 25,
            targetLabel: `${Math.max(2, sets - 1)} rounds x ${seconds}s`,
        };
    }

    if (isHold || lowerPattern.includes('core')) {
        const seconds = experienceRank <= 1 ? 30 : experienceRank === 2 ? 40 : 45;
        return {
            targetSets: sets,
            targetReps: null,
            targetSeconds: seconds,
            targetRestSeconds: restSeconds,
            targetLabel: `${sets} x ${seconds}s`,
        };
    }

    const reps = experienceRank <= 0 ? 10 : experienceRank === 1 ? 12 : experienceRank === 2 ? 10 : 8;
    return {
        targetSets: sets,
        targetReps: reps,
        targetSeconds: null,
        targetRestSeconds: restSeconds,
        targetLabel: `${sets} x ${reps} reps`,
    };
}

function transformSuggestedExercise(exercise: Exercise, profile: Profile, phase: FocusPhase) {
    const focusAreas = parseStringArray(exercise.focusAreaTags);
    const target = buildExerciseTarget(exercise, profile, phase);
    const difficultyMin = titleCase(exercise.difficultyMin);
    const difficultyMax = titleCase(exercise.difficultyMax);

    return {
        id: exercise.id,
        phase,
        name: exercise.name,
        muscleGroup: titleCase(focusAreas[0] ?? exercise.movementPattern ?? 'Full body'),
        difficulty: difficultyMin === difficultyMax ? difficultyMin : `${difficultyMin} - ${difficultyMax}`,
        videoUrl: getExerciseVideoUrl(exercise),
        description: exercise.description ?? exercise.notes ?? '',
        ...target,
    };
}

function selectMainFocusExercises(exercises: Exercise[], profile: Profile, focusKey: FocusKey, limit: number) {
    const ranked = exercises
        .filter((exercise) => matchesFocus(exercise, focusKey))
        .map((exercise) => ({ exercise, score: scoreFocusExercise(exercise, profile, focusKey) }))
        .sort((left, right) => right.score - left.score);
    const rankedPool = preferPremiumPool(ranked.map((entry) => entry.exercise), limit);
    const rankedDistinct = ranked
        .filter((entry) => rankedPool.some((exercise) => exercise.id === entry.exercise.id))
        .filter((entry, index, entries) => entries.findIndex((candidate) => getDisplayKey(candidate.exercise) === getDisplayKey(entry.exercise)) === index);

    if (focusKey !== 'full-body') {
        return rankedDistinct.slice(0, limit).map((entry) => entry.exercise);
    }

    const buckets = [
        (exercise: Exercise) => ['squat', 'lunge', 'step'].some((value) => exercise.movementPattern.toLowerCase().includes(value)),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('hinge'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('push'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('pull'),
        (exercise: Exercise) => exercise.movementPattern.toLowerCase().includes('core') || exercise.name.toLowerCase().includes('plank'),
        (exercise: Exercise) => isConditioningExercise(exercise),
    ];

    const selected: Exercise[] = [];
    for (const matcher of buckets) {
        const match = rankedDistinct.find((entry) => matcher(entry.exercise) && !selected.some((exercise) => getDisplayKey(exercise) === getDisplayKey(entry.exercise)));
        if (match) selected.push(match.exercise);
        if (selected.length >= limit) break;
    }

    for (const entry of rankedDistinct) {
        if (selected.length >= limit) break;
        if (!selected.some((exercise) => getDisplayKey(exercise) === getDisplayKey(entry.exercise))) selected.push(entry.exercise);
    }

    return selected;
}

function selectMobilityExercises(
    exercises: Exercise[],
    focusKey: FocusKey,
    phase: FocusPhase,
    limit: number,
    excludedIds: Set<string>
) {
    const candidates = exercises
        .filter((exercise) => isMobilityExercise(exercise))
        .filter((exercise) => matchesMobilityForFocus(exercise, focusKey))
        .filter((exercise) => !excludedIds.has(exercise.id))
        .filter((exercise) => !isLegacyFallbackExercise(exercise) && !isBasicCardioFiller(exercise));
    const pool = preferPremiumPool(candidates, limit);

    return pool
        .map((exercise) => ({ exercise, score: scoreMobilityExercise(exercise, focusKey, phase) }))
        .sort((left, right) => right.score - left.score)
        .filter((entry, index, entries) => entries.findIndex((candidate) => getDisplayKey(candidate.exercise) === getDisplayKey(entry.exercise)) === index)
        .slice(0, limit)
        .map((entry) => entry.exercise);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    let user;
    try {
        user = verifyAuthToken(req);
    } catch (error) {
        if (isAuthConfigurationError(error)) {
            return res.status(500).json({ error: 'server_auth_not_configured' });
        }
        throw error;
    }

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
    const phaseCounts = getFocusPhaseCounts(profile.timePerWorkout);
    const mainExercises = selectMainFocusExercises(allowedPool, profile, focusKey, phaseCounts.main);
    const usedIds = new Set(mainExercises.map((exercise) => exercise.id));
    const warmUpExercises = selectMobilityExercises(allowedPool, focusKey, 'warm-up', phaseCounts.warmUp, usedIds);

    for (const exercise of warmUpExercises) {
        usedIds.add(exercise.id);
    }

    const coolDownExercises = selectMobilityExercises(allowedPool, focusKey, 'cool-down', phaseCounts.coolDown, usedIds);
    const config = FOCUS_CONFIG[focusKey];

    return res.status(200).json({
        focusWorkout: {
            key: focusKey,
            label: config.label,
            summary: config.summary,
            profileSummary: getProfileSummary(profile),
            estimatedMinutes: profile.timePerWorkout,
            experienceLevel: titleCase(profile.experienceLevel),
            exercises: [
                ...warmUpExercises.map((exercise) => transformSuggestedExercise(exercise, profile, 'warm-up')),
                ...mainExercises.map((exercise) => transformSuggestedExercise(exercise, profile, 'main')),
                ...coolDownExercises.map((exercise) => transformSuggestedExercise(exercise, profile, 'cool-down')),
            ],
        }
    });
}
