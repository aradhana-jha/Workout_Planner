/**
 * Personalized Workout Plan Generator V3
 *
 * Builds a 30-day plan in three steps:
 * 1. Design the weekly program from the user's goal, recovery, time, and training frequency.
 * 2. Create movement slots for each workout day.
 * 3. Fill those slots with safe, scored exercises and role-specific prescriptions.
 */

import { PrismaClient } from '@prisma/client';
import type { Exercise, Profile } from '@prisma/client';

declare global {
    var prismaPlanGeneratorSingleton: PrismaClient | undefined;
}

const prisma = globalThis.prismaPlanGeneratorSingleton ?? new PrismaClient();
globalThis.prismaPlanGeneratorSingleton = prisma;

type DayType =
    | 'Lower Body Strength'
    | 'Upper Body Strength'
    | 'Full Body Strength'
    | 'Conditioning Core Mobility'
    | 'Full Body Conditioning'
    | 'Posterior Chain Core'
    | 'Upper Body Posture'
    | 'Mobility Strength Recovery'
    | 'Rest';

type ExerciseRole = 'warm-up' | 'main' | 'accessory' | 'conditioning' | 'mobility' | 'cool-off';

type MovementGroup =
    | 'squat'
    | 'hinge'
    | 'lunge'
    | 'push'
    | 'pull'
    | 'core'
    | 'conditioning'
    | 'mobility'
    | 'stretch'
    | 'carry'
    | 'posture';

type WorkoutTypeGroup = 'strength' | 'conditioning' | 'mobility';

interface RankedExercise extends Exercise {
    score: number;
    role?: ExerciseRole;
}

interface DayExerciseCounts {
    warmUp: number;
    main: number;
    stretch: number;
}

interface ProgramDesign {
    daysPerWeek: number;
    schedule: DayType[];
    strengthBias: number;
    conditioningBias: number;
    mobilityBias: number;
    recoveryLevel: 'low' | 'normal' | 'high';
}

interface WorkoutSlot {
    label: string;
    role: ExerciseRole;
    movements?: MovementGroup[];
    workoutTypes?: WorkoutTypeGroup[];
    focusBoosts?: string[];
    required?: boolean;
}

interface ExerciseUsage {
    count: number;
    lastDay: number;
}

interface BuildContext {
    dayNumber: number;
    week: number;
    dayType: DayType;
    design: ProgramDesign;
    history: Map<string, ExerciseUsage>;
    familyHistory: Map<string, ExerciseUsage>;
    dayFamilies: Map<string, number>;
}

const DIFFICULTY_ORDER = ['beginner', 'some experience', 'intermediate', 'advanced'];

export class PlanGenerationCoverageError extends Error {
    code = 'PLAN_COVERAGE';

    constructor(message: string) {
        super(message);
        this.name = 'PlanGenerationCoverageError';
    }
}

export class PlanGenerator {
    async generate(userId: string, profile: Profile) {
        console.log(`[PlanGenerator] Starting plan generation for user ${userId}`);

        const allExercises = await prisma.exercise.findMany();
        console.log(`[PlanGenerator] Loaded ${allExercises.length} exercises from database`);

        const design = this.designProgram(profile);
        console.log(`[PlanGenerator] Program design: ${design.daysPerWeek} days/week`);

        const strictPool = this.filterExercises(allExercises, profile, { respectPreferenceExclusions: true });
        const safetyPool = this.filterExercises(allExercises, profile, { respectPreferenceExclusions: false });
        let allowedPool = strictPool;

        console.log(`[PlanGenerator] After strict filtering: ${strictPool.length} exercises allowed`);

        if (!this.canBuildCompleteProgram(strictPool, profile, design)) {
            console.warn('[PlanGenerator] Strict pool is underfilled; relaxing preference-only exclusions');
            allowedPool = safetyPool;
        }

        if (!this.canBuildCompleteProgram(allowedPool, profile, design)) {
            throw new PlanGenerationCoverageError('Insufficient safe exercise coverage for the selected constraints');
        }

        const plan = await prisma.plan.create({
            data: {
                userId,
                startDate: new Date(),
                status: 'generating',
            },
        });

        try {
            const history = new Map<string, ExerciseUsage>();
            const familyHistory = new Map<string, ExerciseUsage>();

            for (let week = 1; week <= 4; week++) {
                for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
                    const dayType = design.schedule[dayInWeek] ?? 'Rest';
                    const dayNumber = (week - 1) * 7 + dayInWeek + 1;

                    if (dayType === 'Rest') {
                        await prisma.workoutDay.create({
                            data: {
                                planId: plan.id,
                                dayNumber,
                                weekNumber: week,
                                dayType: 'Rest',
                                estimatedMinutes: 0,
                            },
                        });
                        continue;
                    }

                    await this.buildDay(plan.id, dayNumber, week, dayType, allowedPool, profile, design, history, familyHistory);
                }
            }

            await this.buildOptionalRecoveryDays(plan.id, 29, allowedPool, profile, history, familyHistory);

            await prisma.$transaction([
                prisma.plan.updateMany({
                    where: { userId, status: 'active' },
                    data: { status: 'replaced' },
                }),
                prisma.plan.update({
                    where: { id: plan.id },
                    data: { status: 'active' },
                }),
            ]);
        } catch (error) {
            await this.cleanupPartialPlan(plan.id);
            throw error;
        }

