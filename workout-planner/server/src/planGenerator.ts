import { PrismaClient, Exercise, Profile } from '@prisma/client';

const prisma = new PrismaClient();

type DayType = "Strength Lower Focus" | "Strength Upper Focus" | "Conditioning Core Mobility" | "Strength Balanced Posture" | "Rest";

interface RankedExercise extends Exercise {
    score: number;
}

export class PlanGenerator {
    async generate(userId: string, profile: Profile) {
        // 1. Fetch all exercises
        const allExercises = await prisma.exercise.findMany();

        // 2. Initial filtering (Equipment, Exclusions, Pain - Hard Rules)
        const allowedPool = this.filterExercises(allExercises, profile);

        // 3. Create Plan
        const plan = await prisma.plan.create({
            data: {
                userId,
                startDate: new Date(),
                status: 'active',
            },
        });

        // 4. Generate 4 weeks of 7 days (4 workout days, 3 rest days)
        const usedMovementPatterns: string[] = [];

        for (let week = 1; week <= 4; week++) {
            const schedule = [
                "Strength Lower Focus",
                "Strength Upper Focus",
                "Rest",
                "Conditioning Core Mobility",
                "Strength Balanced Posture",
                "Rest",
                "Rest"
            ];

            for (let dayInWeek = 1; dayInWeek <= 7; dayInWeek++) {
                const dayType = schedule[dayInWeek - 1];
                const dayNumber = (week - 1) * 7 + dayInWeek;

                if (dayType === "Rest") {
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
                    await this.buildDay(plan.id, dayInWeek, week, dayType as DayType, allowedPool, profile, usedMovementPatterns);
                }
            }
        }

        // 5. Add 2 optional recovery days
        await this.buildOptionalRecoveryDays(plan.id, 29, allowedPool, profile);

        return plan;
    }

    private filterExercises(exercises: Exercise[], profile: Profile): Exercise[] {
        const userEquipment = JSON.parse(profile.equipment || '[]');
        const userPain = JSON.parse(profile.painAreas || '[]');
        const userRestrictions = JSON.parse(profile.movementRestrictions || '[]');
        const userExclusions = JSON.parse(profile.preferenceExclusions || '[]');

        return exercises.filter(ex => {
            const exEquipment = JSON.parse(ex.equipmentTags || '[]');
            const exExclusions = JSON.parse(ex.preferenceExclusionFlags || '[]');
            const exPainFlags = JSON.parse(ex.avoidModifyFlags || '[]');

            // A) Equipment filtering
            if (exEquipment.length > 0) {
                const hasMatchingEquipment = exEquipment.some((eq: string) => userEquipment.includes(eq) || eq === "No equipment");
                if (!hasMatchingEquipment) return false;
            }

            // B) Preference exclusions
            if (exExclusions.some((exc: string) => userExclusions.includes(exc))) return false;

            // C) Pain/injury constraints
            if (exPainFlags.some((pain: string) => userPain.includes(pain))) return false;

            // D) Movement restrictions
            if (userRestrictions.includes("Squatting down is difficult") && ex.movementPattern === "Squat" && !ex.name.toLowerCase().includes("chair") && !ex.name.toLowerCase().includes("box")) return false;
            if (userRestrictions.includes("Lunges are difficult") && ex.movementPattern === "Lunge") return false;
            if (userRestrictions.includes("Push-ups are difficult") && ex.movementPattern === "Push" && (ex.name.toLowerCase().includes("standard") || ex.name.toLowerCase().includes("decline"))) return false;
            if (userRestrictions.includes("Pull-ups are difficult") && ex.movementPattern === "Pull" && ex.name.toLowerCase().includes("pull-up")) return false;
            if (userRestrictions.includes("Jumping is difficult") && ex.impactLevel === "high") return false;
            if (userRestrictions.includes("Running is difficult") && ex.movementPattern === "Conditioning" && ex.name.toLowerCase().includes("run")) return false;

            return true;
        });
    }

