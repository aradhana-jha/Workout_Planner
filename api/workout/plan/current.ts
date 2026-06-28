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

    const [plan, profile] = await Promise.all([
        prisma.plan.findFirst({
            where: { userId: user.userId, status: 'active' },
            include: {
                days: {
                    orderBy: { dayNumber: 'asc' },
                    select: {
                        id: true, dayNumber: true, weekNumber: true, dayType: true,
                        estimatedMinutes: true, isOptional: true, isCompleted: true, completedAt: true
                    }
                },
            }
        }),
        prisma.profile.findUnique({
            where: { userId: user.userId },
            select: { id: true },
        }),
    ]);

    const profileExists = Boolean(profile);

    if (plan) {
        const transformedPlan = {
            ...plan,
            days: plan.days.map(day => ({
                ...day,
                title: day.dayType === "Rest" ? "Rest Day" : `${day.dayType} (${day.estimatedMinutes} min)`
            }))
        };
        return res.status(200).json({ plan: transformedPlan, profileExists });
    }

    return res.status(200).json({ plan: null, profileExists });
}
