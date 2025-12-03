import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from './auth';

const prisma = new PrismaClient();
const router = Router();

// Get Current Plan
router.get('/plan/current', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user.userId;
    const plan = await prisma.plan.findFirst({
        where: { userId, status: 'active' },
        include: {
            days: {
                orderBy: { dayNumber: 'asc' },
                select: { id: true, dayNumber: true, title: true, isCompleted: true, completedAt: true }
            }
        }
    });
    res.json({ plan });
});

// Get Workout Day Details
router.get('/day/:dayId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { dayId } = req.params;
    const workoutDay = await prisma.workoutDay.findUnique({
        where: { id: dayId },
        include: {
            exercises: {
                include: {
                    exercise: true,
                    logs: { orderBy: { setNumber: 'asc' } }
                }
            }
        }
    });
    res.json({ workoutDay });
});

// Log Set
const logSchema = z.object({
    exerciseId: z.string(),
    setNumber: z.number(),
    reps: z.number(),
    weight: z.number().optional(),
});

router.post('/day/:dayId/log', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { dayId } = req.params;
        const { exerciseId, setNumber, reps, weight } = logSchema.parse(req.body);

        // Find WorkoutExercise
        const workoutExercise = await prisma.workoutExercise.findFirst({
            where: { workoutDayId: dayId, exerciseId }
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
});

// Complete Day
router.post('/day/:dayId/complete', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { dayId } = req.params;

    await prisma.workoutDay.update({
        where: { id: dayId },
        data: { isCompleted: true, completedAt: new Date() }
    });

    res.json({ message: 'Day completed' });
});

export default router;
