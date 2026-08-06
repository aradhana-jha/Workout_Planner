import { Router, Request, Response } from 'express';
import { PrismaClient, type Exercise, type Profile } from '../generated/client';
import { z } from 'zod';
import { authMiddleware } from './auth';

const prisma = new PrismaClient();
const router = Router();
type FocusKey = 'full-body' | 'abs' | 'legs' | 'butt' | 'arms';
type FocusPhase = 'warm-up' | 'main' | 'cool-down';

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
const EXERCISE_VIDEO_BY_NAME: Record<string, string> = {
    '90/90 hip switches': '/exercise-videos/90-90-hip-switches.mp4',
    'ankle rocks': '/exercise-videos/ankle-rocks.mp4',
    'arm circles': '/exercise-videos/arm-circles.mp4',
    'arm swings': '/exercise-videos/arm-swings.mp4',
    'band chest press': '/exercise-videos/band-chest-press.mp4',
    'band face pull': '/exercise-videos/band-face-pull.mp4',
    'band pull-apart': '/exercise-videos/band-pull-apart.mp4',
    'band row': '/exercise-videos/band-row.mp4',
    'bird dog reach': '/exercise-videos/bird-dog-reach.mp4',
    'bulgarian split squat': '/exercise-videos/bulgarian-split-squat.mp4',
    'cat-cow spinal flow': '/exercise-videos/cat-cow-spinal-flow.mp4',
    'cat–cow': '/exercise-videos/cat-cow-spinal-flow.mp4',
    'cat–cow (slow)': '/exercise-videos/cat-cow-spinal-flow.mp4',
    'chair triceps dips': '/exercise-videos/chair-triceps-dips.mp4',
    'chest stretch against wall': '/exercise-videos/chest-stretch-against-wall.mp4',
    "child's pose": '/exercise-videos/childs-pose.mp4',
    'child’s pose': '/exercise-videos/childs-pose.mp4',
    'close-grip push-up': '/exercise-videos/close-grip-push-up.mp4',
    'dead bug activation': '/exercise-videos/dead-bug-activation.mp4',
    'decline push-up': '/exercise-videos/decline-push-up.mp4',
    'dumbbell biceps curl': '/exercise-videos/dumbbell-biceps-curl.mp4',
    'dumbbell floor press': '/exercise-videos/dumbbell-floor-press.mp4',
    'dumbbell romanian deadlift': '/exercise-videos/dumbbell-romanian-deadlift.mp4',
    'dumbbell shoulder press': '/exercise-videos/dumbbell-shoulder-press.mp4',
    'dumbbell shoulder press (seated/standing)': '/exercise-videos/dumbbell-shoulder-press.mp4',
    'figure-four glute stretch': '/exercise-videos/figure-four-glute-stretch.mp4',
    'forearm plank': '/exercise-videos/forearm-plank.mp4',
    'glute bridge': '/exercise-videos/glute-bridge-v2.mp4',
    'glute bridge march activation': '/exercise-videos/glute-bridge-march-activation.mp4',
    'goblet squat': '/exercise-videos/goblet-squat.mp4',
    'goblet squat with dumbbell': '/exercise-videos/goblet-squat.mp4',
    'half-kneeling hip flexor stretch': '/exercise-videos/hip-flexor-lunge-stretch.mp4',
    'half-kneeling dumbbell press': '/exercise-videos/half-kneeling-dumbbell-press.mp4',
    'hamstring walkout': '/exercise-videos/hamstring-walkout.mp4',
    'hip circles': '/exercise-videos/hip-circles.mp4',
    'hip hinge drill': '/exercise-videos/hip-hinge-drill.mp4',
    'hip flexor lunge stretch': '/exercise-videos/hip-flexor-lunge-stretch.mp4',
    'hip thrust': '/exercise-videos/hip-thrust.mp4',
    'incline push-up': '/exercise-videos/incline-push-up.mp4',
    'incline push-up (hands on bench/chair)': '/exercise-videos/incline-push-up.mp4',
    'inchworm walkout': '/exercise-videos/inchworm-walkout.mp4',
    'knee push-up': '/exercise-videos/knee-push-up.mp4',
    'lateral lunge': '/exercise-videos/lateral-lunge.mp4',
    'lateral lunge reach': '/exercise-videos/lateral-lunge-reach.mp4',
    'low-impact jumping jacks': '/exercise-videos/low-impact-jumping-jacks.mp4',
    'low step-up': '/exercise-videos/low-step-up.mp4',
    'neck circles': '/exercise-videos/neck-circles.mp4',
    'one-arm dumbbell row': '/exercise-videos/one-arm-dumbbell-row.mp4',
    'pike push-up': '/exercise-videos/pike-push-up.mp4',
    'bear hover': '/exercise-videos/bear-hover.mp4',
    'hollow body tuck': '/exercise-videos/hollow-body-tuck.mp4',
    'modified pilates roll-up': '/exercise-videos/modified-pilates-roll-up.mp4',
    'pallof press': '/exercise-videos/pallof-press.mp4',
    'pilates hundred': '/exercise-videos/pilates-hundred.mp4',
    'pilates double-leg stretch': '/exercise-videos/pilates-double-leg-stretch.mp4',
    'pilates saw': '/exercise-videos/pilates-saw.mp4',
    'pilates single-leg stretch': '/exercise-videos/pilates-single-leg-stretch.mp4',
    'pilates spine stretch forward': '/exercise-videos/pilates-spine-stretch-forward.mp4',
    'pilates swimming': '/exercise-videos/pilates-swimming.mp4',
    'plank shoulder tap': '/exercise-videos/plank-shoulder-tap.mp4',
    'plank': '/exercise-videos/forearm-plank.mp4',
    'prone cobra hold': '/exercise-videos/prone-cobra-hold.mp4',
    'prone y-t-w raise': '/exercise-videos/prone-y-t-w-raise.mp4',
    'reverse lunge': '/exercise-videos/reverse-lunge.mp4',
    'reverse lunges': '/exercise-videos/reverse-lunge.mp4',
    'reverse lunges (bodyweight)': '/exercise-videos/reverse-lunge.mp4',
    'reverse snow angel': '/exercise-videos/reverse-snow-angel.mp4',
    'romanian deadlift with dumbbells': '/exercise-videos/dumbbell-romanian-deadlift.mp4',
    'scapular wall slides': '/exercise-videos/scapular-wall-slides.mp4',
    'seated glute stretch': '/exercise-videos/seated-glute-stretch.mp4',
    'seated hamstring stretch': '/exercise-videos/seated-hamstring-stretch.mp4',
    'shoulder cars': '/exercise-videos/shoulder-cars.mp4',
    'shoulder cross-body stretch': '/exercise-videos/shoulder-cross-body-stretch.mp4',
    'shoulder rolls': '/exercise-videos/shoulder-rolls.mp4',
    'single-leg glute bridge': '/exercise-videos/single-leg-glute-bridge.mp4',
    'side lying leg raises': '/exercise-videos/side-lying-leg-raises.mp4',
    'side-lying leg lift': '/exercise-videos/side-lying-leg-raises.mp4',
    'side plank': '/exercise-videos/side-plank.mp4',
    'sit-to-stand squat': '/exercise-videos/sit-to-stand-squat.mp4',
    'split squat': '/exercise-videos/split-squat.mp4',
    'squat-to-stand prying stretch': '/exercise-videos/squat-to-stand-prying-stretch.mp4',
    'standard push-up': '/exercise-videos/standard-push-up.mp4',
    'standing calf raise': '/exercise-videos/standing-calf-raise.mp4',
    'standing calf stretch': '/exercise-videos/standing-calf-stretch.mp4',
    'standing hamstring stretch': '/exercise-videos/standing-hamstring-stretch.mp4',
    'standing quad stretch': '/exercise-videos/standing-quad-stretch.mp4',
    'superman': '/exercise-videos/superman.mp4',
    'thoracic open book rotation': '/exercise-videos/thoracic-open-book-rotation.mp4',
    'tempo bodyweight squat': '/exercise-videos/tempo-bodyweight-squat.mp4',
    'torso twists (standing)': '/exercise-videos/torso-twists-standing.mp4',
    'wall calf stretch': '/exercise-videos/standing-calf-stretch.mp4',
    'wall push-up': '/exercise-videos/wall-push-up.mp4',
    'wall sit': '/exercise-videos/wall-sit.mp4',
    'worlds greatest stretch': '/exercise-videos/worlds-greatest-stretch.mp4',
    "world's greatest stretch": '/exercise-videos/worlds-greatest-stretch.mp4',
    'clamshell': '/exercise-videos/clamshell.mp4',
    'cross-body mountain climber': '/exercise-videos/cross-body-mountain-climber.mp4',
    'donkey kick': '/exercise-videos/donkey-kick.mp4',
    'fire hydrant': '/exercise-videos/fire-hydrant.mp4',
    'heel taps': '/exercise-videos/heel-taps.mp4',
    'lateral shuffle reach': '/exercise-videos/lateral-shuffle-reach.mp4',
    'low-impact skater step': '/exercise-videos/low-impact-skater-step.mp4',
    'reverse crunch': '/exercise-videos/reverse-crunch.mp4',
    'slow mountain climber': '/exercise-videos/slow-mountain-climber.mp4',
    'squat to calf raise': '/exercise-videos/squat-to-calf-raise.mp4',
    'bear crawl': '/exercise-videos/bear-crawl.mp4',
    'boxing cross-body combo': '/exercise-videos/boxing-cross-body-combo.mp4',
    'child pose lat reach': '/exercise-videos/child-pose-lat-reach.mp4',
    'couch stretch': '/exercise-videos/couch-stretch.mp4',
    'inchworm to plank': '/exercise-videos/inchworm-to-plank.mp4',
    'plank jack': '/exercise-videos/plank-jack.mp4',
    'reverse lunge to knee drive': '/exercise-videos/reverse-lunge-to-knee-drive.mp4',
    'skater hop': '/exercise-videos/skater-hop.mp4',
    'squat thrust': '/exercise-videos/squat-thrust.mp4',
    'step-back burpee': '/exercise-videos/step-back-burpee.mp4',
    '90/90 breathing reset': '/exercise-videos/90-90-breathing-reset.mp4',
    'doorway pec stretch': '/exercise-videos/doorway-pec-stretch.mp4',
    'hamstring strap stretch': '/exercise-videos/hamstring-strap-stretch.mp4',
    'jog in place (fallback only)': '/exercise-videos/jog-in-place.mp4',
    'march in place (fallback only)': '/exercise-videos/march-in-place.mp4',
    'shadow boxing (fallback only)': '/exercise-videos/shadow-boxing.mp4',
    'stair walk (fallback only)': '/exercise-videos/stair-walk.mp4',
    'step jacks (fallback only)': '/exercise-videos/step-jacks.mp4',
    'supine twist': '/exercise-videos/supine-twist.mp4',
    'thread-the-needle stretch': '/exercise-videos/thread-the-needle-stretch.mp4',
    'treadmill walk-jog intervals (fallback only)': '/exercise-videos/treadmill-walk-jog-intervals.mp4',
};

