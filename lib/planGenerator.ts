/**
 * Personalized Workout Plan Generator V2
 * 
 * Generates a 30-day personalized workout plan based on user profile.
 * Implements hard filtering, soft scoring, fixed weekly structure,
 * and week-over-week progression.
 */

import { PrismaClient, Exercise, Profile } from '@prisma/client';

const prisma = new PrismaClient();

// Day types for the weekly structure
type DayType =
    | "Strength Lower Focus"
    | "Strength Upper Focus"
    | "Conditioning Core Mobility"
    | "Strength Balanced Posture"
    | "Rest";

// Exercise with score for ranking
interface RankedExercise extends Exercise {
    score: number;
    role?: string;
}

interface DayExerciseCounts {
    warmUp: number;
    main: number;
    stretch: number;
    core: number;
    mobility: number;
}

// Time budgets by workout duration
const TIME_BUDGETS: Record<number, { warmUp: number; main: number; coolOff: number; finisher: number }> = {
    15: { warmUp: 2, main: 11, coolOff: 2, finisher: 0 },
    25: { warmUp: 4, main: 17, coolOff: 4, finisher: 0 },
    40: { warmUp: 5, main: 28, coolOff: 5, finisher: 5 },
    60: { warmUp: 7, main: 43, coolOff: 7, finisher: 8 }
};

export class PlanGenerator {

    /**
     * Main entry point: Generate a complete 30-day plan
     */
    async generate(userId: string, profile: Profile) {
        console.log(`[PlanGenerator] Starting plan generation for user ${userId}`);

        // 1. Fetch all exercises
        const allExercises = await prisma.exercise.findMany();
        console.log(`[PlanGenerator] Loaded ${allExercises.length} exercises from database`);

        // 2. Apply hard filtering
        const allowedPool = this.filterExercises(allExercises, profile);
        console.log(`[PlanGenerator] After filtering: ${allowedPool.length} exercises allowed`);

        if (allowedPool.length < 10) {
            console.warn(`[PlanGenerator] Warning: Only ${allowedPool.length} exercises available after filtering`);
        }

        // 3. Create Plan record
        const plan = await prisma.plan.create({
            data: {
                userId,
                startDate: new Date(),
                status: 'active',
            },
        });

        // 4. Generate 4 weeks (28 days) + 2 optional recovery days
        const weeklySchedule: DayType[] = [
            "Strength Lower Focus",      // Day 1
            "Strength Upper Focus",      // Day 2
            "Rest",                       // Day 3
            "Conditioning Core Mobility", // Day 4
            "Strength Balanced Posture", // Day 5
            "Rest",                       // Day 6
            "Rest"                        // Day 7
        ];

        let usedMainLowerPattern = "";

        for (let week = 1; week <= 4; week++) {
            for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
                const dayType = weeklySchedule[dayInWeek];
                const dayNumber = (week - 1) * 7 + dayInWeek + 1;

                if (dayType === "Rest") {
                    // Create rest day
                    await prisma.workoutDay.create({
                        data: {
                            planId: plan.id,
                            dayNumber,
                            weekNumber: week,
                            dayType: "Rest",
                            estimatedMinutes: 0,
                        },
                    });
                } else {
                    // Build workout day
                    const result = await this.buildDay(
                        plan.id,
                        dayNumber,
                        week,
                        dayType,
                        allowedPool,
                        profile,
                        usedMainLowerPattern
                    );

                    // Track main lower pattern to avoid repeats
                    if (dayType === "Strength Lower Focus" && result.mainLowerPattern) {
                        usedMainLowerPattern = result.mainLowerPattern;
                    }
                }
            }
        }

        // 5. Add 2 optional recovery days (Day 29 and 30)
        await this.buildOptionalRecoveryDays(plan.id, 29, allowedPool, profile);

