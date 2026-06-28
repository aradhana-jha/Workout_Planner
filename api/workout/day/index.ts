import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthConfigurationError, prisma, verifyAuthToken } from '../../auth/_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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

    const dayId = Array.isArray(req.query.dayId) ? req.query.dayId[0] : req.query.dayId;
    if (!dayId) return res.status(400).json({ error: 'dayId is required' });

    const workoutDay = await prisma.workoutDay.findFirst({
        where: {
            id: dayId as string,
            plan: { userId: user.userId },
        },
        include: {
            exercises: {
                orderBy: { sortOrder: 'asc' },
                include: {
                    exercise: true,
                    logs: { orderBy: { setNumber: 'asc' } }
                }
            }
        }
    });

    if (workoutDay) {
        const transformedDay = {
            ...workoutDay,
            title: workoutDay.dayType === 'Rest' ? 'Rest Day' : `Day ${workoutDay.dayNumber}: ${workoutDay.dayType}`
        };
        return res.status(200).json({ workoutDay: transformedDay });
    }

    return res.status(200).json({ workoutDay: null });
}
