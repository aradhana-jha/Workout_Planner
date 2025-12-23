import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from './auth';
import { PlanGenerator } from './planGenerator';

const prisma = new PrismaClient();
const router = Router();
const generator = new PlanGenerator();

const profileSchema = z.object({
    goal: z.string(),
    equipment: z.array(z.string()),
    timePerWorkout: z.number(),
    experienceLevel: z.string(),
    recentConsistency: z.string(),
    painAreas: z.array(z.string()),
    movementRestrictions: z.array(z.string()),
    workoutStylePreference: z.string(),
    focusAreas: z.array(z.string()),
    intensityPreference: z.string(),
    startingAbilityPushups: z.string().optional(),
    startingAbilitySquats: z.string().optional(),
    startingAbilityPlank: z.string().optional(),
    sleepBucket: z.string(),
    preferenceExclusions: z.array(z.string()),
});

// Get Profile
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user.userId;
    const profile = await prisma.profile.findUnique({ where: { userId } });
    res.json({ profile });
});

// Create/Update Profile & Generate Plan
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const body = profileSchema.parse(req.body);

        const data = {
            goal: body.goal,
            equipment: JSON.stringify(body.equipment),
            timePerWorkout: body.timePerWorkout,
            experienceLevel: body.experienceLevel,
            recentConsistency: body.recentConsistency,
            painAreas: JSON.stringify(body.painAreas),
            movementRestrictions: JSON.stringify(body.movementRestrictions),
            workoutStylePreference: body.workoutStylePreference,
            focusAreas: JSON.stringify(body.focusAreas),
            intensityPreference: body.intensityPreference,
            startingAbilityPushups: body.startingAbilityPushups,
            startingAbilitySquats: body.startingAbilitySquats,
            startingAbilityPlank: body.startingAbilityPlank,
            sleepBucket: body.sleepBucket,
            preferenceExclusions: JSON.stringify(body.preferenceExclusions),
        };

        // Upsert Profile
        const profile = await prisma.profile.upsert({
            where: { userId },
            update: data,
            create: { ...data, userId },
        });

        // Check if active plan exists
        const activePlan = await prisma.plan.findFirst({
            where: { userId, status: 'active' },
        });

        let plan = activePlan;
        if (!activePlan) {
            // Generate new plan
            plan = await generator.generate(userId, profile);
        }

        res.json({ profile, planId: plan?.id, message: activePlan ? 'Profile updated' : 'Plan generated' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

export default router;
