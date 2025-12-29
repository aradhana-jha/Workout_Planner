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

    const { dayId } = req.query;

    if (req.method === 'GET') {
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
                title: workoutDay.dayType === "Rest" ? "Rest Day" : `Day ${workoutDay.dayNumber}: ${workoutDay.dayType}`
            };
            return res.status(200).json({ workoutDay: transformedDay });
        }
        return res.status(200).json({ workoutDay: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
