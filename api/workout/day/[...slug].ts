import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

function verifyToken(req: VercelRequest): { userId: string } | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    } catch {
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const slugParam = req.query.slug;
    const segments = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : [];
    const dayId = segments[0];
    const action = segments[1];

    if (!dayId) return res.status(400).json({ error: 'Workout day id is required' });

    if (!action) {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

        const workoutDay = await prisma.workoutDay.findUnique({
            where: { id: dayId as string },
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

        if (workoutDay) {
            const transformedDay = {
                ...workoutDay,
                title: workoutDay.dayType === 'Rest' ? 'Rest Day' : `Day ${workoutDay.dayNumber}: ${workoutDay.dayType}`
            };
            return res.status(200).json({ workoutDay: transformedDay });
        }
        return res.status(200).json({ workoutDay: null });
    }

    if (action === 'log') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { exerciseId, setNumber, reps, weight } = req.body;

        try {
            const workoutExercise = await prisma.workoutExercise.findFirst({
                where: { workoutDayId: dayId as string, exerciseId }
            });

            if (!workoutExercise) {
                return res.status(404).json({ error: 'Exercise not found in this workout' });
            }

            const existingLog = await prisma.exerciseLog.findFirst({
                where: { workoutExerciseId: workoutExercise.id, setNumber }
            });

            let log;
            if (existingLog) {
                log = await prisma.exerciseLog.update({
                    where: { id: existingLog.id },
                    data: { reps, weight, isDone: true }
                });
            } else {
                log = await prisma.exerciseLog.create({
                    data: { workoutExerciseId: workoutExercise.id, setNumber, reps, weight, isDone: true }
                });
            }

            return res.status(200).json({ log });
        } catch (error) {
            console.error('Log error:', error);
            return res.status(500).json({ error: 'Error logging exercise' });
        }
    }

    if (action === 'complete') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        try {
            await prisma.workoutDay.update({
                where: { id: dayId as string },
                data: { isCompleted: true, completedAt: new Date() }
            });

            return res.status(200).json({ message: 'Day completed' });
        } catch (error) {
            console.error('Complete error:', error);
            return res.status(500).json({ error: 'Error completing day' });
        }
    }

    return res.status(404).json({ error: 'Not found' });
}
