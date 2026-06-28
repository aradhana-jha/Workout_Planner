import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthConfigurationError, prisma, verifyAuthToken } from '../../auth/_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let user;
    try {
        user = verifyAuthToken(req);
    } catch (error) {
        if (isAuthConfigurationError(error)) {
            return res.status(500).json({ error: 'server_auth_not_configured' });
        }
        throw error;
    }

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { dayId } = req.body;
    if (!dayId) return res.status(400).json({ error: 'dayId is required' });

    try {
        const updateResult = await prisma.workoutDay.updateMany({
            where: {
                id: dayId as string,
                plan: { userId: user.userId },
            },
            data: { isCompleted: true, completedAt: new Date() }
        });

        if (updateResult.count === 0) {
            return res.status(404).json({ error: 'Workout day not found' });
        }

        return res.status(200).json({ message: 'Day completed' });
    } catch (error) {
        console.error('Complete error:', error);
        return res.status(500).json({ error: 'Error completing day' });
    }
}
