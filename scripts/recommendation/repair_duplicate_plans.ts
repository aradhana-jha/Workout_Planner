import { PrismaClient, type Profile } from '@prisma/client';
import { PlanGenerator } from '../../lib/planGenerator';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

type PlanDay = {
    dayNumber: number;
    exercises: Array<{ exerciseId: string }>;
};

function getExerciseSetKey(day: PlanDay) {
    return day.exercises.map((item) => item.exerciseId).sort().join('|');
}

function getDuplicateGroups(days: PlanDay[]) {
    const groups = new Map<string, number[]>();

    for (const day of days.filter((item) => item.exercises.length > 0)) {
        const key = getExerciseSetKey(day);
        groups.set(key, [...(groups.get(key) ?? []), day.dayNumber]);
    }

    return [...groups.values()].filter((dayNumbers) => dayNumbers.length > 1);
}

async function getAffectedPlans() {
    const plans = await prisma.plan.findMany({
        where: { status: 'active' },
        include: {
            user: { include: { profile: true } },
            days: {
                orderBy: { dayNumber: 'asc' },
                select: {
                    dayNumber: true,
                    exercises: { select: { exerciseId: true } },
                },
            },
        },
    });

    return plans
        .map((plan) => ({ ...plan, duplicateGroups: getDuplicateGroups(plan.days) }))
        .filter((plan) => plan.duplicateGroups.length > 0);
}

async function assertCurrentEngineCoverage(profile: Profile) {
    const generator = new PlanGenerator() as any;
    const exercises = await prisma.exercise.findMany({ where: { isActive: true } });
    const design = generator.designProgram(profile);
    const strictPool = generator.filterExercises(exercises, profile, { respectPreferenceExclusions: true });
    const safetyPool = generator.filterExercises(exercises, profile, { respectPreferenceExclusions: false });

    if (!generator.canBuildCompleteProgram(strictPool, profile, design)
        && !generator.canBuildCompleteProgram(safetyPool, profile, design)) {
        throw new Error('Current recommendation engine cannot build a complete safe plan for this profile');
    }
}

async function main() {
    const affected = await getAffectedPlans();
    console.log(`${apply ? 'Repairing' : 'Found'} ${affected.length} active plans with exact duplicate workout days.`);

    for (const plan of affected) {
        const profile = plan.user.profile;
        if (!profile) {
            throw new Error(`Plan ${plan.id} has no profile and cannot be safely regenerated`);
        }

        await assertCurrentEngineCoverage(profile);
        console.log(`${plan.id.slice(0, 8)}: duplicate groups ${JSON.stringify(plan.duplicateGroups)}; V3 coverage verified`);

        if (!apply) continue;

        const replacement = await new PlanGenerator().generate(plan.userId, profile);
        if (!replacement) throw new Error(`No replacement plan returned for ${plan.id}`);

        const replacementDays = await prisma.workoutDay.findMany({
            where: { planId: replacement.id },
            orderBy: { dayNumber: 'asc' },
            select: {
                dayNumber: true,
                exercises: { select: { exerciseId: true } },
            },
        });
        const remainingDuplicates = getDuplicateGroups(replacementDays);

        if (remainingDuplicates.length > 0) {
            throw new Error(`Replacement ${replacement.id} still contains exact duplicate days: ${JSON.stringify(remainingDuplicates)}`);
        }

        console.log(`${plan.id.slice(0, 8)} -> ${replacement.id.slice(0, 8)}: repaired and verified`);
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