        return prisma.plan.findUnique({
            where: { id: plan.id },
            include: { days: true },
        });
    }

    private designProgram(profile: Profile): ProgramDesign {
        const goal = profile.goal;
        const style = profile.workoutStylePreference;
        const daysPerWeek = this.getTrainingDaysPerWeek(profile);
        const recoveryLevel = this.getRecoveryLevel(profile);

        let strengthBias = 0.5;
        let conditioningBias = 0.3;
        let mobilityBias = 0.2;

        if (goal === 'Build muscle' || goal === 'Get stronger') {
            strengthBias += 0.25;
            conditioningBias -= 0.05;
        }

        if (goal === 'Lose body fat' || goal === 'Improve stamina') {
            conditioningBias += 0.25;
            strengthBias -= 0.05;
        }

        if (goal === 'Improve mobility') {
            mobilityBias += 0.3;
            strengthBias -= 0.1;
        }

        if (style === 'Mostly strength training') {
            strengthBias += 0.15;
            conditioningBias -= 0.05;
        } else if (style === 'Mostly cardio') {
            conditioningBias += 0.15;
            strengthBias -= 0.05;
        }

        return {
            daysPerWeek,
            schedule: this.buildWeeklySchedule(daysPerWeek, profile),
            strengthBias: this.clamp(strengthBias, 0.15, 0.85),
            conditioningBias: this.clamp(conditioningBias, 0.1, 0.75),
            mobilityBias: this.clamp(mobilityBias, 0.1, 0.65),
            recoveryLevel,
        };
    }

    private buildWeeklySchedule(daysPerWeek: number, profile: Profile): DayType[] {
        const goal = profile.goal;
        const style = profile.workoutStylePreference;
        const conditioningForward =
            goal === 'Lose body fat' ||
            goal === 'Improve stamina' ||
            style === 'Mostly cardio';
        const mobilityForward = goal === 'Improve mobility';

        if (daysPerWeek <= 2) {
            return mobilityForward
                ? ['Full Body Strength', 'Rest', 'Rest', 'Mobility Strength Recovery', 'Rest', 'Rest', 'Rest']
                : ['Full Body Strength', 'Rest', 'Rest', 'Conditioning Core Mobility', 'Rest', 'Rest', 'Rest'];
        }

        if (daysPerWeek === 3) {
            if (conditioningForward) {
                return ['Full Body Strength', 'Rest', 'Conditioning Core Mobility', 'Rest', 'Full Body Conditioning', 'Rest', 'Rest'];
            }

            if (mobilityForward) {
                return ['Full Body Strength', 'Rest', 'Mobility Strength Recovery', 'Rest', 'Conditioning Core Mobility', 'Rest', 'Rest'];
            }

            return ['Lower Body Strength', 'Rest', 'Upper Body Strength', 'Rest', 'Full Body Strength', 'Rest', 'Rest'];
        }

        if (daysPerWeek === 4) {
            return conditioningForward
                ? ['Lower Body Strength', 'Conditioning Core Mobility', 'Rest', 'Upper Body Strength', 'Full Body Conditioning', 'Rest', 'Rest']
                : ['Lower Body Strength', 'Upper Body Strength', 'Rest', 'Conditioning Core Mobility', 'Full Body Strength', 'Rest', 'Rest'];
        }

        return ['Lower Body Strength', 'Upper Body Strength', 'Conditioning Core Mobility', 'Posterior Chain Core', 'Upper Body Posture', 'Rest', 'Rest'];
    }

    private getTrainingDaysPerWeek(profile: Profile): number {
        const raw = (profile.recentConsistency || '').toLowerCase();
        const explicit = raw.match(/\b([2-5])\s*\+?\s*days?/);

        let days = 3;

        if (explicit) {
            days = Number(explicit[1]);
        } else if (raw.includes('0 days')) {
            days = 3;
        } else if (raw.includes('1-2') || raw.includes('1 to 2')) {
            days = 3;
        } else if (raw.includes('3-4') || raw.includes('3 to 4')) {
            days = 4;
        } else if (raw.includes('5+')) {
            days = 5;
        }

        if (profile.experienceLevel === 'beginner' && days > 4) days = 4;
        if (profile.sleepBucket === 'Under 6 hours' && profile.intensityPreference === 'Easy') days = Math.min(days, 3);

        return this.clamp(Math.round(days), 2, 5);
    }

    private filterExercises(
        exercises: Exercise[],
        profile: Profile,
        options: { respectPreferenceExclusions: boolean },
    ): Exercise[] {
        const userEquipment = this.parseTags(profile.equipment);
        const painAreas = this.parseTags(profile.painAreas);
        const movementRestrictions = this.parseTags(profile.movementRestrictions);
        const preferenceExclusions = this.parseTags(profile.preferenceExclusions);

        return exercises.filter((exercise) => {
            const equipment = this.parseTags(exercise.equipmentTags);
            const avoidFlags = this.parseTags(exercise.avoidModifyFlags);
            const exclusionFlags = this.parseTags(exercise.preferenceExclusionFlags);
            const name = exercise.name.toLowerCase();
            const movement = exercise.movementPattern.toLowerCase();

            if (equipment.length > 0) {
                const needsOnlyBodyweight = equipment.includes('No equipment');
                const hasMatchingEquipment = equipment.some((tag) => userEquipment.includes(tag));
                if (!needsOnlyBodyweight && !hasMatchingEquipment) return false;
            }

            if (!painAreas.includes('None')) {
                for (const pain of painAreas) {
                    if (avoidFlags.includes(pain)) return false;
                }
            }

            for (const restriction of movementRestrictions) {
                if (restriction === 'None') continue;

                if (restriction === 'Squatting down is difficult') {
                    const isSquatLike = this.matchesMovement(exercise, ['squat', 'lunge']);
                    const hasRegression = name.includes('chair') || name.includes('box squat') || name.includes('sit-to-stand');
                    if (isSquatLike && !hasRegression) return false;
                }

                if (restriction === 'Lunges are difficult' && this.matchesMovement(exercise, ['lunge'])) {
                    return false;
                }

                if (restriction === 'Push-ups are difficult') {
                    const isPushup = name.includes('push-up');
                    const hasRegression = name.includes('wall') || name.includes('incline') || name.includes('knee');
                    if (isPushup && !hasRegression) return false;
                }

                if (restriction === 'Pull-ups are difficult') {
                    if ((name.includes('pull-up') || name.includes('chin-up')) && !name.includes('dead hang')) return false;
                }

                if (restriction === 'Jumping is difficult') {
                    if (exercise.impactLevel === 'high' || movement.includes('plyometric') || name.includes('jump')) return false;
                }

                if (restriction === 'Running is difficult') {
                    if (exclusionFlags.includes('Running') || name.includes('run') || name.includes('jog')) return false;
                }
            }

            if (options.respectPreferenceExclusions && !preferenceExclusions.includes('None')) {
                for (const exclusion of preferenceExclusions) {
                    if (exclusionFlags.includes(exclusion)) return false;
                    if (exclusion === 'Running' && (name.includes('run') || name.includes('jog'))) return false;
                    if (exclusion === 'Jumping' && (exercise.impactLevel === 'high' || name.includes('jump'))) return false;
                    if (exclusion === 'Burpees' && name.includes('burpee')) return false;
                    if (exclusion === 'Heavy lifting' && exclusionFlags.includes('Heavy lifting')) return false;
                }
            }

            return true;
        });
    }

    private scoreExercises(exercises: Exercise[], profile: Profile, dayType: DayType, design: ProgramDesign): RankedExercise[] {
        const goal = profile.goal;
        const style = profile.workoutStylePreference;
        const focusAreas = this.parseTags(profile.focusAreas);
        const userRank = this.getUserExperienceRank(profile);
        const recoveryLevel = design.recoveryLevel;

        return exercises
            .map((exercise) => {
                let score = 50;
                const focusTags = this.parseTags(exercise.focusAreaTags);
                const minRank = this.getDifficultyRank(exercise.difficultyMin);
                const maxRank = this.getDifficultyRank(exercise.difficultyMax);
                const impact = exercise.impactLevel.toLowerCase();

                if (this.isPremiumExercise(exercise)) score += 24;
                if (this.isLegacyFallbackExercise(exercise)) score -= 120;

                if ((goal === 'Build muscle' || goal === 'Get stronger') && this.isStrengthType(exercise)) score += 18;
                if ((goal === 'Lose body fat' || goal === 'Improve stamina') && this.isConditioningType(exercise)) score += 18;
                if (goal === 'Improve mobility' && this.isMobilityType(exercise)) score += 20;
                if (goal === 'General fitness' && this.parseTags(exercise.phaseTags).includes('Main exercise')) score += 6;

                if (style === 'Mostly strength training' && this.isStrengthType(exercise)) score += 12;
                if (style === 'Mostly strength training' && this.isConditioningType(exercise)) score -= 10;
                if (style === 'Mostly cardio' && this.isConditioningType(exercise)) score += this.isBasicCardioFiller(exercise) ? -18 : 12;
                if (style === 'Mix of both' && (this.isStrengthType(exercise) || this.isConditioningType(exercise))) score += 6;

                for (const focus of focusAreas) {
                    if (focus !== 'Full body balance' && focusTags.includes(focus)) score += 14;
                }

                if (userRank >= minRank && userRank <= maxRank) {
                    score += 12;
                } else if (userRank < minRank) {
                    score -= 28 + (minRank - userRank) * 8;
                } else if (userRank > maxRank + 1) {
                    score -= 8;
                }

                if (profile.intensityPreference === 'Easy') {
                    if (impact === 'high') score -= 35;
                    if (impact === 'low') score += 8;
                } else if (profile.intensityPreference === 'Hard') {
                    if (impact === 'high' || this.isConditioningType(exercise)) score += 8;
                }

                if (recoveryLevel === 'low') {
                    if (impact === 'high') score -= 25;
                    if (userRank < minRank) score -= 12;
                }

                if (profile.timePerWorkout <= 25 && this.hasSetupFriction(exercise)) score -= 5;

                score += this.getDayTypeBonus(exercise, dayType);
                score += this.getProfileSpecificBonus(exercise, profile, dayType);
                score -= this.getLowValueExercisePenalty(exercise, profile);

                return { ...exercise, score };
            })
            .sort((a, b) => b.score - a.score);
    }

    private getDayTypeBonus(exercise: Exercise, dayType: DayType): number {
        if (dayType === 'Lower Body Strength' && this.matchesMovement(exercise, ['squat', 'hinge', 'lunge'])) return 16;
        if (dayType === 'Upper Body Strength' && this.matchesMovement(exercise, ['push', 'pull', 'posture'])) return 16;
        if (dayType === 'Full Body Strength' && this.matchesMovement(exercise, ['squat', 'hinge', 'push', 'pull', 'core'])) return 10;
        if (dayType === 'Conditioning Core Mobility' && (this.isConditioningType(exercise) || this.matchesMovement(exercise, ['core', 'mobility']))) return 16;
        if (dayType === 'Full Body Conditioning' && (this.isConditioningType(exercise) || this.matchesMovement(exercise, ['squat', 'push', 'core']))) return 14;
        if (dayType === 'Posterior Chain Core' && this.matchesMovement(exercise, ['hinge', 'pull', 'core', 'posture'])) return 16;
        if (dayType === 'Upper Body Posture' && this.matchesMovement(exercise, ['pull', 'posture', 'push', 'core'])) return 16;
        if (dayType === 'Mobility Strength Recovery' && (this.isMobilityType(exercise) || this.matchesMovement(exercise, ['core', 'posture']))) return 18;
        return 0;
    }

    private async buildDay(
        planId: string,
        dayNumber: number,
        week: number,
        dayType: DayType,
        pool: Exercise[],
        profile: Profile,
        design: ProgramDesign,
        history: Map<string, ExerciseUsage>,
        familyHistory: Map<string, ExerciseUsage>,
    ) {
        const scoredPool = this.scoreExercises(pool, profile, dayType, design);
        const counts = this.getDayExerciseCounts(profile.timePerWorkout, dayType);
        const context: BuildContext = { dayNumber, week, dayType, design, history, familyHistory, dayFamilies: new Map() };
        const selectedExercises = this.buildWorkoutFromSlots(scoredPool, profile, counts, context);
        const minimumTotal = this.getMinimumExerciseTotal(counts);

        if (selectedExercises.length < minimumTotal) {
            throw new PlanGenerationCoverageError(
                `Only ${selectedExercises.length} exercises available for day ${dayNumber}; expected at least ${minimumTotal}`,
            );
        }

        const workoutDay = await prisma.workoutDay.create({
            data: {
                planId,
                dayNumber,
                weekNumber: week,
                dayType,
                estimatedMinutes: profile.timePerWorkout,
            },
        });

        for (let i = 0; i < selectedExercises.length; i++) {
            const exercise = selectedExercises[i];
            if (!exercise) continue;

            const prescription = this.getPrescription(exercise, profile, week, design);

            await prisma.workoutExercise.create({
                data: {
                    workoutDayId: workoutDay.id,
                    exerciseId: exercise.id,
                    role: exercise.role || 'main',
                    targetSets: prescription.sets,
                    targetReps: prescription.reps,
                    targetSeconds: prescription.seconds,
                    targetRestSeconds: prescription.rest,
                    sortOrder: i,
                    notes: prescription.note,
                },
            });
        }

        this.recordUsage(selectedExercises, dayNumber, history, familyHistory);
    }

    private getDayExerciseCounts(time: number, dayType: DayType): DayExerciseCounts {
        if (time >= 60) return { warmUp: 5, main: dayType.includes('Conditioning') ? 6 : 6, stretch: 3 };
        if (time >= 40) return { warmUp: 5, main: dayType.includes('Conditioning') ? 6 : 6, stretch: 3 };
        if (time >= 25) return { warmUp: 4, main: 5, stretch: 3 };
        return { warmUp: 3, main: 4, stretch: 2 };
    }

    private buildWorkoutFromSlots(
        pool: RankedExercise[],
        profile: Profile,
        counts: DayExerciseCounts,
        context: BuildContext,
    ): RankedExercise[] {
        const used = new Set<string>();
        const usedNames = new Set<string>();
        const selected: RankedExercise[] = [];

        const slots: WorkoutSlot[] = [
            ...this.getWarmUpSlots(counts.warmUp),
            ...this.getMainSlots(context.dayType, counts.main, profile),
            ...this.getCoolOffSlots(counts.stretch),
        ];

        for (const slot of slots) {
            const exercise = this.selectForSlot(pool, slot, used, usedNames, profile, context);
            if (!exercise) continue;

            used.add(exercise.id);
            usedNames.add(this.getExerciseDisplayKey(exercise));
            this.recordDayFamily(exercise, context);
            selected.push({ ...exercise, role: slot.role });
        }

        const minimumTotal = this.getMinimumExerciseTotal(counts);
        if (selected.length < minimumTotal) {
            const fillers = this.takeFallbackExercises(pool, minimumTotal - selected.length, used, usedNames, profile, context);
            fillers.forEach((exercise) => {
                used.add(exercise.id);
                usedNames.add(this.getExerciseDisplayKey(exercise));
                this.recordDayFamily(exercise, context);
                selected.push(exercise);
            });
        }

        return selected;
    }

    private getMinimumExerciseTotal(counts: DayExerciseCounts) {
        return counts.warmUp + Math.max(3, counts.main - 1) + counts.stretch;
    }

    private canBuildCompleteProgram(pool: Exercise[], profile: Profile, design: ProgramDesign) {
        if (pool.length === 0) return false;

        const history = new Map<string, ExerciseUsage>();
        const familyHistory = new Map<string, ExerciseUsage>();

        for (let week = 1; week <= 4; week++) {
            for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
                const dayType = design.schedule[dayInWeek] ?? 'Rest';
                if (dayType === 'Rest') continue;

                const dayNumber = (week - 1) * 7 + dayInWeek + 1;
                const counts = this.getDayExerciseCounts(profile.timePerWorkout, dayType);
                const context: BuildContext = { dayNumber, week, dayType, design, history, familyHistory, dayFamilies: new Map() };
                const scoredPool = this.scoreExercises(pool, profile, dayType, design);
                const selected = this.buildWorkoutFromSlots(scoredPool, profile, counts, context);

                if (selected.length < this.getMinimumExerciseTotal(counts)) {
                    return false;
                }

                this.recordUsage(selected, dayNumber, history, familyHistory);
            }
        }

        return true;
    }

    private getWarmUpSlots(count: number): WorkoutSlot[] {
        const templates: WorkoutSlot[] = [
            {
                label: 'warm-up-spine-hips',
                role: 'warm-up',
                movements: ['mobility'],
                workoutTypes: ['mobility'],
                focusBoosts: ['Back and posture', 'Glutes and legs'],
            },
            {
                label: 'warm-up-activation',
                role: 'warm-up',
                movements: ['core', 'posture', 'hinge'],
                workoutTypes: ['strength', 'mobility'],
                focusBoosts: ['Core', 'Glutes and legs', 'Back and posture'],
            },
            {
                label: 'warm-up-movement-prep',
                role: 'warm-up',
                movements: ['squat', 'lunge', 'push', 'pull', 'mobility'],
                workoutTypes: ['strength', 'mobility'],
                focusBoosts: ['Full body balance'],
            },
            {
                label: 'warm-up-cardio-primer',
                role: 'warm-up',
                movements: ['conditioning'],
                workoutTypes: ['conditioning'],
                focusBoosts: ['Full body balance'],
            },
            {
                label: 'warm-up-extra-mobility',
                role: 'warm-up',
                movements: ['mobility', 'posture'],
                workoutTypes: ['mobility'],
                focusBoosts: ['Back and posture'],
            },
        ];

        return templates.slice(0, count);
    }

    private getCoolOffSlots(count: number): WorkoutSlot[] {
        return Array.from({ length: count }, (_, index) => ({
            label: `cool-off-${index + 1}`,
            role: 'cool-off' as ExerciseRole,
            movements: ['stretch', 'mobility'],
            workoutTypes: ['mobility'],
        }));
    }

    private getMainSlots(dayType: DayType, count: number, profile: Profile): WorkoutSlot[] {
        const focusAreas = this.parseTags(profile.focusAreas).filter((focus) => focus !== 'Full body balance');
        const focusBoosts = focusAreas.length > 0 ? focusAreas : ['Full body balance'];

        const templates: Record<Exclude<DayType, 'Rest'>, WorkoutSlot[]> = {
            'Lower Body Strength': [
                this.mainSlot('squat-prime', ['squat'], focusBoosts),
                this.mainSlot('hinge-prime', ['hinge'], focusBoosts),
                this.mainSlot('single-leg', ['lunge'], focusBoosts),
                this.mainSlot('core-bracing', ['core'], ['Core']),
                this.mainSlot('posterior-accessory', ['hinge', 'posture'], ['Glutes and legs', 'Back and posture'], 'accessory'),
                this.mainSlot('low-impact-finish', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
            ],
            'Upper Body Strength': [
                this.mainSlot('push-prime', ['push'], ['Chest and arms']),
                this.mainSlot('pull-prime', ['pull'], ['Back and posture']),
                this.mainSlot('posture-pull', ['posture', 'pull'], ['Back and posture'], 'accessory'),
                this.mainSlot('core-stability', ['core'], ['Core']),
                this.mainSlot('secondary-push', ['push'], ['Chest and arms'], 'accessory'),
                this.mainSlot('low-impact-finish', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
            ],
            'Full Body Strength': [
                this.mainSlot('squat-or-lunge', ['squat', 'lunge'], ['Glutes and legs']),
                this.mainSlot('hinge', ['hinge'], ['Glutes and legs', 'Back and posture']),
                this.mainSlot('push', ['push'], ['Chest and arms']),
                this.mainSlot('pull', ['pull', 'posture'], ['Back and posture']),
                this.mainSlot('core', ['core'], ['Core']),
                this.mainSlot('conditioning-finish', ['conditioning', 'carry'], ['Full body balance'], 'conditioning', ['conditioning']),
            ],
            'Conditioning Core Mobility': [
                this.mainSlot('conditioning-1', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
                this.mainSlot('conditioning-2', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
                this.mainSlot('core-1', ['core'], ['Core']),
                this.mainSlot('conditioning-3', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
                this.mainSlot('core-2', ['core'], ['Core'], 'accessory'),
                this.mainSlot('mobility-control', ['mobility', 'posture'], ['Back and posture'], 'mobility', ['mobility']),
            ],
            'Full Body Conditioning': [
                this.mainSlot('conditioning-1', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
                this.mainSlot('conditioning-2', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
                this.mainSlot('legs', ['squat', 'lunge'], ['Glutes and legs']),
                this.mainSlot('upper', ['push', 'pull'], ['Chest and arms', 'Back and posture']),
                this.mainSlot('core', ['core'], ['Core']),
                this.mainSlot('conditioning-3', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
            ],
            'Posterior Chain Core': [
                this.mainSlot('hinge-prime', ['hinge'], ['Glutes and legs', 'Back and posture']),
                this.mainSlot('lunge-or-squat', ['lunge', 'squat'], ['Glutes and legs']),
                this.mainSlot('posture-pull', ['pull', 'posture'], ['Back and posture']),
                this.mainSlot('core-1', ['core'], ['Core']),
                this.mainSlot('core-2', ['core'], ['Core'], 'accessory'),
                this.mainSlot('conditioning-finish', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
            ],
            'Upper Body Posture': [
                this.mainSlot('pull-prime', ['pull'], ['Back and posture']),
                this.mainSlot('posture-prime', ['posture', 'pull'], ['Back and posture']),
                this.mainSlot('push', ['push'], ['Chest and arms']),
                this.mainSlot('core', ['core'], ['Core']),
                this.mainSlot('shoulder-control', ['mobility', 'posture'], ['Back and posture'], 'mobility', ['mobility']),
                this.mainSlot('conditioning-finish', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
            ],
            'Mobility Strength Recovery': [
                this.mainSlot('mobility-1', ['mobility'], ['Back and posture'], 'mobility', ['mobility']),
                this.mainSlot('core-control', ['core'], ['Core'], 'accessory'),
                this.mainSlot('hinge-pattern', ['hinge'], ['Glutes and legs', 'Back and posture'], 'accessory'),
                this.mainSlot('posture', ['posture', 'pull'], ['Back and posture'], 'accessory'),
                this.mainSlot('easy-conditioning', ['conditioning'], ['Full body balance'], 'conditioning', ['conditioning']),
                this.mainSlot('mobility-2', ['stretch', 'mobility'], focusBoosts, 'mobility', ['mobility']),
            ],
        };

        const slots = [...templates[dayType as Exclude<DayType, 'Rest'>]];

        while (slots.length < count) {
            slots.push(this.mainSlot(`focus-${slots.length + 1}`, ['squat', 'hinge', 'push', 'pull', 'core'], focusBoosts, 'accessory'));
        }

        return slots.slice(0, count);
    }

    private mainSlot(
        label: string,
        movements: MovementGroup[],
        focusBoosts: string[],
        role: ExerciseRole = 'main',
        workoutTypes: WorkoutTypeGroup[] = ['strength'],
    ): WorkoutSlot {
        return {
            label,
            role,
            movements,
            focusBoosts,
            workoutTypes,
            required: role === 'main',
        };
    }

    private selectForSlot(
        pool: RankedExercise[],
        slot: WorkoutSlot,
        used: Set<string>,
        usedNames: Set<string>,
        profile: Profile,
        context: BuildContext,
    ): RankedExercise | null {
        const candidates = pool
            .filter((exercise) => !used.has(exercise.id))
            .filter((exercise) => !usedNames.has(this.getExerciseDisplayKey(exercise)))
            .filter((exercise) => this.matchesSlot(exercise, slot));

        const rankedCandidates = candidates.length > 0
            ? candidates
            : pool.filter((exercise) => !used.has(exercise.id) && !usedNames.has(this.getExerciseDisplayKey(exercise)) && this.matchesFallbackRole(exercise, slot.role));

        return this.pickBest(rankedCandidates, slot, profile, context);
    }

    private pickBest(
        candidates: RankedExercise[],
        slot: WorkoutSlot,
        profile: Profile,
        context: BuildContext,
    ): RankedExercise | null {
        let best: RankedExercise | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const exercise of candidates) {
            const score = this.scoreForSlot(exercise, slot, profile, context);
            if (score > bestScore) {
                best = exercise;
                bestScore = score;
            }
        }

        return best;
    }

    private scoreForSlot(exercise: RankedExercise, slot: WorkoutSlot, profile: Profile, context: BuildContext): number {
        let score = exercise.score;
        const focusTags = this.parseTags(exercise.focusAreaTags);
        const userFocus = this.parseTags(profile.focusAreas);
        const usage = context.history.get(exercise.id);
        const family = this.getExerciseFamily(exercise);
        const familyUsage = context.familyHistory.get(family);
        const sameDayFamilyCount = context.dayFamilies.get(family) ?? 0;

        if (slot.movements?.some((movement) => this.matchesMovement(exercise, [movement]))) score += 30;
        if (slot.workoutTypes?.some((type) => this.matchesWorkoutType(exercise, type))) score += 18;

        for (const focus of slot.focusBoosts ?? []) {
            if (focusTags.includes(focus)) score += 12;
        }

        for (const focus of userFocus) {
            if (focusTags.includes(focus) && focus !== 'Full body balance') score += 8;
        }

        score += this.getAbilityFitBonus(exercise, slot, profile);
        score -= this.getSameDayFamilyPenalty(family, sameDayFamilyCount, slot);
        score -= this.getLowValueExercisePenalty(exercise, profile, slot);

        if (slot.role === 'warm-up') {
            if (this.isMobilityType(exercise)) score += 14;
            if (this.isPilatesType(exercise) || this.matchesMovement(exercise, ['core', 'posture', 'hinge'])) score += 10;
            if (this.isWarmUpConditioning(exercise)) score += this.isBasicCardioFiller(exercise) ? -45 : 12;
            if (slot.movements?.includes('conditioning') && this.isWarmUpConditioning(exercise)) score += 20;
            if (this.isCoolOffCandidate(exercise)) score -= 40;
            if (this.matchesMovement(exercise, ['stretch'])) score -= 12;
        }

        if (slot.role === 'cool-off') {
            if (this.parseTags(exercise.phaseTags).includes('Cool off')) score += 16;
            if (this.matchesMovement(exercise, ['stretch'])) score += 10;
        }

        if (usage) {
            score -= usage.count * 7;
            const daysSinceUsed = context.dayNumber - usage.lastDay;
            if (daysSinceUsed <= 1) score -= 45;
            else if (daysSinceUsed <= 3) score -= 22;
            else if (daysSinceUsed <= 7) score -= 8;
        }

        if (familyUsage) {
            score -= Math.min(28, familyUsage.count * 3);
            const daysSinceFamilyUsed = context.dayNumber - familyUsage.lastDay;
            if (daysSinceFamilyUsed <= 1) score -= 30;
            else if (daysSinceFamilyUsed <= 3) score -= 16;
            else if (daysSinceFamilyUsed <= 7) score -= 6;
        }

        return score;
    }

    private matchesSlot(exercise: RankedExercise, slot: WorkoutSlot): boolean {
        if (slot.role === 'warm-up') return this.isWarmUpCandidate(exercise);
        if (slot.role === 'cool-off') return this.isCoolOffCandidate(exercise);
        if (slot.role === 'mobility') return this.isMobilityType(exercise) || this.matchesMovement(exercise, ['mobility', 'stretch']);

        const movementMatches = !slot.movements || slot.movements.some((movement) => this.matchesMovement(exercise, [movement]));
        const typeMatches = !slot.workoutTypes || slot.workoutTypes.some((type) => this.matchesWorkoutType(exercise, type));

        return movementMatches && typeMatches;
    }

    private matchesFallbackRole(exercise: RankedExercise, role: ExerciseRole): boolean {
        if (role === 'warm-up') return this.isMobilityType(exercise);
        if (role === 'cool-off') return this.isCoolOffCandidate(exercise) || this.isMobilityType(exercise);
        if (role === 'conditioning') return this.isConditioningType(exercise) || this.parseTags(exercise.phaseTags).includes('Main exercise');
        if (role === 'mobility') return this.isMobilityType(exercise);
        return this.parseTags(exercise.phaseTags).includes('Main exercise') || this.isStrengthType(exercise);
    }

    private takeFallbackExercises(
        pool: RankedExercise[],
        count: number,
        used: Set<string>,
        usedNames: Set<string>,
        profile: Profile,
        context: BuildContext,
    ): RankedExercise[] {
        const fallbackSlot: WorkoutSlot = {
            label: 'safe-fallback',
            role: 'accessory',
            movements: ['squat', 'hinge', 'push', 'pull', 'core', 'conditioning', 'mobility'],
            workoutTypes: ['strength', 'conditioning', 'mobility'],
        };

        const nonLegacyPool = pool.filter((exercise) => !this.isLegacyFallbackExercise(exercise));
        const fallbackPool = nonLegacyPool.length > 0 ? nonLegacyPool : pool;

        return fallbackPool
            .filter((exercise) => !used.has(exercise.id))
            .filter((exercise) => !usedNames.has(this.getExerciseDisplayKey(exercise)))
            .map((exercise) => ({
                exercise,
                score: this.scoreForSlot(exercise, fallbackSlot, profile, context),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, count)
            .map(({ exercise }) => ({ ...exercise, role: this.isMobilityType(exercise) ? 'mobility' : 'accessory' }));
    }

    private getPrescription(
        exercise: RankedExercise,
        profile: Profile,
        week: number,
        design: ProgramDesign,
    ): { sets: number | null; reps: number | null; seconds: number | null; rest: number | null; note: string | null } {
        const role = exercise.role || 'main';
        const expRank = this.getUserExperienceRank(profile);
        const lowRecovery = design.recoveryLevel === 'low';
        const isCoreHold = this.isCoreHold(exercise);
        const isMobility = role === 'warm-up' || role === 'cool-off' || role === 'mobility' || this.isMobilityType(exercise);
        const isConditioning = role === 'conditioning' || this.isConditioningType(exercise);

        if (isMobility) {
            const seconds = profile.timePerWorkout <= 15 ? 30 : role === 'cool-off' ? 45 : 40;
            return { sets: 1, reps: null, seconds, rest: role === 'warm-up' ? 10 : 0, note: null };
        }

        if (isConditioning) {
            let sets = profile.timePerWorkout >= 60 ? 6 : profile.timePerWorkout >= 40 ? 5 : profile.timePerWorkout >= 25 ? 4 : 3;
            let seconds = 30;
            let rest = 30;

            if (profile.intensityPreference === 'Easy') {
                seconds = 20;
                rest = 40;
            } else if (profile.intensityPreference === 'Hard') {
                seconds = 40;
                rest = 20;
            }

            if (lowRecovery || expRank === 0) sets = Math.max(3, sets - 1);
            if (week === 2 && !lowRecovery) sets += 1;
            if (week === 3 && !lowRecovery) seconds += 5;
            if (week === 4 && lowRecovery) sets = Math.max(3, sets - 1);

            return { sets, reps: null, seconds, rest, note: 'Intervals: work for target seconds, then rest.' };
        }

        if (isCoreHold) {
            let sets = expRank <= 0 ? 2 : expRank === 1 ? 3 : 3;
            let seconds = expRank <= 0 ? 20 : expRank === 1 ? 30 : expRank === 2 ? 40 : 50;
            let rest = expRank >= 2 ? 60 : 45;

            if (this.matchesMovement(exercise, ['core']) && profile.startingAbilityPlank) {
                seconds = this.getStartingPlankSeconds(profile.startingAbilityPlank, seconds);
            }

            if (role === 'accessory') sets = Math.min(sets, 2);
            if (week === 2 && !lowRecovery && role === 'main') sets += 1;
            if (week === 3 && !lowRecovery) seconds += 10;
            if (week === 4 && lowRecovery) sets = Math.max(2, sets - 1);

            return { sets, reps: null, seconds, rest, note: null };
        }

        let sets = expRank <= 0 ? 2 : expRank === 1 ? 3 : expRank === 2 ? 3 : 4;
        let reps = expRank <= 0 ? 8 : expRank === 1 ? 10 : 8;
        let rest = expRank <= 1 ? 60 : expRank === 2 ? 75 : 90;

        if (profile.goal === 'Build muscle') {
            reps += expRank >= 2 ? 2 : 1;
            rest += 15;
        } else if (profile.goal === 'Get stronger') {
            reps = Math.max(6, reps - 2);
            rest += 30;
        } else if (profile.goal === 'Lose body fat' || profile.goal === 'Improve stamina') {
            reps += 2;
            rest = Math.max(45, rest - 15);
        }

        if (role === 'accessory') {
            sets = Math.min(sets, profile.timePerWorkout <= 25 ? 2 : 3);
            reps = Math.max(reps, 10);
        }

        if (profile.timePerWorkout <= 15) sets = Math.min(sets, 2);
        if (lowRecovery) sets = Math.max(2, sets - 1);

        if (week === 2 && !lowRecovery && role === 'main' && profile.timePerWorkout >= 25) sets += 1;
        if (week === 3 && !lowRecovery) reps += 2;
        if (week === 4 && (lowRecovery || profile.intensityPreference === 'Easy')) sets = Math.max(2, sets - 1);

        return { sets, reps, seconds: null, rest, note: null };
    }

    private async buildOptionalRecoveryDays(
        planId: string,
        startDay: number,
        pool: Exercise[],
        profile: Profile,
        history: Map<string, ExerciseUsage>,
        familyHistory: Map<string, ExerciseUsage>,
    ) {
        const rankedPool = this.scoreExercises(pool, profile, 'Mobility Strength Recovery', this.designProgram(profile));
        const recoveryPool = rankedPool.filter((exercise) => this.isMobilityType(exercise) || this.isCoolOffCandidate(exercise));

        for (let i = 0; i < 2; i++) {
            const dayNumber = startDay + i;
            const day = await prisma.workoutDay.create({
                data: {
                    planId,
                    dayNumber,
                    weekNumber: 5,
                    dayType: 'Mobility Strength Recovery',
                    isOptional: true,
                    estimatedMinutes: 15,
                },
            });

            const selected = (recoveryPool.length > 0 ? recoveryPool : rankedPool)
                .filter((exercise) => !history.has(exercise.id) || (history.get(exercise.id)?.lastDay ?? 0) < dayNumber - 2)
                .slice(0, 5);

            for (let j = 0; j < selected.length; j++) {
                const exercise = selected[j];
                if (!exercise) continue;

                await prisma.workoutExercise.create({
                    data: {
                        workoutDayId: day.id,
                        exerciseId: exercise.id,
                        role: 'mobility',
                        targetSets: 1,
                        targetSeconds: 45,
                        targetRestSeconds: 0,
                        sortOrder: j,
                    },
                });
            }

            this.recordUsage(selected.map((exercise) => ({ ...exercise, role: 'mobility' })), dayNumber, history, familyHistory);
        }
    }

    private async cleanupPartialPlan(planId: string) {
        try {
            await prisma.exerciseLog.deleteMany({
                where: {
                    workoutExercise: {
                        workoutDay: { planId },
                    },
                },
            });
            await prisma.workoutExercise.deleteMany({
                where: {
                    workoutDay: { planId },
                },
            });
            await prisma.workoutDay.deleteMany({ where: { planId } });
            await prisma.plan.delete({ where: { id: planId } });
        } catch (cleanupError) {
            console.error(`[PlanGenerator] Failed to clean up partial plan ${planId}`, cleanupError);
        }
    }

    private recordUsage(
        exercises: RankedExercise[],
        dayNumber: number,
        history: Map<string, ExerciseUsage>,
        familyHistory: Map<string, ExerciseUsage>,
    ) {
        for (const exercise of exercises) {
            const previous = history.get(exercise.id);
            history.set(exercise.id, {
                count: (previous?.count ?? 0) + 1,
                lastDay: dayNumber,
            });

            const family = this.getExerciseFamily(exercise);
            const previousFamily = familyHistory.get(family);
            familyHistory.set(family, {
                count: (previousFamily?.count ?? 0) + 1,
                lastDay: dayNumber,
            });
        }
    }

    private recordDayFamily(exercise: Exercise, context: BuildContext) {
        const family = this.getExerciseFamily(exercise);
        context.dayFamilies.set(family, (context.dayFamilies.get(family) ?? 0) + 1);
    }

    private getExerciseDisplayKey(exercise: Exercise): string {
        return exercise.name
            .toLowerCase()
            .replace(/\s*\(fallback only\)\s*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private isWarmUpCandidate(exercise: Exercise): boolean {
        const phases = this.parseTags(exercise.phaseTags);
        return phases.includes('Warm up') ||
            this.isMobilityType(exercise) ||
            this.matchesMovement(exercise, ['mobility']) ||
            (this.isWarmUpConditioning(exercise) && !this.isBasicCardioFiller(exercise));
    }

    private isCoolOffCandidate(exercise: Exercise): boolean {
        const phases = this.parseTags(exercise.phaseTags);
        return phases.includes('Cool off') || phases.includes('Stretching') || this.matchesMovement(exercise, ['stretch']);
    }

    private matchesWorkoutType(exercise: Exercise, type: WorkoutTypeGroup): boolean {
        if (type === 'strength') return this.isStrengthType(exercise);
        if (type === 'conditioning') return this.isConditioningType(exercise);
        return this.isMobilityType(exercise);
    }

    private isStrengthType(exercise: Exercise): boolean {
        const type = exercise.workoutType.toLowerCase();
        return type.includes('strength') || type.includes('pilates') || type.includes('core control');
    }

    private isConditioningType(exercise: Exercise): boolean {
        const type = exercise.workoutType.toLowerCase();
        return !type.includes('legacy') && (type.includes('conditioning') || type.includes('cardio'));
    }

    private isWarmUpConditioning(exercise: Exercise): boolean {
        return this.isConditioningType(exercise) && exercise.impactLevel.toLowerCase() === 'low';
    }

    private isMobilityType(exercise: Exercise): boolean {
        const type = exercise.workoutType.toLowerCase();
        const movement = exercise.movementPattern.toLowerCase();
        return type.includes('mobility') ||
            type.includes('recovery') ||
            movement.includes('mobility') ||
            movement.includes('stretch');
    }

    private isPilatesType(exercise: Exercise): boolean {
        const type = exercise.workoutType.toLowerCase();
        const movement = exercise.movementPattern.toLowerCase();
        const notes = (exercise.notes || '').toLowerCase();
        return type.includes('pilates') || movement.includes('pilates') || notes.includes('modality:pilates');
    }

    private matchesMovement(exercise: Exercise, groups: MovementGroup[]): boolean {
        const movement = exercise.movementPattern.toLowerCase();
        const name = exercise.name.toLowerCase();
        const phases = this.parseTags(exercise.phaseTags);
        const focus = this.parseTags(exercise.focusAreaTags);

        return groups.some((group) => {
            if (group === 'squat') return movement.includes('squat') || movement.includes('knee-dominant');
            if (group === 'hinge') return movement.includes('hinge') || movement.includes('glute') || movement.includes('posterior chain') || name.includes('deadlift') || name.includes('bridge') || name.includes('swing') || name.includes('hip thrust');
            if (group === 'lunge') return movement.includes('lunge') || movement.includes('step') || movement.includes('split squat');
            if (group === 'push') return movement.includes('push') || movement.includes('press') || name.includes('press') || name.includes('dip') || name.includes('push-up');
            if (group === 'pull') return movement.includes('pull') || movement.includes('row') || movement.includes('posterior shoulder') || name.includes('row') || name.includes('pull-up') || name.includes('chin-up');
            if (group === 'core') return movement.includes('core') || movement.includes('pilates') || movement.includes('anti-') || focus.includes('Core');
            if (group === 'conditioning') return this.isConditioningType(exercise);
            if (group === 'mobility') return movement.includes('mobility') || this.isMobilityType(exercise);
            if (group === 'stretch') return movement.includes('stretch') || phases.includes('Stretching');
            if (group === 'carry') return movement.includes('carry');
            if (group === 'posture') return movement.includes('posture') || movement.includes('thoracic') || movement.includes('posterior shoulder') || focus.includes('Back and posture');
            return false;
        });
    }

    private getProfileSpecificBonus(exercise: Exercise, profile: Profile, dayType: DayType): number {
        const focusAreas = this.parseTags(profile.focusAreas);
        const userEquipment = this.parseTags(profile.equipment);
        const movementRestrictions = this.parseTags(profile.movementRestrictions);
        const name = exercise.name.toLowerCase();
        const movement = exercise.movementPattern.toLowerCase();
        const equipment = this.parseTags(exercise.equipmentTags);
        const expRank = this.getUserExperienceRank(profile);
        let bonus = 0;

        if (userEquipment.includes('No equipment') && equipment.includes('No equipment')) bonus += 6;
        if (profile.timePerWorkout <= 25 && equipment.every((tag) => tag === 'No equipment')) bonus += 4;

        if (focusAreas.includes('Core') && this.matchesMovement(exercise, ['core'])) bonus += this.isPilatesType(exercise) ? 22 : 14;
        if (focusAreas.includes('Glutes and legs') && this.matchesMovement(exercise, ['squat', 'hinge', 'lunge'])) bonus += 16;
        if (focusAreas.includes('Glutes and legs') && movement.includes('glute')) bonus += 18;
        if (focusAreas.includes('Back and posture') && this.matchesMovement(exercise, ['pull', 'posture'])) bonus += 18;
        if (focusAreas.includes('Chest and arms') && this.matchesMovement(exercise, ['push'])) bonus += 18;

        if (profile.goal === 'Improve mobility') {
            if (this.isMobilityType(exercise)) bonus += 18;
            if (this.isPilatesType(exercise)) bonus += 12;
            if (this.isConditioningType(exercise)) bonus -= 10;
        }

        if (profile.goal === 'Build muscle' || profile.goal === 'Get stronger') {
            if (this.isLoadedStrengthExercise(exercise)) bonus += 16;
            if (this.isPilatesType(exercise) && this.matchesMovement(exercise, ['core', 'hinge'])) bonus += 8;
            if (this.isBasicCardioFiller(exercise)) bonus -= 35;
        }

        if (profile.goal === 'Lose body fat' || profile.goal === 'Improve stamina') {
            if (this.isAthleticConditioningExercise(exercise)) bonus += 18;
            if (this.isStrengthType(exercise) && dayType.includes('Strength')) bonus += 8;
            if (this.isBasicCardioFiller(exercise)) bonus -= 28;
        }

        if (profile.workoutStylePreference === 'Mostly strength training') {
            if (this.isLoadedStrengthExercise(exercise) || this.isPilatesType(exercise)) bonus += 10;
            if (this.isBasicCardioFiller(exercise)) bonus -= 40;
        }

        if (profile.workoutStylePreference === 'Mostly cardio') {
            if (this.isAthleticConditioningExercise(exercise)) bonus += 20;
            if (this.isBasicCardioFiller(exercise)) bonus -= 30;
        }

        if (profile.intensityPreference === 'Easy') {
            if (exercise.impactLevel.toLowerCase() === 'low') bonus += 8;
            if (this.isPilatesType(exercise) || this.isMobilityType(exercise)) bonus += 6;
            if (movement.includes('plyometric') || name.includes('hop') || name.includes('jump')) bonus -= 24;
        }

        if (profile.intensityPreference === 'Hard') {
            if (this.isLoadedStrengthExercise(exercise) || this.isAthleticConditioningExercise(exercise)) bonus += 14;
            if (expRank >= 2 && (name.includes('bulgarian') || name.includes('decline') || movement.includes('advanced'))) bonus += 10;
            if (this.isBasicCardioFiller(exercise)) bonus -= 45;
        }

        if (profile.experienceLevel === 'beginner') {
            if (name.includes('wall') || name.includes('incline') || name.includes('sit-to-stand') || name.includes('modified')) bonus += 10;
            if (this.isPilatesType(exercise) && !movement.includes('advanced')) bonus += 6;
        }

        if (movementRestrictions.includes('Jumping is difficult') || this.parseTags(profile.preferenceExclusions).includes('Jumping')) {
            if (exercise.impactLevel.toLowerCase() === 'low') bonus += 10;
        }

        if (movementRestrictions.includes('Push-ups are difficult') && name.includes('push-up')) {
            if (name.includes('wall') || name.includes('incline') || name.includes('knee')) bonus += 16;
        }

        return bonus;
    }

    private getLowValueExercisePenalty(exercise: Exercise, profile: Profile, slot?: WorkoutSlot): number {
        const name = exercise.name.toLowerCase();
        let penalty = 0;

        if (this.isLegacyFallbackExercise(exercise)) penalty += 120;
        if (this.isBasicCardioFiller(exercise)) penalty += 70;

        if (slot?.role === 'warm-up' && this.isBasicCardioFiller(exercise)) penalty += 45;
        if (slot?.role === 'conditioning' && this.isBasicCardioFiller(exercise)) penalty += 35;

        if (name.includes('walk') && name.includes('stair')) penalty += 80;
        if (name.includes('jog in place') || name.includes('march in place')) penalty += 90;
        if (name.includes('step jack')) penalty += 65;
        if (profile.workoutStylePreference !== 'Mostly cardio' && this.isConditioningType(exercise) && this.isBasicCardioFiller(exercise)) penalty += 35;

        return penalty;
    }

    private getSameDayFamilyPenalty(family: string, sameDayCount: number, slot: WorkoutSlot): number {
        if (sameDayCount <= 0) return 0;
        if (family === 'basic-cardio') return 220;
        if (slot.role === 'warm-up') return 90 * sameDayCount;
        if (slot.role === 'cool-off' && family.includes('stretch')) return 22 * sameDayCount;
        if (family.includes('conditioning')) return 70 * sameDayCount;
        if (family.includes('core') || family.includes('pilates')) return 34 * sameDayCount;
        return 55 * sameDayCount;
    }

    private getExerciseFamily(exercise: Exercise): string {
        const notesFamily = this.getFamilyFromNotes(exercise);
        if (notesFamily) return notesFamily;

        const name = exercise.name.toLowerCase();
        const movement = exercise.movementPattern.toLowerCase();

        if (this.isBasicCardioFiller(exercise)) return 'basic-cardio';
        if (name.includes('mountain climber')) return movement.includes('rotation') ? 'mountain-climber-rotation' : 'mountain-climber-control';
        if (name.includes('burpee')) return 'burpee';
        if (name.includes('skater')) return 'skater-conditioning';
        if (name.includes('plank') && name.includes('shoulder')) return 'plank-anti-rotation';
        if (name.includes('side plank')) return 'core-lateral';
        if (name.includes('plank')) return 'core-plank';
        if (name.includes('dead bug')) return 'core-anti-extension';
        if (name.includes('bird dog')) return 'core-anti-rotation';
        if (movement.includes('pilates')) return 'pilates-control';
        if (movement.includes('squat')) return name.includes('goblet') ? 'squat-loaded' : 'squat';
        if (movement.includes('lunge') || movement.includes('step')) return 'lunge';
        if (movement.includes('hinge') || name.includes('bridge') || name.includes('deadlift')) return 'hinge';
        if (movement.includes('push') || name.includes('press') || name.includes('push-up')) return 'push';
        if (movement.includes('pull') || movement.includes('row')) return 'pull';
        if (movement.includes('stretch')) return `${movement.split(/\s+/).slice(0, 2).join('-')}-stretch`;
        if (movement.includes('mobility')) return `${movement.split(/\s+/).slice(0, 2).join('-')}-mobility`;
        if (this.isConditioningType(exercise)) return 'conditioning';
        if (this.isMobilityType(exercise)) return 'mobility';
        return exercise.id;
    }

    private getFamilyFromNotes(exercise: Exercise): string | null {
        const notes = exercise.notes || '';
        const match = notes.match(/family:([a-z0-9-]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    private isPremiumExercise(exercise: Exercise): boolean {
        return (exercise.notes || '').toLowerCase().includes('quality:premium') ||
            (exercise.externalId || '').startsWith('CUR');
    }

    private isLegacyFallbackExercise(exercise: Exercise): boolean {
        const notes = (exercise.notes || '').toLowerCase();
        const type = exercise.workoutType.toLowerCase();
        const name = exercise.name.toLowerCase();
        return notes.includes('quality:legacy') || type.includes('legacy') || name.includes('fallback only');
    }

    private isBasicCardioFiller(exercise: Exercise): boolean {
        const family = this.getFamilyFromNotes(exercise);
        if (family === 'basic-cardio') return true;

        const name = exercise.name.toLowerCase();
        return name.includes('jog in place') ||
            name.includes('march in place') ||
            name.includes('stair walk') ||
            name.includes('walk-jog') ||
            name.includes('step jack') ||
            name.includes('jumping jack') ||
            name.includes('high knees');
    }

    private isLoadedStrengthExercise(exercise: Exercise): boolean {
        const equipment = this.parseTags(exercise.equipmentTags);
        const movement = exercise.movementPattern.toLowerCase();
        return this.isStrengthType(exercise) &&
            (equipment.includes('Dumbbells') ||
                equipment.includes('Kettlebell') ||
                equipment.includes('Resistance bands') ||
                movement.includes('loaded'));
    }

    private isAthleticConditioningExercise(exercise: Exercise): boolean {
        const movement = exercise.movementPattern.toLowerCase();
        const notes = (exercise.notes || '').toLowerCase();
        return this.isConditioningType(exercise) &&
            !this.isBasicCardioFiller(exercise) &&
            (movement.includes('conditioning') || notes.includes('modality:conditioning'));
    }

    private getAbilityFitBonus(exercise: Exercise, slot: WorkoutSlot, profile: Profile): number {
        const name = exercise.name.toLowerCase();
        let bonus = 0;

        if (slot.movements?.includes('push') && profile.startingAbilityPushups) {
            const ability = profile.startingAbilityPushups;
            if (ability === '0' && (name.includes('wall push-up') || name.includes('incline push-up'))) bonus += 35;
            if (ability === '1-5' && (name.includes('incline push-up') || name.includes('knee push-up'))) bonus += 35;
            if (ability === '6-15' && name.includes('standard push-up')) bonus += 35;
            if (ability === '16+' && (name.includes('decline push-up') || name.includes('standard push-up'))) bonus += 30;
        }

        if (slot.movements?.some((movement) => movement === 'squat' || movement === 'lunge') && profile.startingAbilitySquats) {
            const ability = profile.startingAbilitySquats;
            if (ability === '0-10' && (name.includes('box squat') || name.includes('chair'))) bonus += 35;
            if (ability === '11-25' && name.includes('bodyweight squat')) bonus += 35;
            if (ability === '26-50' && (name.includes('goblet squat') || name.includes('tempo squat'))) bonus += 30;
            if (ability === '50+' && (name.includes('goblet squat') || name.includes('bulgarian') || name.includes('split'))) bonus += 28;
        }

        if (slot.movements?.includes('core') && profile.startingAbilityPlank) {
            const ability = profile.startingAbilityPlank;
            if (ability === 'under 20 seconds' && (name.includes('knees') || name.includes('dead bug'))) bonus += 35;
            if (ability === '20-45' && (name.includes('front plank') || name.includes('dead bug'))) bonus += 30;
            if ((ability === '45-90' || ability === '90+') && (name.includes('side plank') || name.includes('front plank'))) bonus += 28;
        }

        return bonus;
    }

    private isCoreHold(exercise: Exercise): boolean {
        const name = exercise.name.toLowerCase();
        return this.matchesMovement(exercise, ['core']) && (
            name.includes('plank') ||
            name.includes('hold') ||
            name.includes('hang') ||
            name.includes('wall sit')
        );
    }

    private getStartingPlankSeconds(ability: string, fallback: number): number {
        if (ability === 'under 20 seconds') return Math.min(fallback, 20);
        if (ability === '20-45') return Math.max(25, Math.min(fallback, 35));
        if (ability === '45-90') return Math.max(40, fallback);
        if (ability === '90+') return Math.max(50, fallback);
        return fallback;
    }

    private getRecoveryLevel(profile: Profile): ProgramDesign['recoveryLevel'] {
        if (profile.sleepBucket === 'Under 6 hours') return 'low';
        if (profile.intensityPreference === 'Easy') return 'low';
        if (profile.sleepBucket === '8+ hours' && profile.intensityPreference === 'Hard') return 'high';
        return 'normal';
    }

    private getUserExperienceRank(profile: Profile): number {
        return this.getDifficultyRank(profile.experienceLevel);
    }

    private getDifficultyRank(value: string): number {
        const normalized = value.toLowerCase();
        const rank = DIFFICULTY_ORDER.findIndex((difficulty) => normalized.includes(difficulty));
        return rank >= 0 ? rank : 0;
    }

    private hasSetupFriction(exercise: Exercise): boolean {
        const equipment = this.parseTags(exercise.equipmentTags);
        return equipment.some((tag) => tag !== 'No equipment' && tag !== 'Resistance bands');
    }

    private parseTags(value: string | null): string[] {
        if (!value) return [];

        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .flatMap((item) => String(item).split(';'))
                    .map((item) => item.trim())
                    .filter(Boolean);
            }
        } catch {
            // Fall through to loose parsing for legacy strings.
        }

        return value
            .split(/[;,]/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }
}
