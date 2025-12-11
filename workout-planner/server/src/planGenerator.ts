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
            const focus = isRestDay ? 'Rest & Recovery' : this.getDayFocus(day, profile.goal);

            const workoutDay = await prisma.workoutDay.create({
                data: {
                    planId: plan.id,
                    dayNumber: day,
                    title: `Day ${day}: ${focus}`,
                    isCompleted: false,
                },
            });

            if (!isRestDay) {
                // Get target muscle groups for this day
                const targetMuscles = this.getMusclesForDay(day);

                // Filter exercises that match the target muscles
                // Fallback to all targetExercises if no specific match found (rare)
                const dailyPool = targetExercises.filter(e => targetMuscles.includes(e.muscleGroup));
                const finalPool = dailyPool.length > 0 ? dailyPool : targetExercises;

                // Select up to 6 random exercises from the focused pool
                const dailyExercises = this.shuffle(finalPool).slice(0, 6);

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

    private getDayFocus(day: number, goal: string): string {
        const cycle = day % 4;
        if (cycle === 1) return 'Push (Chest/Tri/Shoulders)';
        if (cycle === 2) return 'Pull (Back/Biceps)';
        if (cycle === 3) return 'Legs & Core';
        return 'Rest';
    }

    private getMusclesForDay(day: number): string[] {
        const cycle = day % 4;
        if (cycle === 1) return ['chest', 'triceps', 'shoulders', 'push'];
        if (cycle === 2) return ['back', 'biceps', 'pull'];
        if (cycle === 3) return ['legs', 'quads', 'hamstrings', 'calves', 'glutes', 'core'];
        return [];
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
