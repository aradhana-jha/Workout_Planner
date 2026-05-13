import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    GOOGLE_CLIENT_ID,
    buildGoogleCallbackUrl,
    createOAuthState,
    toLoginErrorUrl,
    toSafeRedirectPath,
} from '../_shared';

const GOOGLE_SCOPES = ['openid', 'email', 'profile'].join(' ');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!GOOGLE_CLIENT_ID) {
        return res.redirect(toLoginErrorUrl(req, 'google_not_configured'));
    }

    const redirectTo = toSafeRedirectPath(req.query.redirectTo);
    const state = createOAuthState({ redirectTo });
    const callbackUrl = buildGoogleCallbackUrl(req);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES);
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('state', state);

    return res.redirect(authUrl.toString());
}
