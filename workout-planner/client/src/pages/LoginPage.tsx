import React, { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail, MoveRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import loginReferenceImage from '../assets/login/login-reference-nomenu.png';

const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';
const GOOGLE_LOGIN_URL = '/api/auth/google/start?redirectTo=%2Fdashboard';
const DEMO_GOOGLE_EMAIL = 'google.demo@workoutplanner.app';
const POST_AUTH_NOTICE_KEY = 'post_auth_notice';

type AuthIntent = 'login' | 'google';

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
            <path
                fill="#EA4335"
                d="M12.25 10.2v3.92h5.45c-.24 1.28-.97 2.37-2.03 3.1l3.3 2.56c1.92-1.77 3.03-4.37 3.03-7.44 0-.73-.06-1.43-.2-2.1H12.25Z"
            />
            <path
                fill="#4285F4"
                d="M12.25 22c2.74 0 5.03-.9 6.71-2.44l-3.3-2.56c-.92.62-2.09.99-3.41.99-2.63 0-4.86-1.77-5.66-4.16H3.19v2.64A10.14 10.14 0 0 0 12.25 22Z"
            />
            <path
                fill="#FBBC05"
                d="M6.59 13.83a6.08 6.08 0 0 1 0-3.66V7.53H3.19a10.14 10.14 0 0 0 0 8.94l3.4-2.64Z"
            />
            <path
                fill="#34A853"
                d="M12.25 6.01c1.49 0 2.83.51 3.89 1.52l2.92-2.92C17.28 2.95 14.99 2 12.25 2A10.14 10.14 0 0 0 3.19 7.53l3.4 2.64c.8-2.39 3.03-4.16 5.66-4.16Z"
            />
        </svg>
    );
}

function parseAuthMessage(error: unknown) {
    const errorCode = (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error === 'string'
    )
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : '';

    switch (errorCode) {
        case 'account_not_found':
            return 'No account found for this email. Use Create account to start your plan.';
        case 'server_auth_not_configured':
            return 'Secure login is not configured on the server. Add JWT_SECRET before using email login.';
        case 'google_not_configured':
            return 'Google sign-in is not configured yet. Add the Google client ID and secret first.';
        case 'access_denied':
            return 'Google sign-in was cancelled.';
        case 'google_email_not_verified':
            return 'Your Google account email must be verified before signing in.';
        default:
            return errorCode || 'Something went wrong. Please try again.';
    }
}

