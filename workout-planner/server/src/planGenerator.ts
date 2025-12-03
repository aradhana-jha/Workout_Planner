import { PrismaClient, Exercise, Profile } from '@prisma/client';

const prisma = new PrismaClient();

export class PlanGenerator {
    async generate(userId: string, profile: Profile) {
        // 1. Fetch all exercises
        const allExercises = await prisma.exercise.findMany();

        // Filter based on goal
        let targetExercises: Exercise[] = allExercises;
        if (profile.goal === 'lose_fat') {
            targetExercises = allExercises.filter((e: Exercise) => ['full_body', 'core', 'legs'].includes(e.muscleGroup));
        } else if (profile.goal === 'build_muscle') {
            targetExercises = allExercises.filter((e: Exercise) => ['chest', 'legs', 'full_body'].includes(e.muscleGroup));
        }

        // Fallback
        if (targetExercises.length < 5) targetExercises = allExercises;

        // 2. Create Plan
        const plan = await prisma.plan.create({
            data: {
                userId,
                startDate: new Date(),
                status: 'active',
            },
        });

        // 3. Generate 30 Days
        for (let day = 1; day <= 30; day++) {
            const isRestDay = day % 4 === 0;

            const workoutDay = await prisma.workoutDay.create({
                data: {
                    planId: plan.id,
                    dayNumber: day,
                    title: isRestDay ? 'Rest & Recovery' : `Day ${day}: ${this.getDayTitle(profile.goal)}`,
                    isCompleted: false,
                },
            });

            if (!isRestDay) {
                // Select 5 random exercises
                const dailyExercises = this.shuffle(targetExercises).slice(0, 5);

                for (const exercise of dailyExercises) {
                    await prisma.workoutExercise.create({
                        data: {
                            workoutDayId: workoutDay.id,
                            exerciseId: exercise.id,
                            targetSets: this.getSets(day),
                            targetReps: this.getReps(day, profile.goal),
                        },
                    });
                }
            }
        }

        return plan;
    }

    private getDayTitle(goal: string): string {
        if (goal === 'lose_fat') return 'Fat Burner';
        if (goal === 'build_muscle') return 'Strength Builder';
        return 'Daily Activity';
    }

    private getSets(day: number): number {
        if (day <= 7) return 3;
        if (day <= 14) return 3;
        if (day <= 21) return 4;
        return 4;
    }

    private getReps(day: number, goal: string): number {
        if (goal === 'build_muscle') return day <= 15 ? 10 : 12;
        return day <= 15 ? 12 : 15;
    }

    private shuffle<T>(array: T[]): T[] {
        return array.sort(() => 0.5 - Math.random());
    }
}
