import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../generated/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const prisma = new PrismaClient();
const router = Router();
const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length < 16) {
        throw new Error('JWT_SECRET must be configured with at least 16 characters');
    }

    return secret;
}

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;

    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, passwordHash: string | null | undefined) {
    if (!passwordHash) return false;

    const [prefix, salt, key] = passwordHash.split(':');
    if (prefix !== 'scrypt' || !salt || !key) return false;

    const storedKey = Buffer.from(key, 'hex');
    const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

    return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

// Schema for Login
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

// Login Route
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        // Find or Create User
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password) } });
        } else if (!await verifyPassword(password, user.passwordHash)) {
            res.status(401).json({ error: 'invalid_credentials' });
            return;
        }

        // Generate Token
        const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
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
        const payload = jwt.verify(token, getJwtSecret()) as { userId: string; email: string };
        (req as any).user = payload;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

export default router;
