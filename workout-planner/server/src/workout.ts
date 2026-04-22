import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/client';
import { z } from 'zod';
import { authMiddleware } from './auth';

const prisma = new PrismaClient();
const router = Router();

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
                    videoUrl: workoutExercise.exercise.videoUrl,
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
