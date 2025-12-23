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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const plan = await prisma.plan.findFirst({
        where: { userId: user.userId, status: 'active' },
        include: {
            days: {
                orderBy: { dayNumber: 'asc' },
                select: {
                    id: true, dayNumber: true, weekNumber: true, dayType: true,
                    estimatedMinutes: true, isOptional: true, isCompleted: true, completedAt: true
                }
            }
        }
    });

    if (plan) {
        const transformedPlan = {
            ...plan,
            days: plan.days.map(day => ({
                ...day,
                title: day.dayType === "Rest" ? "Rest Day" : `${day.dayType} (${day.estimatedMinutes} min)`
            }))
        };
        return res.status(200).json({ plan: transformedPlan });
    }

    return res.status(200).json({ plan: null });
}
