import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    buildAuthResponse,
    findUserByEmail,
    hashPassword,
    isAuthConfigurationError,
    normalizeEmail,
    prisma,
    resolveNextStep,
    validatePassword,
    verifyPassword,
} from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const existingUser = await findUserByEmail(email);

        if (existingUser) {
            if (!existingUser.passwordHash) {
                return res.status(409).json({ error: 'password_not_configured' });
            }

            const passwordMatches = await verifyPassword(password, existingUser.passwordHash);
            if (!passwordMatches) {
                return res.status(409).json({ error: 'account_already_exists' });
            }

            const nextStep = await resolveNextStep(existingUser.id);
            const message = nextStep === 'dashboard'
                ? 'Account already exists. We signed you in.'
                : 'Account already exists. Continue onboarding to build your plan.';

            return res.status(200).json(buildAuthResponse(existingUser, nextStep, message));
        }

        const user = await prisma.user.create({
            data: {
                email: normalizeEmail(email),
                passwordHash: await hashPassword(password),
            },
        });

        return res.status(200).json(
            buildAuthResponse(user, 'onboarding', 'Account created. Continue onboarding to build your plan.'),
        );
    } catch (error) {
        console.error('Signup error:', error);
        if (isAuthConfigurationError(error)) {
            return res.status(500).json({ error: 'server_auth_not_configured' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
}