function getAuthErrorMessage(code: string) {
    return parseAuthMessage({ response: { data: { error: code } } });
}

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loadingIntent, setLoadingIntent] = useState<AuthIntent | null>(null);
    const login = useAuthStore((state) => state.login);
    const signup = useAuthStore((state) => state.signup);
    const token = useAuthStore((state) => state.token);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (token) {
            navigate('/dashboard', { replace: true });
        }
    }, [navigate, token]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const authError = params.get('error');
        if (authError) {
            setNotice('');
            setError(getAuthErrorMessage(authError));
        }
    }, [location.search]);

    const applySuccessfulAuth = (nextStep: 'dashboard' | 'onboarding', message?: string) => {
        setError('');
        setNotice(message || '');
        if (message) {
            sessionStorage.setItem(POST_AUTH_NOTICE_KEY, message);
        } else {
            sessionStorage.removeItem(POST_AUTH_NOTICE_KEY);
        }
        navigate(nextStep === 'onboarding' ? '/onboarding' : '/dashboard');
    };

    const handleEmailLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoadingIntent('login');
        setError('');
        setNotice('');

        try {
            const response = await login(email);
            applySuccessfulAuth(response.nextStep, response.message);
        } catch (authError) {
            setError(parseAuthMessage(authError));
        } finally {
            setLoadingIntent(null);
        }
    };

    const handleCreateAccount = () => {
        const nextUrl = email.trim()
            ? `/create-account?email=${encodeURIComponent(email.trim())}`
            : '/create-account';
        navigate(nextUrl);
    };

    const handleGoogleSignIn = async () => {
        setLoadingIntent('google');
        setError('');
        setNotice('');

        if (DEMO_MODE_ENABLED) {
            try {
                const response = await signup(DEMO_GOOGLE_EMAIL);
                applySuccessfulAuth(response.nextStep, response.message);
            } catch (authError) {
                setError(parseAuthMessage(authError));
                setLoadingIntent(null);
            }
            return;
        }

        window.location.assign(GOOGLE_LOGIN_URL);
    };

    const isBusy = loadingIntent !== null;

    return (
        <div className="app-shell px-3 py-4 sm:px-4 sm:py-6">
            <div className="mx-auto flex min-h-screen w-full max-w-[29.5rem] items-center justify-center">
                <div className="w-full overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,#07111D_0%,#081427_100%)] shadow-[0_35px_80px_rgba(1,6,16,0.56)]">
                    <div className="relative h-[30rem] overflow-hidden sm:h-[30.5rem]">
                        <img
                            src={loginReferenceImage}
                            alt="Workout Planner hero"
                            className="h-full w-full scale-[1.02] object-cover object-top"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,rgba(7,17,29,0)_0%,rgba(7,17,29,0.18)_100%)]" />
                    </div>

                    <div className="relative -mt-[9.5rem] px-5 pb-5">
                        <section className="flex flex-col gap-3 rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,19,39,0.62)_0%,rgba(5,17,35,0.56)_100%)] px-4 py-4 backdrop-blur-md">
                            <div className="mx-auto h-1.5 w-10 rounded-full bg-[linear-gradient(90deg,#0798D8_0%,#18F5E9_100%)]" />

                            <header className="space-y-1 text-center">
                                <h1 className="text-[1.42rem] font-semibold tracking-[-0.03em] text-white">
                                    Welcome back
                                </h1>
                                <p className="text-[0.78rem] text-[#A7B5C9]">
                                    Log in to continue your journey.
                                </p>
                            </header>

                            {(error || notice) && (
                                <div
                                    className={[
                                        'rounded-[18px] px-4 py-3 text-sm font-medium leading-5',
                                        error
                                            ? 'border border-rose-400/35 bg-rose-500/14 text-rose-100'
                                            : 'border border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
                                    ].join(' ')}
                                >
                                    {error || notice}
                                </div>
                            )}

                            <form onSubmit={handleEmailLogin} className="flex flex-col gap-2.5">
                                <label
                                    htmlFor="login-email"
                                    className="flex min-h-[46px] w-full items-center gap-3 rounded-[16px] border border-white/14 bg-[rgba(30,45,71,0.46)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-cyan-300/55 focus-within:ring-2 focus-within:ring-cyan-300/20"
                                >
                                    <Mail className="h-4.5 w-4.5 text-[#D7E0EA]" strokeWidth={1.8} />
                                    <input
                                        id="login-email"
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        autoComplete="email"
                                        inputMode="email"
                                        placeholder="Email"
                                        required
                                        className="w-full bg-transparent text-[0.88rem] text-[#F5F8FC] outline-none placeholder:text-[#95A3B9]"
                                    />
                                </label>

                                <button
                                    type="submit"
                                    disabled={isBusy}
                                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#1696D4_0%,#1BEDE0_100%)] px-6 py-2.5 text-[0.86rem] font-semibold tracking-[-0.01em] text-[#04141E] shadow-[0_12px_20px_rgba(11,219,214,0.16)] transition hover:brightness-[1.03] disabled:cursor-wait disabled:opacity-70"
                                >
                                    <span>{loadingIntent === 'login' ? 'Signing in...' : 'Continue'}</span>
                                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                                </button>
                            </form>

                            <div className="flex items-center gap-4 text-[0.73rem] text-[#8A98AB]">
                                <div className="h-px flex-1 bg-white/12" />
                                <span>or</span>
                                <div className="h-px flex-1 bg-white/12" />
                            </div>

                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                    void handleGoogleSignIn();
                                }}
                                className="flex min-h-[46px] w-full items-center justify-center gap-3 rounded-full border border-white/22 bg-[rgba(8,19,39,0.16)] px-6 py-2.5 text-[0.84rem] font-medium text-white transition hover:border-white/40 hover:bg-white/[0.04] disabled:cursor-wait disabled:opacity-70"
                            >
                                <GoogleIcon />
                                <span>{loadingIntent === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
                            </button>

                            <div className="flex items-center justify-center gap-2 pt-1 text-[0.8rem] text-[#95A3B8]">
                                    <span>Don’t have an account?</span>
                                <button
                                    type="button"
                                    onClick={handleCreateAccount}
                                    className="inline-flex items-center gap-1.5 text-[#10E9EA] transition hover:text-[#7EF7F5] disabled:cursor-wait disabled:opacity-60"
                                >
                                    <span>Create account</span>
                                    <MoveRight className="h-4 w-4" strokeWidth={2.2} />
                                </button>
                            </div>
                        </section>

                        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-[#95A3B8]">
                            <LockKeyhole className="h-4 w-4" strokeWidth={1.9} />
                            <span>Secure login</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
