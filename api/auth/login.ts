import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildAuthResponse, findUserByEmail, resolveNextStep } from './_shared';

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
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({ error: 'account_not_found' });
        }

        const nextStep = await resolveNextStep(user.id);

        return res.status(200).json(buildAuthResponse(user, nextStep));
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
