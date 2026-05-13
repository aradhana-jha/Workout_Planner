import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    buildAuthResponse,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    buildGoogleCallbackUrl,
    escapeForInlineScript,
    findOrCreateUserByEmail,
    parseOAuthState,
    resolveNextStep,
    toLoginErrorUrl,
} from '../_shared';

type GoogleTokenResponse = {
    access_token?: string;
};

type GoogleUserInfoResponse = {
    email?: string;
    email_verified?: boolean;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.redirect(toLoginErrorUrl(req, 'google_not_configured'));
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateToken = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    if (oauthError) {
        return res.redirect(toLoginErrorUrl(req, oauthError));
    }

    if (!code || !stateToken) {
        return res.redirect(toLoginErrorUrl(req, 'google_invalid_response'));
    }

    try {
        parseOAuthState(stateToken);
    } catch {
        return res.redirect(toLoginErrorUrl(req, 'google_invalid_state'));
    }

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: buildGoogleCallbackUrl(req),
            }),
        });

        if (!tokenResponse.ok) {
            return res.redirect(toLoginErrorUrl(req, 'google_token_exchange_failed'));
        }

        const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;

        if (!tokenPayload.access_token) {
            return res.redirect(toLoginErrorUrl(req, 'google_missing_access_token'));
        }

        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenPayload.access_token}`,
            },
        });

        if (!profileResponse.ok) {
            return res.redirect(toLoginErrorUrl(req, 'google_profile_fetch_failed'));
        }

        const profile = (await profileResponse.json()) as GoogleUserInfoResponse;

        if (!profile.email || !profile.email_verified) {
            return res.redirect(toLoginErrorUrl(req, 'google_email_not_verified'));
        }

        const user = await findOrCreateUserByEmail(profile.email);
        const nextStep = await resolveNextStep(user.id);
        const redirectTo = `/${nextStep}`;
        const authPayload = buildAuthResponse(user, nextStep);
        const serializedUser = escapeForInlineScript(JSON.stringify(authPayload.user));
        const serializedToken = escapeForInlineScript(JSON.stringify(authPayload.token));
        const serializedRedirect = escapeForInlineScript(JSON.stringify(redirectTo));

        res.setHeader('Content-Type', 'text/html; charset=utf-8');

        return res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signing in...</title>
  </head>
  <body style="margin:0;font-family:Arial,sans-serif;background:#0b1220;color:#fff;display:grid;min-height:100vh;place-items:center;">
    <p style="font-size:16px;letter-spacing:0.02em;">Completing sign-in...</p>
    <script>
      localStorage.setItem('token', ${serializedToken});
      localStorage.setItem('user', ${serializedUser});
      window.location.replace(${serializedRedirect});
    </script>
  </body>
</html>`);
    } catch (error) {
        console.error('Google auth callback error:', error);
        return res.redirect(toLoginErrorUrl(req, 'google_auth_failed'));
    }
}