    private scoreExercises(pool: Exercise[], profile: Profile, dayType: DayType): RankedExercise[] {
        const userGoal = profile.goal;
        const userStyle = profile.workoutStylePreference;
        const userFocus = JSON.parse(profile.focusAreas || '[]');
        const userIntensity = profile.intensityPreference;

        return pool.map(ex => {
            let score = 100;

            // Goal match
            if (userGoal === "Build muscle" || userGoal === "Get stronger") {
                if (ex.workoutType === "Strength training") score += 20;
            } else if (userGoal === "Lose body fat" || userGoal === "Improve stamina") {
                if (ex.workoutType === "Conditioning") score += 20;
            } else if (userGoal === "Improve mobility") {
                if (ex.workoutType === "Mobility and recovery") score += 20;
            }

            // Style
            if (userStyle === "Mostly strength training") {
                if (ex.workoutType === "Strength training") score += 15;
                if (ex.workoutType === "Conditioning") score -= 15;
            } else if (userStyle === "Mostly cardio") {
                if (ex.workoutType === "Conditioning") score += 15;
                if (ex.workoutType === "Strength training") score -= 15;
            }

            // Focus
            const exFocus = JSON.parse(ex.focusAreaTags || '[]');
            if (userFocus.some((f: string) => exFocus.includes(f))) score += 30;

            // Experience Gap - PENALIZE if too easy/hard
            const expOrder = ["beginner", "some experience", "intermediate", "advanced"];
            const userExpIdx = expOrder.indexOf(profile.experienceLevel.toLowerCase());
            const exMinIdx = expOrder.indexOf(ex.difficultyMin.toLowerCase());
            const exMaxIdx = expOrder.indexOf(ex.difficultyMax.toLowerCase());

            if (userExpIdx < exMinIdx) score -= 50; // Too hard
            if (userExpIdx > exMaxIdx + 1) score -= 30; // Too easy

            // Intensity
            if (userIntensity === "Easy" && ex.impactLevel === "high") score -= 30;
            if (userIntensity === "Hard" && ex.impactLevel === "high") score += 15;

            return { ...ex, score };
        });
    }

    private async buildDay(planId: string, dayInWeek: number, week: number, dayType: DayType, pool: Exercise[], profile: Profile, usedPatterns: string[]) {
        const scoredPool = this.scoreExercises(pool, profile, dayType);
        const dayNumber = (week - 1) * 7 + dayInWeek;

        const workoutDay = await prisma.workoutDay.create({
            data: {
                planId,
                dayNumber,
                weekNumber: week,
                dayType,
                estimatedMinutes: profile.timePerWorkout,
            },
        });

        let exercises: any[] = [];
        if (dayType === "Conditioning Core Mobility") {
            exercises = this.buildConditioningDay(scoredPool, profile, week);
        } else {
            exercises = this.buildStrengthDay(scoredPool, profile, week, dayType, usedPatterns);
        }

        for (let i = 0; i < exercises.length; i++) {
            const ex = exercises[i];
            if (!ex || !ex.id) continue;
            const prescription = this.getPrescription(ex, profile, week, dayType);

            await prisma.workoutExercise.create({
                data: {
                    workoutDay: { connect: { id: workoutDay.id } },
                    exercise: { connect: { id: ex.id } },
                    role: ex.role,
                    targetSets: prescription.sets,
                    targetReps: prescription.reps,
                    targetSeconds: prescription.seconds,
                    targetRestSeconds: prescription.rest,
                    sortOrder: i,
                }
            });
        }
    }

    private getMappingVariant(pool: RankedExercise[], profile: Profile, pattern: string): RankedExercise | null {
        if (pattern === "Push") {
            const val = profile.startingAbilityPushups || "0";
            if (val === "0") return pool.find(ex => ex.name.toLowerCase().includes("wall push-up") || ex.name.toLowerCase().includes("incline push-up")) || null;
            if (val === "1–5") return pool.find(ex => ex.name.toLowerCase().includes("incline push-up") || ex.name.toLowerCase().includes("knee push-up")) || null;
            if (val === "6–15") return pool.find(ex => ex.name.toLowerCase().includes("standard push-up") || (ex.name.toLowerCase().includes("incline") && ex.difficultyMin.includes("interm"))) || null;
            if (val === "16+") return pool.find(ex => ex.name.toLowerCase().includes("decline") || (ex.name.toLowerCase().includes("standard") && ex.difficultyMin.includes("adv"))) || pool.find(ex => ex.name.toLowerCase().includes("standard")) || null;
        }
        if (pattern === "Squat") {
            const val = profile.startingAbilitySquats || "0-10";
            if (val === "0-10") return pool.find(ex => ex.name.toLowerCase().includes("chair squat") || ex.name.toLowerCase().includes("box squat") || ex.name.toLowerCase().includes("sit-to-stand")) || null;
            if (val === "11-25") return pool.find(ex => ex.name.toLowerCase().includes("bodyweight squat") || ex.name.toLowerCase().includes("box squat")) || null;
            if (val === "26-50") return pool.find(ex => ex.name.toLowerCase().includes("goblet squat") || (ex.name.toLowerCase().includes("bodyweight") && ex.notes?.toLowerCase().includes("tempo"))) || pool.find(ex => ex.name.toLowerCase().includes("bodyweight")) || null;
            if (val === "50+") return pool.find(ex => ex.name.toLowerCase().includes("split stance") || ex.name.toLowerCase().includes("goblet") || ex.name.toLowerCase().includes("bulgarian")) || null;
        }
        if (pattern === "Core") {
            const val = profile.startingAbilityPlank || "under 20 seconds";
            if (val.includes("under 20")) return pool.find(ex => ex.name.toLowerCase().includes("knee") && ex.name.toLowerCase().includes("plank")) || pool.find(ex => ex.name.toLowerCase().includes("dead bug")) || null;
            if (val.includes("20-45")) return pool.find(ex => ex.name.toLowerCase() === "plank" && ex.difficultyMin === "beginner") || pool.find(ex => ex.name.toLowerCase().includes("plank")) || null;
            if (val.includes("45-90")) return pool.find(ex => ex.name.toLowerCase() === "plank") || null;
            if (val.includes("90+")) return pool.find(ex => ex.name.toLowerCase().includes("side plank") || ex.name.toLowerCase().includes("progression")) || null;
        }
        return null;
    }

