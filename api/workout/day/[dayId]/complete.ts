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

    const { dayId } = req.query;

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
