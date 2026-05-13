import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    buildAuthResponse,
    createUserByEmail,
    findUserByEmail,
    resolveNextStep,
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
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const existingUser = await findUserByEmail(email);

        if (existingUser) {
            const hasProfile = (await resolveNextStep(existingUser.id)) === 'dashboard';
            const message = hasProfile
                ? 'Account already exists. We opened the questionnaire so you can update your plan.'
                : 'Account already exists. Continue onboarding to build your plan.';

            return res.status(200).json(buildAuthResponse(existingUser, 'onboarding', message));
        }

        const user = await createUserByEmail(email);

        return res.status(200).json(
            buildAuthResponse(user, 'onboarding', 'Account created. Continue onboarding to build your plan.'),
        );
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
