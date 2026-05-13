import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

declare global {
    var prismaAuthSingleton: PrismaClient | undefined;
}

const prismaClient = globalThis.prismaAuthSingleton ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaAuthSingleton = prismaClient;
}

export const prisma = prismaClient;
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

type OAuthStatePayload = {
    redirectTo: string;
};

export type AuthNextStep = 'onboarding' | 'dashboard';

export function normalizeEmail(rawEmail: string) {
    return rawEmail.trim().toLowerCase();
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
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
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
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

export function parseOAuthState(stateToken: string) {
    return jwt.verify(stateToken, JWT_SECRET) as OAuthStatePayload;
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
