import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { VercelRequest } from '@vercel/node';

declare global {
    var prismaAuthSingleton: PrismaClient | undefined;
}

const prismaClient = globalThis.prismaAuthSingleton ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaAuthSingleton = prismaClient;
}

export const prisma = prismaClient;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;

type OAuthStatePayload = {
    redirectTo: string;
};

export type AuthNextStep = 'onboarding' | 'dashboard';

export function normalizeEmail(rawEmail: string) {
    return rawEmail.trim().toLowerCase();
}

export function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.trim().length < 16) {
        throw new Error('JWT_SECRET must be configured with at least 16 characters');
    }

    return secret;
}

export async function findUserByEmail(rawEmail: string) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(rawEmail) } });
}

export async function createUserByEmail(rawEmail: string) {
    return prisma.user.create({ data: { email: normalizeEmail(rawEmail) } });
}

export async function findOrCreateUserByEmail(rawEmail: string) {
    const email = normalizeEmail(rawEmail);

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        user = await prisma.user.create({ data: { email } });
    }

    return user;
}

export function issueAuthToken(userId: string) {
    return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '30d' });
}

export function verifyAuthToken(req: VercelRequest): { userId: string } | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;

    try {
        return jwt.verify(auth.slice(7), getJwtSecret()) as { userId: string };
    } catch (error) {
        if (error instanceof Error && error.message.includes('JWT_SECRET')) {
            throw error;
        }

        return null;
    }
}

export function isAuthConfigurationError(error: unknown) {
    return error instanceof Error && error.message.includes('JWT_SECRET');
}

export function validatePassword(password: unknown) {
    return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;

    return `${PASSWORD_HASH_PREFIX}:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, passwordHash: string | null | undefined) {
    if (!passwordHash) return false;

    const [prefix, salt, key] = passwordHash.split(':');
    if (prefix !== PASSWORD_HASH_PREFIX || !salt || !key) return false;

    const storedKey = Buffer.from(key, 'hex');
    const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

    return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

export async function resolveNextStep(userId: string): Promise<AuthNextStep> {
    const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { id: true },
    });

    return profile ? 'dashboard' : 'onboarding';
}

export function buildAuthResponse(user: { id: string; email: string }, nextStep: AuthNextStep, message?: string) {
    return {
        token: issueAuthToken(user.id),
        user: { id: user.id, email: user.email },
        nextStep,
        ...(message ? { message } : {}),
    };
}

export function getBaseUrl(req: VercelRequest) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    const protocol = typeof forwardedProto === 'string' ? forwardedProto : 'https';
    const host = typeof forwardedHost === 'string' ? forwardedHost : req.headers.host;

    return `${protocol}://${host}`;
}

export function buildGoogleCallbackUrl(req: VercelRequest) {
    return process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/auth/google/callback`;
}

export function createOAuthState(payload: OAuthStatePayload) {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: '10m' });
}

export function parseOAuthState(stateToken: string) {
    return jwt.verify(stateToken, getJwtSecret()) as OAuthStatePayload;
}

export function toLoginErrorUrl(req: VercelRequest, code: string) {
    return `${getBaseUrl(req)}/login?error=${encodeURIComponent(code)}`;
}

export function toSafeRedirectPath(candidate: unknown) {
    if (candidate === '/onboarding') return '/onboarding';
    return '/dashboard';
}

export function escapeForInlineScript(value: string) {
    return value
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
