import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import loginReferenceImage from '../assets/login/login-reference.png';

function parseAuthMessage(error: unknown) {
    const errorCode = (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error === 'string'
    )
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : '';

    return errorCode || 'Something went wrong. Please try again.';
}

export function CreateAccountPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const signup = useAuthStore((state) => state.signup);
    const initialEmail = useMemo(() => new URLSearchParams(location.search).get('email') || '', [location.search]);
    const [email, setEmail] = useState(initialEmail);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleContinue = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!email.trim()) {
            setNotice('');
            setError('Enter your email to continue.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        setNotice('');

        try {
            const response = await signup(email);
            if (response.message) {
                sessionStorage.setItem('post_auth_notice', response.message);
            } else {
                sessionStorage.removeItem('post_auth_notice');
            }
            navigate('/onboarding');
        } catch (authError) {
            setError(parseAuthMessage(authError));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="app-shell px-3 py-4 sm:px-4 sm:py-6">
            <div className="mx-auto flex min-h-screen w-full max-w-[29.5rem] items-center justify-center">
                <div className="w-full overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,#07111D_0%,#081427_100%)] shadow-[0_35px_80px_rgba(1,6,16,0.56)]">
                    <div className="relative h-[18rem] overflow-hidden sm:h-[18.5rem]">
                        <img
                            src={loginReferenceImage}
                            alt="Workout Planner hero"
                            className="h-full w-full scale-[1.02] object-cover object-top"
                        />
                        <div className="absolute right-5 top-5 h-14 w-14 rounded-[20px] bg-[radial-gradient(circle_at_top_right,rgba(18,31,49,0.78)_0%,rgba(10,20,34,0.98)_74%)] shadow-[0_8px_20px_rgba(6,12,22,0.36)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,18,0.12)_0%,rgba(4,12,21,0.7)_60%,rgba(7,17,29,0.98)_100%)]" />
                        <div className="absolute left-0 right-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(4,10,18,0.8)_0%,rgba(4,10,18,0)_100%)]" />
                        <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
                            <div className="max-w-[14rem] space-y-2">
                                <p className="text-[0.78rem] uppercase tracking-[0.26em] text-cyan-200/70">
                                    Welcome
                                </p>
                                <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                                    Let&apos;s build your plan.
                                </h1>
                                <p className="text-sm leading-5 text-[#CBD5E3]">
                                    Start with your email, then answer a few questions so the app can create your workout plan.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative -mt-4 px-5 pb-5">
                        <section className="flex flex-col gap-4 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,19,39,0.98)_0%,rgba(5,17,35,0.98)_100%)] px-4 py-5 shadow-[0_24px_50px_rgba(2,8,20,0.4)] backdrop-blur-sm">
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="inline-flex items-center gap-2 self-start text-sm font-medium text-[#A9B7CA] transition hover:text-white"
                            >
                                <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
                                <span>Back to login</span>
                            </button>

                            <div className="space-y-1">
                                <h2 className="text-[1.38rem] font-semibold tracking-[-0.03em] text-white">
                                    Create your account
                                </h2>
                                <p className="text-[0.88rem] leading-5 text-[#94A5BE]">
                                    Enter your email to continue to the questionnaire.
                                </p>
                            </div>

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

                            <form onSubmit={handleContinue} className="flex flex-col gap-3">
                                <label
                                    htmlFor="create-account-email"
                                    className="flex min-h-[52px] w-full items-center gap-3 rounded-[18px] border border-white/12 bg-[rgba(30,45,71,0.74)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-cyan-300/55 focus-within:ring-2 focus-within:ring-cyan-300/20"
                                >
                                    <Mail className="h-5 w-5 text-[#D7E0EA]" strokeWidth={1.8} />
                                    <input
                                        id="create-account-email"
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        autoComplete="email"
                                        inputMode="email"
                                        placeholder="Email"
                                        required
                                        className="w-full bg-transparent text-[0.95rem] text-[#F5F8FC] outline-none placeholder:text-[#95A3B9]"
                                    />
                                </label>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-full bg-[linear-gradient(90deg,#1696D4_0%,#1BEDE0_100%)] px-6 py-3 text-[0.92rem] font-semibold tracking-[-0.01em] text-[#04141E] shadow-[0_16px_26px_rgba(11,219,214,0.2)] transition hover:brightness-[1.03] disabled:cursor-wait disabled:opacity-70"
                                >
                                    <span>{isSubmitting ? 'Continuing...' : 'Continue'}</span>
                                    <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                                </button>
                            </form>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
