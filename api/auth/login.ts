import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    buildAuthResponse,
    findUserByEmail,
    isAuthConfigurationError,
    resolveNextStep,
    validatePassword,
    verifyPassword,
} from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
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

        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({ error: 'invalid_credentials' });
        }

        if (!user.passwordHash) {
            return res.status(403).json({ error: 'password_not_configured' });
        }

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'invalid_credentials' });
        }

        const nextStep = await resolveNextStep(user.id);

        return res.status(200).json(buildAuthResponse(user, nextStep));
    } catch (error) {
        console.error('Login error:', error);
        if (isAuthConfigurationError(error)) {
            return res.status(500).json({ error: 'server_auth_not_configured' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
}
