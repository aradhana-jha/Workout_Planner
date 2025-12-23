import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Helper to verify JWT
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

    if (req.method === 'GET') {
        const profile = await prisma.profile.findUnique({ where: { userId: user.userId } });
        return res.status(200).json({ profile });
    }

    if (req.method === 'POST') {
        try {
            const {
                goal, equipment, timePerWorkout, experienceLevel, recentConsistency,
                painAreas, movementRestrictions, workoutStylePreference, focusAreas,
                intensityPreference, startingAbilityPushups, startingAbilitySquats,
                startingAbilityPlank, sleepBucket, preferenceExclusions
            } = req.body;

            const profile = await prisma.profile.upsert({
                where: { userId: user.userId },
                update: {
                    goal, equipment, timePerWorkout, experienceLevel, recentConsistency,
                    painAreas, movementRestrictions, workoutStylePreference, focusAreas,
                    intensityPreference, startingAbilityPushups, startingAbilitySquats,
                    startingAbilityPlank, sleepBucket, preferenceExclusions
                },
                create: {
                    userId: user.userId, goal, equipment, timePerWorkout, experienceLevel,
                    recentConsistency, painAreas, movementRestrictions, workoutStylePreference,
                    focusAreas, intensityPreference, startingAbilityPushups, startingAbilitySquats,
                    startingAbilityPlank, sleepBucket, preferenceExclusions
                }
            });

            // Mark old plans as replaced
            await prisma.plan.updateMany({
                where: { userId: user.userId, status: 'active' },
                data: { status: 'replaced' }
            });

            // Import plan generator and generate plan
            const { PlanGenerator } = await import('../../lib/planGenerator');
            const generator = new PlanGenerator();
            const plan = await generator.generate(user.userId, profile);

            return res.status(200).json({ profile, planId: plan?.id, message: 'Plan generated!' });
        } catch (error) {
            console.error('Profile error:', error);
            return res.status(500).json({ error: 'Error saving profile' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