    private buildStrengthDay(pool: RankedExercise[], profile: Profile, week: number, dayType: DayType, usedPatterns: string[]): any[] {
        const result: any[] = [];
        const time = profile.timePerWorkout;

        // Warm-up
        const warmups = pool.filter(ex => JSON.parse(ex.phaseTags || '[]').includes("Stretching") || ex.workoutType === "Mobility and recovery")
            .sort((a, b) => b.score - a.score);
        const wuLimit = time >= 40 ? 3 : 2;
        result.push(...warmups.slice(0, wuLimit).map(ex => ({ ...ex, role: "warm-up" })));

        // Main Block
        // Lower
        const lowerVariant = this.getMappingVariant(pool, profile, "Squat");
        const lowerPool = pool.filter(ex => ex.movementPattern === "Squat" || ex.movementPattern === "Hinge" || ex.movementPattern === "Lunge").sort((a, b) => b.score - a.score);
        let lowerMain = lowerVariant || lowerPool[0];

        if (dayType === "Strength Balanced Posture" && usedPatterns[0]) {
            lowerMain = lowerPool.find(ex => ex.movementPattern !== usedPatterns[0]) || lowerPool[0];
        }
        if (dayType === "Strength Lower Focus" && lowerMain) usedPatterns[0] = lowerMain.movementPattern;
        if (lowerMain) result.push({ ...lowerMain, role: "main" });

        // Push
        const pushVariant = this.getMappingVariant(pool, profile, "Push");
        const pushPool = pool.filter(ex => ex.movementPattern === "Push").sort((a, b) => b.score - a.score);
        const pushMain = pushVariant || pushPool[0];
        if (pushMain) result.push({ ...pushMain, role: "main" });

        // Pull
        const pullPool = pool.filter(ex => ex.movementPattern === "Pull").sort((a, b) => b.score - a.score);
        if (pullPool[0]) result.push({ ...pullPool[0], role: "main" });

        // Core
        const coreVariant = this.getMappingVariant(pool, profile, "Core");
        const corePool = pool.filter(ex => ex.movementPattern === "Core").sort((a, b) => b.score - a.score);
        const coreMain = coreVariant || corePool[0];
        if (coreMain) result.push({ ...coreMain, role: "main" });

        // Posture (Day 4)
        if (dayType === "Strength Balanced Posture") {
            const postPool = pool.filter(ex => JSON.parse(ex.focusAreaTags || '[]').includes("Back and posture")).sort((a, b) => b.score - a.score);
            if (postPool[0]) result.push({ ...postPool[0], role: "accessory" });
        }

        // Finisher
        if (time >= 40 && profile.workoutStylePreference !== "Mostly strength training") {
            const condPool = pool.filter(ex => ex.workoutType === "Conditioning").sort((a, b) => b.score - a.score);
            if (condPool[0]) result.push({ ...condPool[0], role: "conditioning" });
        }

        // Cool off
        const coolOffs = pool.filter(ex => JSON.parse(ex.phaseTags || '[]').includes("Cool off")).sort((a, b) => b.score - a.score);
        result.push(...coolOffs.slice(0, wuLimit).map(ex => ({ ...ex, role: "cool off" })));

        const maxEx = time === 15 ? 4 : (time === 25 ? 6 : (time === 40 ? 8 : 12));
        return result.slice(0, maxEx);
    }

