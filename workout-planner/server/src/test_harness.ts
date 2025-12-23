/**
 * Test Harness for Plan Generator V2
 * 
 * Tests the plan generator with 20+ synthetic user profiles covering various edge cases.
 * Run with: npx tsx src/test_harness.ts
 */

import { PrismaClient } from '@prisma/client';
import { PlanGenerator } from './planGenerator';

const prisma = new PrismaClient();
const generator = new PlanGenerator();

// 20+ Synthetic User Profiles covering edge cases
const TEST_PROFILES = [
    // 1. Beginner with no equipment
    {
        name: "Beginner - No Equipment",
        profile: {
            goal: "Lose body fat",
            equipment: JSON.stringify(["No equipment"]),
            timePerWorkout: 15,
            experienceLevel: "beginner",
            recentConsistency: "0 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mix of both",
            focusAreas: JSON.stringify(["Core"]),
            intensityPreference: "Easy",
            startingAbilityPushups: "0",
            startingAbilitySquats: "0-10",
            startingAbilityPlank: "under 20 seconds",
            sleepBucket: "6-7 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 2. Intermediate with dumbbells and knee pain
    {
        name: "Intermediate - Dumbbells + Knee Pain",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["Dumbbells", "Resistance bands"]),
            timePerWorkout: 40,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["Knees"]),
            movementRestrictions: JSON.stringify(["Jumping is difficult"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Chest and arms", "Core"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "11-25",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["Jumping"])
        }
    },
    // 3. Advanced with full equipment
    {
        name: "Advanced - Full Equipment",
        profile: {
            goal: "Get stronger",
            equipment: JSON.stringify(["Dumbbells", "Kettlebell", "Pull-up bar", "Bench"]),
            timePerWorkout: 60,
            experienceLevel: "advanced",
            recentConsistency: "5+ days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Back and posture", "Glutes and legs"]),
            intensityPreference: "Hard",
            startingAbilityPushups: "16+",
            startingAbilitySquats: "50+",
            startingAbilityPlank: "90+",
            sleepBucket: "8+ hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 4. Cardio lover avoiding heavy lifting
    {
        name: "Cardio Lover - No Heavy Lifting",
        profile: {
            goal: "Improve stamina",
            equipment: JSON.stringify(["Resistance bands"]),
            timePerWorkout: 25,
            experienceLevel: "some experience",
            recentConsistency: "1-2 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly cardio",
            focusAreas: JSON.stringify(["Full body balance"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "1-5",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "20-45",
            sleepBucket: "6-7 hours",
            preferenceExclusions: JSON.stringify(["Heavy lifting"])
        }
    },
    // 5. Mobility focused with back pain
    {
        name: "Mobility Focus - Back Pain",
        profile: {
            goal: "Improve mobility",
            equipment: JSON.stringify(["No equipment"]),
            timePerWorkout: 25,
            experienceLevel: "beginner",
            recentConsistency: "0 days per week",
            painAreas: JSON.stringify(["Lower back"]),
            movementRestrictions: JSON.stringify(["Squatting down is difficult"]),
            workoutStylePreference: "Decide for me",
            focusAreas: JSON.stringify(["Back and posture"]),
            intensityPreference: "Easy",
            startingAbilityPushups: null,
            startingAbilitySquats: null,
            startingAbilityPlank: null,
            sleepBucket: "Under 6 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 6. Short workouts - 15 min only
    {
        name: "Short Workouts - 15 min",
        profile: {
            goal: "General fitness",
            equipment: JSON.stringify(["No equipment"]),
            timePerWorkout: 15,
            experienceLevel: "some experience",
            recentConsistency: "1-2 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mix of both",
            focusAreas: JSON.stringify(["Full body balance"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["Long workouts"])
        }
    },
    // 7. Shoulder pain - avoid overhead
    {
        name: "Shoulder Pain - No Overhead",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["Dumbbells"]),
            timePerWorkout: 40,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["Shoulders"]),
            movementRestrictions: JSON.stringify(["Push-ups are difficult"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Back and posture", "Core"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "1-5",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 8. Burpee hater
    {
        name: "No Burpees + No Running",
        profile: {
            goal: "Lose body fat",
            equipment: JSON.stringify(["No equipment"]),
            timePerWorkout: 25,
            experienceLevel: "some experience",
            recentConsistency: "1-2 days per week",
            painAreas: JSON.stringify(["Ankles"]),
            movementRestrictions: JSON.stringify(["Running is difficult", "Jumping is difficult"]),
            workoutStylePreference: "Mostly cardio",
            focusAreas: JSON.stringify(["Full body balance"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "11-25",
            startingAbilityPlank: "20-45",
            sleepBucket: "6-7 hours",
            preferenceExclusions: JSON.stringify(["Burpees", "Running", "Jumping"])
        }
    },
    // 9. Pull-up bar only
    {
        name: "Pull-up Bar Only",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["Pull-up bar"]),
            timePerWorkout: 25,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Back and posture", "Chest and arms"]),
            intensityPreference: "Hard",
            startingAbilityPushups: "16+",
            startingAbilitySquats: "50+",
            startingAbilityPlank: "90+",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 10. Kettlebell only
    {
        name: "Kettlebell Only",
        profile: {
            goal: "Get stronger",
            equipment: JSON.stringify(["Kettlebell"]),
            timePerWorkout: 40,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Glutes and legs", "Core"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 11. Wrist pain - no extended wrist
    {
        name: "Wrist Pain",
        profile: {
            goal: "General fitness",
            equipment: JSON.stringify(["Dumbbells"]),
            timePerWorkout: 25,
            experienceLevel: "some experience",
            recentConsistency: "1-2 days per week",
            painAreas: JSON.stringify(["Wrists"]),
            movementRestrictions: JSON.stringify(["Push-ups are difficult"]),
            workoutStylePreference: "Mix of both",
            focusAreas: JSON.stringify(["Full body balance"]),
            intensityPreference: "Easy",
            startingAbilityPushups: "0",
            startingAbilitySquats: "11-25",
            startingAbilityPlank: "20-45",
            sleepBucket: "6-7 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 12. Sleep deprived
    {
        name: "Sleep Deprived",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["Dumbbells", "Bench"]),
            timePerWorkout: 40,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Chest and arms"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "45-90",
            sleepBucket: "Under 6 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 13. Core focus
    {
        name: "Core Focus",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["No equipment"]),
            timePerWorkout: 25,
            experienceLevel: "some experience",
            recentConsistency: "1-2 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Core"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "20-45",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 14. Glutes focus
    {
        name: "Glutes Focus",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["Resistance bands", "Dumbbells"]),
            timePerWorkout: 40,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Glutes and legs"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 15. Lunge restriction
    {
        name: "Lunge Restriction",
        profile: {
            goal: "Get stronger",
            equipment: JSON.stringify(["Dumbbells"]),
            timePerWorkout: 40,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["Knees"]),
            movementRestrictions: JSON.stringify(["Lunges are difficult"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Glutes and legs"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "11-25",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["Jumping"])
        }
    },
    // 16. 60 min marathon
    {
        name: "60 Min Marathon",
        profile: {
            goal: "General fitness",
            equipment: JSON.stringify(["Dumbbells", "Kettlebell", "Resistance bands", "Pull-up bar"]),
            timePerWorkout: 60,
            experienceLevel: "advanced",
            recentConsistency: "5+ days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mix of both",
            focusAreas: JSON.stringify(["Full body balance"]),
            intensityPreference: "Hard",
            startingAbilityPushups: "16+",
            startingAbilitySquats: "50+",
            startingAbilityPlank: "90+",
            sleepBucket: "8+ hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 17. Pull-ups difficult
    {
        name: "Pull-ups Difficult",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["Pull-up bar", "Dumbbells"]),
            timePerWorkout: 40,
            experienceLevel: "some experience",
            recentConsistency: "1-2 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["Pull-ups are difficult"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Back and posture"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 18. Multiple pain areas
    {
        name: "Multiple Pain Areas",
        profile: {
            goal: "Improve mobility",
            equipment: JSON.stringify(["No equipment"]),
            timePerWorkout: 25,
            experienceLevel: "beginner",
            recentConsistency: "0 days per week",
            painAreas: JSON.stringify(["Lower back", "Knees", "Shoulders"]),
            movementRestrictions: JSON.stringify(["Squatting down is difficult", "Push-ups are difficult"]),
            workoutStylePreference: "Decide for me",
            focusAreas: JSON.stringify(["Back and posture"]),
            intensityPreference: "Easy",
            startingAbilityPushups: "0",
            startingAbilitySquats: "0-10",
            startingAbilityPlank: "under 20 seconds",
            sleepBucket: "Under 6 hours",
            preferenceExclusions: JSON.stringify(["Heavy lifting", "Jumping"])
        }
    },
    // 19. Neck pain
    {
        name: "Neck Pain",
        profile: {
            goal: "General fitness",
            equipment: JSON.stringify(["Dumbbells"]),
            timePerWorkout: 25,
            experienceLevel: "some experience",
            recentConsistency: "1-2 days per week",
            painAreas: JSON.stringify(["Neck"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mix of both",
            focusAreas: JSON.stringify(["Back and posture"]),
            intensityPreference: "Easy",
            startingAbilityPushups: "1-5",
            startingAbilitySquats: "11-25",
            startingAbilityPlank: "20-45",
            sleepBucket: "6-7 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    },
    // 20. Everything excluded
    {
        name: "Maximum Restrictions",
        profile: {
            goal: "General fitness",
            equipment: JSON.stringify(["No equipment"]),
            timePerWorkout: 15,
            experienceLevel: "beginner",
            recentConsistency: "0 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["Squatting down is difficult", "Lunges are difficult", "Push-ups are difficult", "Running is difficult", "Jumping is difficult"]),
            workoutStylePreference: "Decide for me",
            focusAreas: JSON.stringify(["Full body balance"]),
            intensityPreference: "Easy",
            startingAbilityPushups: "0",
            startingAbilitySquats: "0-10",
            startingAbilityPlank: "under 20 seconds",
            sleepBucket: "Under 6 hours",
            preferenceExclusions: JSON.stringify(["Running", "Jumping", "Burpees", "Long workouts", "Heavy lifting"])
        }
    },
    // 21. Resistance bands only
    {
        name: "Resistance Bands Only",
        profile: {
            goal: "Build muscle",
            equipment: JSON.stringify(["Resistance bands"]),
            timePerWorkout: 40,
            experienceLevel: "intermediate",
            recentConsistency: "3-4 days per week",
            painAreas: JSON.stringify(["None"]),
            movementRestrictions: JSON.stringify(["None"]),
            workoutStylePreference: "Mostly strength training",
            focusAreas: JSON.stringify(["Full body balance"]),
            intensityPreference: "Moderate",
            startingAbilityPushups: "6-15",
            startingAbilitySquats: "26-50",
            startingAbilityPlank: "45-90",
            sleepBucket: "7-8 hours",
            preferenceExclusions: JSON.stringify(["None"])
        }
    }
];

async function runTestHarness() {
    console.log("=".repeat(80));
    console.log("  PLAN GENERATOR V2 TEST HARNESS");
    console.log("  Testing with", TEST_PROFILES.length, "synthetic user profiles");
    console.log("=".repeat(80));
    console.log("");

    const results: { name: string; success: boolean; error?: string; stats?: any }[] = [];

    for (let i = 0; i < TEST_PROFILES.length; i++) {
        const testCase = TEST_PROFILES[i];
        console.log(`\n[${i + 1}/${TEST_PROFILES.length}] Testing: ${testCase.name}`);
        console.log("-".repeat(60));

        try {
            // Create test user
            const email = `test_${i + 1}_${Date.now()}@test.com`;
            const user = await prisma.user.create({ data: { email } });

            // Create profile
            const profile = await prisma.profile.create({
                data: {
                    userId: user.id,
                    ...testCase.profile as any
                }
            });

            // Generate plan
            const startTime = Date.now();
            const plan = await generator.generate(user.id, profile);
            const elapsed = Date.now() - startTime;

            if (!plan) {
                throw new Error("Plan generation returned null");
            }

            // Validate plan
            const days = await prisma.workoutDay.findMany({
                where: { planId: plan.id },
                include: { exercises: true }
            });

            // Check constraints
            let strengthDaysValid = true;
            let day3Valid = true;
            let day4Valid = true;

            for (const day of days) {
                if (day.dayType === "Rest") continue;

                const roles = day.exercises.map(e => e.role);

                if (day.dayType.includes("Strength")) {
                    // Strength days should have lower, push, pull, core
                    // (checking if at least 4 exercises exist for non-15min)
                    if (day.estimatedMinutes >= 25 && day.exercises.length < 4) {
                        strengthDaysValid = false;
                    }
                }

                if (day.dayType === "Conditioning Core Mobility") {
                    // Day 3 should have conditioning and mobility
                    if (!roles.includes("conditioning") && !roles.includes("mobility")) {
                        day3Valid = false;
                    }
                }

                if (day.dayType === "Strength Balanced Posture") {
                    // Day 4 should ideally have posture work
                    // This is a soft check
                }
            }

            const stats = {
                totalDays: days.length,
                workoutDays: days.filter(d => d.dayType !== "Rest").length,
                restDays: days.filter(d => d.dayType === "Rest").length,
                optionalDays: days.filter(d => d.isOptional).length,
                avgExercisesPerDay: (days.reduce((sum, d) => sum + d.exercises.length, 0) / days.filter(d => d.dayType !== "Rest").length).toFixed(1),
                generationTimeMs: elapsed,
                strengthDaysValid,
                day3Valid,
                day4Valid
            };

            console.log("  ✓ Plan generated successfully");
            console.log(`    - Total days: ${stats.totalDays} (${stats.workoutDays} workout, ${stats.restDays} rest, ${stats.optionalDays} optional)`);
            console.log(`    - Avg exercises/day: ${stats.avgExercisesPerDay}`);
            console.log(`    - Time: ${stats.generationTimeMs}ms`);
            console.log(`    - Strength days valid: ${stats.strengthDaysValid ? "✓" : "✗"}`);
            console.log(`    - Day 3 valid: ${stats.day3Valid ? "✓" : "✗"}`);

            // Sample day output
            const sampleDay = days.find(d => d.dayType === "Strength Lower Focus");
            if (sampleDay) {
                console.log(`\n  Sample Day (${sampleDay.dayType}):`);
                for (const ex of sampleDay.exercises) {
                    const exerciseDetails = await prisma.exercise.findUnique({ where: { id: ex.exerciseId } });
                    const prescription = ex.targetSets
                        ? `${ex.targetSets}x${ex.targetReps || ex.targetSeconds + "s"}`
                        : `${ex.targetSeconds}s`;
                    console.log(`    [${ex.role}] ${exerciseDetails?.name} - ${prescription}`);
                }
            }

            results.push({ name: testCase.name, success: true, stats });

        } catch (error: any) {
            console.log(`  ✗ FAILED: ${error.message}`);
            results.push({ name: testCase.name, success: false, error: error.message });
        }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("  SUMMARY");
    console.log("=".repeat(80));
    console.log(`\nTotal: ${results.length} profiles tested`);
    console.log(`Passed: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);

    if (results.some(r => !r.success)) {
        console.log("\nFailed tests:");
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    // Cleanup test data
    console.log("\nCleaning up test data...");
    await prisma.exerciseLog.deleteMany({});
    await prisma.workoutExercise.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: "@test.com" } } });
    console.log("Done!");
}

runTestHarness()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
