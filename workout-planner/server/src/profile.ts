import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from './auth';
import { PlanGenerator } from './planGenerator';

const prisma = new PrismaClient();
const router = Router();
const generator = new PlanGenerator();

// Updated profile schema to match all onboarding questions
const profileSchema = z.object({
    // Q1: Goal
    goal: z.string(),

    // Q2: Equipment (JSON string array)
    equipment: z.string(),

    // Q3: Time per workout
    timePerWorkout: z.number().min(15).max(60),

    // Q4: Experience level
    experienceLevel: z.string(),

    // Q5: Recent consistency
    recentConsistency: z.string(),

    // Q6: Pain areas (JSON string array)
    painAreas: z.string(),

    // Q7: Movement restrictions (JSON string array)
    movementRestrictions: z.string(),

    // Q8: Workout style preference
    workoutStylePreference: z.string(),

    // Q9: Focus areas (JSON string array)
    focusAreas: z.string(),

    // Q10: Intensity preference
    intensityPreference: z.string(),

    // Q11: Starting abilities (optional)
    startingAbilityPushups: z.string().nullable().optional(),
    startingAbilitySquats: z.string().nullable().optional(),
    startingAbilityPlank: z.string().nullable().optional(),

    // Q12: Sleep
    sleepBucket: z.string(),

    // Q13: Preference exclusions (JSON string array)
    preferenceExclusions: z.string(),
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
        const data = profileSchema.parse(req.body);

        // Upsert Profile
        const profile = await prisma.profile.upsert({
            where: { userId },
            update: data,
            create: { ...data, userId },
        });

        // Delete any existing active plan for this user (fresh start)
        await prisma.plan.updateMany({
            where: { userId, status: 'active' },
            data: { status: 'replaced' }
        });

        // Generate new plan
        console.log(`Generating plan for user ${userId}...`);
        const plan = await generator.generate(userId, profile);
        console.log(`Plan ${plan?.id} generated successfully.`);

        res.json({
            profile,
            planId: plan?.id,
            message: 'Profile saved and plan generated!'
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Validation error:', error.issues);
            res.status(400).json({ error: error.issues });
        } else {
            console.error('Profile/Plan generation error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

export default router;