    private buildConditioningDay(pool: RankedExercise[], profile: Profile, week: number): any[] {
        const result: any[] = [];
        const time = profile.timePerWorkout;

        const warmups = pool.filter(ex => ex.workoutType === "Mobility and recovery").sort((a, b) => b.score - a.score);
        result.push(...warmups.slice(0, 2).map(ex => ({ ...ex, role: "warm-up" })));

        const condPool = pool.filter(ex => ex.workoutType === "Conditioning").sort((a, b) => b.score - a.score);
        const condCount = time === 15 ? 1 : (time === 25 ? 2 : (time === 40 ? 3 : 4));
        result.push(...condPool.slice(0, condCount).map(ex => ({ ...ex, role: "conditioning" })));

        const corePool = pool.filter(ex => ex.movementPattern === "Core").sort((a, b) => b.score - a.score);
        if (corePool[0]) result.push({ ...corePool[0], role: "main" });

        const mobPool = pool.filter(ex => ex.movementPattern === "Mobility" || ex.movementPattern === "Stretch").sort((a, b) => b.score - a.score);
        result.push(...mobPool.slice(0, 2).map(ex => ({ ...ex, role: "mobility" })));

        const coolPool = pool.filter(ex => JSON.parse(ex.phaseTags || '[]').includes("Cool off")).sort((a, b) => b.score - a.score);
        if (coolPool[0]) result.push({ ...coolPool[0], role: "cool off" });

        return result;
    }

    private async buildOptionalRecoveryDays(planId: string, startDay: number, pool: Exercise[], profile: Profile) {
        const scoredPool = this.scoreExercises(pool.filter(ex => ex.workoutType === "Mobility and recovery"), profile, "Conditioning Core Mobility");
        for (let i = 0; i < 2; i++) {
            const day = await prisma.workoutDay.create({
                data: {
                    planId, dayNumber: startDay + i, weekNumber: 4, dayType: "Conditioning Core Mobility",
                    isOptional: true, estimatedMinutes: 15
                }
            });
            const selected = scoredPool.sort((a, b) => b.score - a.score).slice(0, 5);
            for (let j = 0; j < selected.length; j++) {
                await prisma.workoutExercise.create({
                    data: {
                        workoutDay: { connect: { id: day.id } },
                        exercise: { connect: { id: selected[j].id } },
                        role: "mobility", targetSeconds: 30, targetRestSeconds: 15, sortOrder: j
                    }
                });
            }
        }
    }

    private getPrescription(ex: Exercise & { role?: string }, profile: Profile, week: number, dayType: DayType) {
        const exp = profile.experienceLevel.toLowerCase();
        const isCoreHold = ex.movementPattern === "Core" && !ex.name.toLowerCase().includes("crunch");
        const isMobility = ex.workoutType === "Mobility and recovery";
        const isConditioning = ex.workoutType === "Conditioning" || ex.role === "conditioning";

        let sets = 3, reps: number | null = 10, seconds: number | null = null, rest = 60;

        if (exp.includes("beginner")) { sets = 2; reps = 8; rest = 60; }
        else if (exp.includes("some")) { sets = 3; reps = 10; rest = 60; }
        else if (exp.includes("interm")) { sets = 3; reps = 8; rest = 90; }
        else if (exp.includes("advanc")) { sets = 4; reps = 8; rest = 120; }

        if (isCoreHold) {
            reps = null;
            seconds = exp.includes("beginner") ? 20 : (exp.includes("some") ? 30 : (exp.includes("interm") ? 45 : 60));
            rest = 45;
        }

        if (isMobility) { sets = 1; reps = null; seconds = 45; rest = 0; }
        if (isConditioning) {
            sets = 4; reps = null;
            const int = profile.intensityPreference;
            seconds = int === "Easy" ? 20 : (int === "Moderate" ? 30 : 40);
            rest = int === "Easy" ? 40 : (int === "Moderate" ? 30 : 20);
        }

        if (week === 2 && ex.role === "main" && profile.sleepBucket !== "Under 6 hours") sets += 1;
        if (week === 3) { if (reps) reps += 2; if (seconds) seconds += 10; }
        if (week === 4 && (profile.intensityPreference === "Easy" || profile.sleepBucket === "Under 6 hours") && sets > 2) sets -= 1;

        return { sets, reps, seconds, rest };
    }
}
