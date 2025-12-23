const { PrismaClient } = require('@prisma/client');
const { PlanGenerator } = require('./planGenerator');

const prisma = new PrismaClient();
const generator = new PlanGenerator();

async function createTestUser(email) {
    return prisma.user.upsert({
        where: { email },
        update: {},
        create: { email }
    });
}

const profiles = [
    {
        name: "Beginner with no equipment",
        goal: "Lose body fat",
        equipment: ["No equipment"],
        timePerWorkout: 25,
        experienceLevel: "beginner",
        recentConsistency: "0 days per week",
        painAreas: ["None"],
        movementRestrictions: ["None"],
        workoutStylePreference: "Mostly cardio",
        focusAreas: ["Core"],
        intensityPreference: "Easy",
        sleepBucket: "7-8 hours",
        preferenceExclusions: ["Running"],
        startingAbilityPushups: "0",
        startingAbilitySquats: "0-10",
        startingAbilityPlank: "under 20 seconds"
    },
    {
        name: "Intermediate with Dumbbells and Knee Pain",
        goal: "Build muscle",
        equipment: ["No equipment", "Dumbbells"],
        timePerWorkout: 40,
        experienceLevel: "intermediate",
        recentConsistency: "3-4 days per week",
        painAreas: ["Knees"],
        movementRestrictions: ["Lunges are difficult"],
        workoutStylePreference: "Mostly strength training",
        focusAreas: ["Chest and arms", "Back and posture"],
        intensityPreference: "Moderate",
        sleepBucket: "8+ hours",
        preferenceExclusions: ["Burpees"],
        startingAbilityPushups: "6–15",
        startingAbilitySquats: "26-50",
        startingAbilityPlank: "45-90 seconds"
    },
    {
        name: "Advanced Elite",
        goal: "Get stronger",
        equipment: ["No equipment", "Dumbbells", "Barbell and weight plates", "Pull-up bar"],
        timePerWorkout: 60,
        experienceLevel: "advanced",
        recentConsistency: "5+ days per week",
        painAreas: ["None"],
        movementRestrictions: ["None"],
        workoutStylePreference: "Mostly strength training",
        focusAreas: ["Full body balance (no focus)"],
        intensityPreference: "Hard",
        sleepBucket: "8+ hours",
        preferenceExclusions: ["None"],
        startingAbilityPushups: "16+",
        startingAbilitySquats: "50+",
        startingAbilityPlank: "90+ seconds"
    }
];

async function run() {
    console.log("Starting Test Harness...");

    // Clear old test data
    try {
        await prisma.exerciseLog.deleteMany();
        await prisma.workoutExercise.deleteMany();
        await prisma.workoutDay.deleteMany();
        await prisma.plan.deleteMany();
        await prisma.profile.deleteMany();
        await prisma.user.deleteMany();
    } catch (e) {
        console.log("Cleanup failed (probably first run), continuing...");
    }

    for (const p of profiles) {
        console.log(`\n--- Generating plan for: ${p.name} ---`);
        const user = await createTestUser(`${p.name.replace(/\s/g, '_').toLowerCase()}@test.com`);

        const profile = await prisma.profile.create({
            data: {
                userId: user.id,
                goal: p.goal,
                equipment: JSON.stringify(p.equipment),
                timePerWorkout: p.timePerWorkout,
                experienceLevel: p.experienceLevel,
                recentConsistency: p.recentConsistency,
                painAreas: JSON.stringify(p.painAreas),
                movementRestrictions: JSON.stringify(p.movementRestrictions),
                workoutStylePreference: p.workoutStylePreference,
                focusAreas: JSON.stringify(p.focusAreas),
                intensityPreference: p.intensityPreference,
                sleepBucket: p.sleepBucket,
                preferenceExclusions: JSON.stringify(p.preferenceExclusions),
                startingAbilityPushups: p.startingAbilityPushups,
                startingAbilitySquats: p.startingAbilitySquats,
                startingAbilityPlank: p.startingAbilityPlank
            }
        });

        const plan = await generator.generate(user.id, profile);
        console.log(`Successfully generated plan ${plan.id}`);

        const days = await prisma.workoutDay.findMany({
            where: { planId: plan.id },
            orderBy: { dayNumber: 'asc' },
            include: { exercises: { include: { exercise: true }, orderBy: { sortOrder: 'asc' } } }
        });

        console.log(`Total days: ${days.length}`);

        // Print sample days
        [1, 2, 3, 5, 8, 15, 22, 30].forEach(dayNum => {
            const d = days.find(day => day.dayNumber === dayNum);
            if (d) {
                console.log(`\nDay ${d.dayNumber}: ${d.dayType} ${d.isOptional ? '(Optional)' : ''}`);
                if (d.dayType === "Rest") {
                    console.log("  - REST DAY");
                } else {
                    d.exercises.forEach(ex => {
                        const pres = ex.targetReps ? `${ex.targetSets}x${ex.targetReps}` : `${ex.targetSets}x${ex.targetSeconds}s`;
                        console.log(`  - [${ex.role.padEnd(12)}] ${ex.exercise.name.padEnd(35)} | ${pres.padEnd(10)} | Rest: ${ex.targetRestSeconds}s`);
                    });
                }
            }
        });
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