        // 6. Return plan with days
        return prisma.plan.findUnique({
            where: { id: plan.id },
            include: { days: true }
        });
    }

    /**
     * HARD FILTERING: Remove exercises that violate constraints
     */
    private filterExercises(exercises: Exercise[], profile: Profile): Exercise[] {
        // Parse JSON fields from profile
        const userEquipment = this.parseJson(profile.equipment);
        const painAreas = this.parseJson(profile.painAreas);
        const movementRestrictions = this.parseJson(profile.movementRestrictions);
        const preferenceExclusions = this.parseJson(profile.preferenceExclusions);

        return exercises.filter(ex => {
            const exEquipment = this.parseJson(ex.equipmentTags);
            const exAvoidFlags = this.parseJson(ex.avoidModifyFlags);
            const exExclusionFlags = this.parseJson(ex.preferenceExclusionFlags);

            // A) Equipment filtering
            if (exEquipment.length > 0) {
                const hasNoEquipment = exEquipment.includes("No equipment");
                const hasMatchingEquipment = exEquipment.some(eq => userEquipment.includes(eq));
                if (!hasNoEquipment && !hasMatchingEquipment) return false;
            }

            // B) Pain/injury constraints
            if (!painAreas.includes("None")) {
                for (const pain of painAreas) {
                    if (exAvoidFlags.includes(pain)) return false;
                }
            }

            // C) Movement restriction constraints
            for (const restriction of movementRestrictions) {
                if (restriction === "None") continue;

                if (restriction === "Squatting down is difficult") {
                    if (ex.movementPattern === "Squat" && !ex.name.toLowerCase().includes("chair") && !ex.name.toLowerCase().includes("sit-to-stand")) {
                        return false;
                    }
                }
                if (restriction === "Lunges are difficult") {
                    if (ex.movementPattern === "Lunge") return false;
                }
                if (restriction === "Push-ups are difficult") {
                    if (ex.name.toLowerCase().includes("push-up") && !ex.name.toLowerCase().includes("wall") && !ex.name.toLowerCase().includes("incline")) {
                        return false;
                    }
                }
                if (restriction === "Pull-ups are difficult") {
                    if (ex.name.toLowerCase().includes("pull-up") && !ex.name.toLowerCase().includes("dead hang")) {
                        return false;
                    }
                }
                if (restriction === "Jumping is difficult" || restriction === "Running is difficult") {
                    if (ex.impactLevel === "high") return false;
                }
            }

            // D) Preference exclusions
            if (!preferenceExclusions.includes("None")) {
                for (const exclusion of preferenceExclusions) {
                    if (exExclusionFlags.includes(exclusion)) return false;

                    if (exclusion === "Running" && ex.name.toLowerCase().includes("run")) return false;
                    if (exclusion === "Jumping" && (ex.impactLevel === "high" || ex.name.toLowerCase().includes("jump"))) return false;
                    if (exclusion === "Burpees" && ex.name.toLowerCase().includes("burpee")) return false;
                }
            }

            return true;
        });
    }

    /**
     * SOFT SCORING: Rank exercises by relevance to user profile
     */
    private scoreExercises(exercises: Exercise[], profile: Profile, dayType: DayType): RankedExercise[] {
        const goal = profile.goal;
        const style = profile.workoutStylePreference;
        const focusAreas = this.parseJson(profile.focusAreas);
        const intensity = profile.intensityPreference;
        const experience = profile.experienceLevel.toLowerCase();
        const sleep = profile.sleepBucket;

        return exercises.map(ex => {
            let score = 50; // Base score

            const exFocusAreas = this.parseJson(ex.focusAreaTags);

            // Goal alignment
            if (goal === "Build muscle" || goal === "Get stronger") {
                if (ex.workoutType === "Strength training") score += 20;
                if (this.parseJson(ex.phaseTags).includes("Main exercise")) score += 10;
            }
            if (goal === "Lose body fat" || goal === "Improve stamina") {
                if (ex.workoutType === "Conditioning") score += 20;
            }
            if (goal === "Improve mobility") {
                if (ex.workoutType === "Mobility and recovery") score += 20;
            }

            // Workout style preference
            if (style === "Mostly strength training" && ex.workoutType === "Strength training") score += 15;
            if (style === "Mostly cardio" && ex.workoutType === "Conditioning") score += 15;

            // Focus area match
            for (const focus of focusAreas) {
                if (exFocusAreas.includes(focus)) score += 15;
            }

            // Experience alignment
            const expOrder = ["beginner", "some experience", "intermediate", "advanced"];
            const userExpIdx = expOrder.indexOf(experience);
            const exMinIdx = expOrder.indexOf(ex.difficultyMin.toLowerCase());
            const exMaxIdx = expOrder.indexOf(ex.difficultyMax.toLowerCase());

            if (userExpIdx >= exMinIdx && userExpIdx <= exMaxIdx) {
                score += 10; // Good fit
            } else if (userExpIdx < exMinIdx) {
                score -= 30; // Too hard
            } else if (userExpIdx > exMaxIdx + 1) {
                score -= 15; // Too easy
            }

            // Intensity preference
            if (intensity === "Easy" && ex.impactLevel === "low") score += 10;
            if (intensity === "Hard" && ex.impactLevel === "high") score += 10;

            // Sleep-based adjustment
            if (sleep === "Under 6 hours") score -= 5;

            // Day type bonus
            if (dayType === "Strength Lower Focus" && (ex.movementPattern === "Squat" || ex.movementPattern === "Hinge" || ex.movementPattern === "Lunge")) {
                score += 10;
            }
            if (dayType === "Strength Upper Focus" && (ex.movementPattern === "Push" || ex.movementPattern === "Pull")) {
                score += 10;
            }
            if (dayType === "Conditioning Core Mobility" && (ex.workoutType === "Conditioning" || ex.movementPattern === "Core")) {
                score += 10;
            }
            if (dayType === "Strength Balanced Posture" && exFocusAreas.includes("Back and posture")) {
                score += 15;
            }

            return { ...ex, score };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * BUILD A SINGLE WORKOUT DAY
     */
    private async buildDay(
        planId: string,
        dayNumber: number,
        week: number,
        dayType: DayType,
        pool: Exercise[],
        profile: Profile,
        usedMainLowerPattern: string
    ): Promise<{ mainLowerPattern?: string }> {

        const scoredPool = this.scoreExercises(pool, profile, dayType);
        const time = profile.timePerWorkout;
        const counts = this.getDayExerciseCounts(time);

        let selectedExercises: RankedExercise[] = [];
        let mainLowerPattern = "";

        if (dayType === "Conditioning Core Mobility") {
            // Day 3: Conditioning + Core + Mobility
            selectedExercises = this.buildConditioningDay(scoredPool, counts);
        } else {
            // Strength days (1, 2, 4)
            const result = this.buildStrengthDay(scoredPool, profile, dayType, usedMainLowerPattern, counts);
            selectedExercises = result.exercises;
            mainLowerPattern = result.mainLowerPattern;
        }

        // Create workout day
        const workoutDay = await prisma.workoutDay.create({
            data: {
                planId,
                dayNumber,
                weekNumber: week,
                dayType,
                estimatedMinutes: time,
            },
        });

        // Create workout exercises with prescriptions
        for (let i = 0; i < selectedExercises.length; i++) {
            const ex = selectedExercises[i];
            const prescription = this.getPrescription(ex, profile, week);

            await prisma.workoutExercise.create({
                data: {
                    workoutDayId: workoutDay.id,
                    exerciseId: ex.id,
                    role: ex.role || "main",
                    targetSets: prescription.sets,
                    targetReps: prescription.reps,
                    targetSeconds: prescription.seconds,
                    targetRestSeconds: prescription.rest,
                    sortOrder: i,
                },
            });
        }

        return { mainLowerPattern };
    }

    private getDayExerciseCounts(time: number): DayExerciseCounts {
        if (time >= 60) return { warmUp: 5, main: 6, stretch: 3, core: 2, mobility: 2 };
        if (time >= 40) return { warmUp: 5, main: 5, stretch: 3, core: 2, mobility: 2 };
        if (time >= 25) return { warmUp: 4, main: 5, stretch: 3, core: 2, mobility: 1 };
        return { warmUp: 3, main: 4, stretch: 2, core: 1, mobility: 1 };
    }

    private isWarmUpCandidate(ex: RankedExercise): boolean {
        const phases = this.parseJson(ex.phaseTags);
        return phases.includes("Stretching") || ex.workoutType === "Mobility and recovery";
    }

    private isCoolOffCandidate(ex: RankedExercise): boolean {
        const phases = this.parseJson(ex.phaseTags);
        return phases.includes("Cool off") || phases.includes("Stretching");
    }

    private takeUnique(
        pool: RankedExercise[],
        count: number,
        used: Set<string>,
        predicate?: (ex: RankedExercise) => boolean
    ): RankedExercise[] {
        const result: RankedExercise[] = [];
        for (const ex of pool) {
            if (result.length >= count) break;
            if (used.has(ex.id)) continue;
            if (predicate && !predicate(ex)) continue;
            used.add(ex.id);
            result.push(ex);
        }
        return result;
    }

    /**
     * Build a strength day (Days 1, 2, 4)
     */
    private buildStrengthDay(
        pool: RankedExercise[],
        profile: Profile,
        dayType: DayType,
        usedMainLowerPattern: string,
        counts: DayExerciseCounts
    ): { exercises: RankedExercise[]; mainLowerPattern: string } {
        const result: RankedExercise[] = [];
        const used = new Set<string>();
        let mainLowerPattern = "";

        // Warm-up exercises
        const warmUps = this.takeUnique(pool, counts.warmUp, used, (ex) => this.isWarmUpCandidate(ex));
        warmUps.forEach(ex => result.push({ ...ex, role: "warm-up" }));

        const mainExercises: RankedExercise[] = [];

        // Main lower body movement
        const lowerPool = pool.filter(ex =>
            ex.movementPattern === "Squat" ||
            ex.movementPattern === "Hinge" ||
            ex.movementPattern === "Lunge"
        );

        // Avoid repeating same pattern as previous strength day
        let lowerMain = lowerPool.find(ex => ex.movementPattern !== usedMainLowerPattern) || lowerPool[0];

        // Use starting ability mapping for squats
        if (profile.startingAbilitySquats) {
            const mappedLower = this.getSquatVariant(lowerPool, profile.startingAbilitySquats);
            if (mappedLower) lowerMain = mappedLower;
        }

        if (lowerMain && used.has(lowerMain.id)) {
            lowerMain = lowerPool.find(ex => ex.movementPattern !== usedMainLowerPattern && !used.has(ex.id)) ||
                lowerPool.find(ex => !used.has(ex.id));
        }

        if (lowerMain && !used.has(lowerMain.id)) {
            mainLowerPattern = lowerMain.movementPattern;
            used.add(lowerMain.id);
            mainExercises.push({ ...lowerMain, role: "main" });
        }

        // Push movement
        const pushPool = pool.filter(ex => ex.movementPattern === "Push");
        let pushMain = pushPool[0];

        // Use starting ability mapping for push-ups
        if (profile.startingAbilityPushups) {
            const mappedPush = this.getPushVariant(pushPool, profile);
            if (mappedPush) pushMain = mappedPush;
        }

        if (pushMain && used.has(pushMain.id)) {
            pushMain = pushPool.find(ex => !used.has(ex.id));
        }

        if (pushMain && !used.has(pushMain.id)) {
            used.add(pushMain.id);
            mainExercises.push({ ...pushMain, role: "main" });
        }

        // Pull movement
        const pullPool = pool.filter(ex => ex.movementPattern === "Pull");
        const pullMain = pullPool.find(ex => !used.has(ex.id));
        if (pullMain) {
            used.add(pullMain.id);
            mainExercises.push({ ...pullMain, role: "main" });
        }

        // Core movement
        const corePool = pool.filter(ex => ex.movementPattern === "Core");
        let coreMain = corePool[0];

        // Use starting ability mapping for plank
        if (profile.startingAbilityPlank) {
            const mappedCore = this.getCoreVariant(corePool, profile.startingAbilityPlank);
            if (mappedCore) coreMain = mappedCore;
        }

        if (coreMain && used.has(coreMain.id)) {
            coreMain = corePool.find(ex => !used.has(ex.id));
        }

        if (coreMain && !used.has(coreMain.id)) {
            used.add(coreMain.id);
            mainExercises.push({ ...coreMain, role: "main" });
        }

        // Posture exercise for Day 4
        if (dayType === "Strength Balanced Posture") {
            const posturePool = pool.filter(ex =>
                this.parseJson(ex.focusAreaTags).includes("Back and posture")
            );
            const postureMain = posturePool.find(ex => !used.has(ex.id));
            if (postureMain) {
                used.add(postureMain.id);
                mainExercises.push({ ...postureMain, role: "accessory" });
            }
        }

        const mainFillPool = pool.filter(ex =>
            !this.isWarmUpCandidate(ex) &&
            !this.isCoolOffCandidate(ex) &&
            ex.workoutType !== "Mobility and recovery"
        );
        const remainingMain = counts.main - mainExercises.length;
        if (remainingMain > 0) {
            const extras = this.takeUnique(mainFillPool, remainingMain, used);
            extras.forEach(ex => mainExercises.push({ ...ex, role: "main" }));
        }

        mainExercises.forEach(ex => result.push(ex));

        // Cool off exercises
        const coolOffs = this.takeUnique(pool, counts.stretch, used, (ex) => this.isCoolOffCandidate(ex));
        coolOffs.forEach(ex => result.push({ ...ex, role: "cool-off" }));

        return { exercises: result, mainLowerPattern };
    }

    /**
     * Build a conditioning day (Day 3)
     */
    private buildConditioningDay(
        pool: RankedExercise[],
        counts: DayExerciseCounts
    ): RankedExercise[] {
        const result: RankedExercise[] = [];
        const used = new Set<string>();

        // Warm-up exercises
        const warmUps = this.takeUnique(pool, counts.warmUp, used, (ex) => this.isWarmUpCandidate(ex));
        warmUps.forEach(ex => result.push({ ...ex, role: "warm-up" }));

        // Conditioning exercises
        const condPool = pool.filter(ex => ex.workoutType === "Conditioning");

        // Core block
        const corePool = pool.filter(ex => ex.movementPattern === "Core");
        const mainExercises: RankedExercise[] = [];
        const coreCount = Math.min(counts.core, counts.main);
        const coreExercises = this.takeUnique(corePool, coreCount, used);
        coreExercises.forEach(ex => mainExercises.push({ ...ex, role: "main" }));

        const condCount = Math.max(0, counts.main - mainExercises.length);
        const condExercises = this.takeUnique(condPool, condCount, used);
        condExercises.forEach(ex => mainExercises.push({ ...ex, role: "conditioning" }));

        const remainingMain = counts.main - mainExercises.length;
        if (remainingMain > 0) {
            const mainFillPool = pool.filter(ex =>
                !this.isWarmUpCandidate(ex) &&
                !this.isCoolOffCandidate(ex) &&
                ex.workoutType !== "Mobility and recovery"
            );
            const extras = this.takeUnique(mainFillPool, remainingMain, used);
            extras.forEach(ex => mainExercises.push({ ...ex, role: "main" }));
        }

        mainExercises.forEach(ex => result.push(ex));

        // Mobility block
        const mobilityPool = pool.filter(ex =>
            ex.workoutType === "Mobility and recovery"
        );
        const mobilityExercises = this.takeUnique(mobilityPool, counts.mobility, used);
        mobilityExercises.forEach(ex => result.push({ ...ex, role: "mobility" }));

        // Cool off
        const coolOffCount = Math.max(0, counts.stretch - mobilityExercises.length);
        const coolOffs = this.takeUnique(pool, coolOffCount, used, (ex) => this.isCoolOffCandidate(ex));
        coolOffs.forEach(ex => result.push({ ...ex, role: "cool-off" }));

        return result;
    }

    /**
     * Get prescription based on exercise type and experience
     */
    private getPrescription(
        ex: RankedExercise,
        profile: Profile,
        week: number
    ): { sets: number | null; reps: number | null; seconds: number | null; rest: number | null } {
        const exp = profile.experienceLevel.toLowerCase();
        const isCoreHold = ex.movementPattern === "Core" &&
            (ex.name.toLowerCase().includes("plank") ||
                ex.name.toLowerCase().includes("hold") ||
                ex.name.toLowerCase().includes("dead bug"));
        const isMobility = ex.workoutType === "Mobility and recovery" || ex.role === "warm-up" || ex.role === "cool-off" || ex.role === "mobility";
        const isConditioning = ex.workoutType === "Conditioning" || ex.role === "conditioning";

        let sets = 3, reps: number | null = 10, seconds: number | null = null, rest = 60;

        // Default strength prescription by experience
        if (exp.includes("beginner")) { sets = 2; reps = 8; rest = 60; }
        else if (exp.includes("some")) { sets = 3; reps = 10; rest = 60; }
        else if (exp.includes("interm")) { sets = 3; reps = 8; rest = 90; }
        else if (exp.includes("advanc")) { sets = 4; reps = 8; rest = 120; }

        // Core hold prescriptions
        if (isCoreHold) {
            reps = null;
            if (exp.includes("beginner")) { sets = 2; seconds = 20; rest = 45; }
            else if (exp.includes("some")) { sets = 3; seconds = 30; rest = 45; }
            else if (exp.includes("interm")) { sets = 3; seconds = 45; rest = 60; }
            else { sets = 4; seconds = 60; rest = 60; }
        }

        // Mobility/stretching prescriptions
        if (isMobility) {
            sets = 1;
            reps = null;
            seconds = 45;
            rest = 0;
        }

        // Conditioning prescriptions (intervals)
        if (isConditioning) {
            sets = 4;
            reps = null;
            const intensity = profile.intensityPreference;
            if (intensity === "Easy") { seconds = 20; rest = 40; }
            else if (intensity === "Moderate") { seconds = 30; rest = 30; }
            else { seconds = 40; rest = 20; }
        }

        // Week progression
        if (week === 2 && ex.role === "main" && profile.sleepBucket !== "Under 6 hours") {
            sets += 1;
        }
        if (week === 3) {
            if (reps) reps += 2;
            if (seconds) seconds += 10;
        }
        if (week === 4) {
            // Recovery week - slightly reduce
            if (profile.intensityPreference === "Easy" || profile.sleepBucket === "Under 6 hours") {
                if (sets > 2) sets -= 1;
            }
        }

        return { sets, reps, seconds, rest };
    }

    /**
     * Optional recovery days (Days 29-30)
     */
    private async buildOptionalRecoveryDays(planId: string, startDay: number, pool: Exercise[], profile: Profile) {
        const mobilityPool = pool.filter(ex =>
            ex.workoutType === "Mobility and recovery" ||
            this.parseJson(ex.phaseTags).includes("Stretching")
        );

        for (let i = 0; i < 2; i++) {
            const day = await prisma.workoutDay.create({
                data: {
                    planId,
                    dayNumber: startDay + i,
                    weekNumber: 5,
                    dayType: "Conditioning Core Mobility",
                    isOptional: true,
                    estimatedMinutes: 15,
                },
            });

            const selected = mobilityPool.slice(i * 5, (i + 1) * 5);
            for (let j = 0; j < selected.length; j++) {
                await prisma.workoutExercise.create({
                    data: {
                        workoutDayId: day.id,
                        exerciseId: selected[j].id,
                        role: "mobility",
                        targetSets: 1,
                        targetSeconds: 45,
                        targetRestSeconds: 15,
                        sortOrder: j,
                    },
                });
            }
        }
    }

    /**
     * Starting ability mappings
     */
    private getPushVariant(pool: RankedExercise[], profile: Profile): RankedExercise | null {
        const ability = profile.startingAbilityPushups;
        if (!ability) return null;

        if (ability === "0") {
            return pool.find(ex => ex.name.toLowerCase().includes("wall push-up")) ||
                pool.find(ex => ex.name.toLowerCase().includes("incline push-up")) ||
                null;
        }
        if (ability === "1-5") {
            return pool.find(ex => ex.name.toLowerCase().includes("incline push-up")) ||
                pool.find(ex => ex.name.toLowerCase().includes("knee push-up")) ||
                null;
        }
        if (ability === "6-15") {
            return pool.find(ex => ex.name.toLowerCase().includes("standard push-up")) ||
                pool.find(ex => ex.name.toLowerCase().includes("push-up") && !ex.name.toLowerCase().includes("decline")) ||
                null;
        }
        if (ability === "16+") {
            return pool.find(ex => ex.name.toLowerCase().includes("decline push-up")) ||
                pool.find(ex => ex.name.toLowerCase().includes("standard push-up")) ||
                null;
        }
        return null;
    }

    private getSquatVariant(pool: RankedExercise[], ability: string): RankedExercise | null {
        if (ability === "0-10") {
            return pool.find(ex => ex.name.toLowerCase().includes("sit-to-stand")) ||
                pool.find(ex => ex.name.toLowerCase().includes("chair")) ||
                null;
        }
        if (ability === "11-25") {
            return pool.find(ex => ex.name.toLowerCase().includes("bodyweight squat")) ||
                pool.find(ex => ex.name.toLowerCase().includes("squat") && !ex.name.toLowerCase().includes("goblet")) ||
                null;
        }
        if (ability === "26-50") {
            return pool.find(ex => ex.name.toLowerCase().includes("goblet squat")) ||
                pool.find(ex => ex.name.toLowerCase().includes("squat")) ||
                null;
        }
        if (ability === "50+") {
            return pool.find(ex => ex.name.toLowerCase().includes("goblet squat")) ||
                pool.find(ex => ex.name.toLowerCase().includes("split")) ||
                null;
        }
        return null;
    }

    private getCoreVariant(pool: RankedExercise[], ability: string): RankedExercise | null {
        if (ability === "under 20 seconds") {
            return pool.find(ex => ex.name.toLowerCase().includes("knees")) ||
                pool.find(ex => ex.name.toLowerCase().includes("dead bug")) ||
                null;
        }
        if (ability === "20-45") {
            return pool.find(ex => ex.name.toLowerCase().includes("front plank")) ||
                pool.find(ex => ex.name.toLowerCase().includes("plank") && !ex.name.toLowerCase().includes("side")) ||
                null;
        }
        if (ability === "45-90" || ability === "90+") {
            return pool.find(ex => ex.name.toLowerCase().includes("side plank")) ||
                pool.find(ex => ex.name.toLowerCase().includes("plank")) ||
                null;
        }
        return null;
    }

    /**
     * Utility: Parse JSON string to array
     */
    private parseJson(value: string | null): string[] {
        if (!value) return [];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
}