function getExerciseVideoUrl(exercise: Pick<Exercise, 'name' | 'videoUrl'>) {
    return exercise.videoUrl ?? EXERCISE_VIDEO_BY_NAME[exercise.name.trim().toLowerCase()] ?? null;
}

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

function isMobilityExercise(exercise: Exercise) {
    return exercise.workoutType === 'Mobility and recovery';
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
        return focusAreas.includes('Core')
            || lowerPattern.includes('core')
            || lowerName.includes('thoracic')
            || lowerName.includes('open book')
            || lowerName.includes('cat')
            || lowerName.includes('child');
    }

    if (focusKey === 'legs') {
        return focusAreas.includes('Glutes and legs')
            || lowerName.includes('hip')
            || lowerName.includes('hamstring')
            || lowerName.includes('ankle')
            || lowerName.includes('calf')
            || lowerPattern.includes('hinge');
    }

    if (focusKey === 'butt') {
        return focusAreas.includes('Glutes and legs')
            || lowerName.includes('glute')
            || lowerName.includes('hip')
            || lowerName.includes('hamstring')
            || lowerName.includes('figure four');
    }

    return focusAreas.includes('Chest and arms')
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

    const isHold = lowerName.includes('plank')
        || lowerName.includes('hold')
        || lowerName.includes('dead hang')
        || lowerName.includes('wall sit');

    if (isMobilityExercise(exercise)) {
        if (phase === 'warm-up' && !isStaticStretch(exercise)) {
            const reps = experienceRank <= 1 ? 8 : 10;
            return { sets: 1, reps, seconds: null, restSeconds: 15, targetLabel: `1 x ${reps} reps` };
        }

        const seconds = profile.timePerWorkout <= 25 ? 30 : 40;
        return { sets: 1, reps: null, seconds, restSeconds: 15, targetLabel: `1 x ${seconds}s` };
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

function selectMobilityExercises(
    exercises: Exercise[],
    focusKey: FocusKey,
    phase: FocusPhase,
    limit: number,
    excludedIds: Set<string>
) {
    return exercises
        .filter((exercise) => isMobilityExercise(exercise))
        .filter((exercise) => matchesMobilityForFocus(exercise, focusKey))
        .filter((exercise) => !excludedIds.has(exercise.id))
        .map((exercise) => ({ exercise, score: scoreMobilityExercise(exercise, focusKey, phase) }))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map((entry) => entry.exercise);
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
    const phaseCounts = getFocusPhaseCounts(profile.timePerWorkout);
    const mainExercises = selectMainFocusExercises(allowedPool, profile, focusKey, phaseCounts.main);
    const usedIds = new Set(mainExercises.map((exercise) => exercise.id));
    const warmUpExercises = selectMobilityExercises(allowedPool, focusKey, 'warm-up', phaseCounts.warmUp, usedIds);

    for (const exercise of warmUpExercises) {
        usedIds.add(exercise.id);
    }

    const coolDownExercises = selectMobilityExercises(allowedPool, focusKey, 'cool-down', phaseCounts.coolDown, usedIds);
    const config = FOCUS_CONFIG[focusKey];

    return {
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
                    videoUrl: getExerciseVideoUrl(workoutExercise.exercise),
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

async function handleGetFocusWorkout(req: Request, res: Response, focusKey: FocusKey): Promise<void> {
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
}

router.get('/focus', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const focusKey = typeof req.query.focusKey === 'string' ? req.query.focusKey as FocusKey : undefined;
    if (!focusKey) {
        res.status(400).json({ error: 'focusKey is required' });
        return;
    }

    await handleGetFocusWorkout(req, res, focusKey);
});

router.get('/focus/:focusKey', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    await handleGetFocusWorkout(req, res, req.params.focusKey as FocusKey);
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
