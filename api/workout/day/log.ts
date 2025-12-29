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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { dayId, exerciseId, setNumber, reps, weight } = req.body;
    if (!dayId || !exerciseId) {
        return res.status(400).json({ error: 'dayId and exerciseId are required' });
    }

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
