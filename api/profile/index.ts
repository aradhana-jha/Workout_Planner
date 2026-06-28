import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthConfigurationError, prisma, verifyAuthToken } from '../auth/_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    let user;
    try {
        user = verifyAuthToken(req);
    } catch (error) {
        if (isAuthConfigurationError(error)) {
            return res.status(500).json({ error: 'server_auth_not_configured' });
        }
        throw error;
    }

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

            // Import plan generator and generate plan
            const { PlanGenerator } = await import('../../lib/planGenerator');
            const generator = new PlanGenerator();
            const plan = await generator.generate(user.userId, profile);

            return res.status(200).json({ profile, planId: plan?.id, message: 'Plan generated!' });
        } catch (error) {
            console.error('Profile error:', error);
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PLAN_COVERAGE') {
                return res.status(422).json({
                    error: 'plan_generation_insufficient_exercises',
                    message: 'We could not build a complete safe plan from the current exercise library and selected constraints.',
                });
            }
            return res.status(500).json({ error: 'Error saving profile' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
