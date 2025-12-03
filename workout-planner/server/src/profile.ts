import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from './auth';
import { PlanGenerator } from './planGenerator';

const prisma = new PrismaClient();
const router = Router();
const generator = new PlanGenerator();

const profileSchema = z.object({
    age: z.number().min(10).max(100),
    gender: z.string(),
    weight: z.number().positive(),
    targetWeight: z.number().positive(),
    goal: z.enum(['lose_fat', 'build_muscle', 'stay_active']),
    activityLevel: z.enum(['sedentary', 'moderate', 'active']),
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
