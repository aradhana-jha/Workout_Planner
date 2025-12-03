import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const prisma = new PrismaClient();
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Schema for Login
const loginSchema = z.object({
    email: z.string().email(),
});

// Login Route
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = loginSchema.parse(req.body);

        // Find or Create User
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({ data: { email } });
        }

        // Generate Token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: '30d',
        });

        res.json({ token, user });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

// Middleware
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
        (req as any).user = payload;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

export default router;
