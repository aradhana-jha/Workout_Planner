import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loadingTarget, setLoadingTarget] = useState<'dashboard' | 'onboarding' | null>(null);
    const login = useAuthStore((state) => state.login);
    const navigate = useNavigate();

    const submit = async (target: 'dashboard' | 'onboarding') => {
        try {
            setLoadingTarget(target);
            setError('');
            await login(email);
            navigate(target === 'onboarding' ? '/onboarding' : '/dashboard');
        } catch {
            setError('Login failed. Please try again.');
        } finally {
            setLoadingTarget(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submit('dashboard');
    };

    return (
        <div className="app-shell px-4 py-6">
            <div className="mobile-shell justify-center gap-4">
                <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(150deg,#0ea5e9,#2563eb_50%,#ec4899)] px-5 py-6 text-white shadow-[0_28px_60px_rgba(37,99,235,0.28)]">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-white/72">Workout Planner</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight">
                        Your daily workout plan, ready when you are.
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-white/80">
                        Build a plan around your time, level, and equipment. Open the next session fast, or discover a body-focus workout when you want to train a specific area.
                    </p>

                    <div className="mt-5 grid gap-3">
                        {[
                            {
                                icon: Sparkles,
                                label: 'Personal plan',
                                copy: '30-day routines shaped around your goal, recovery, and available equipment.',
                            },
                            {
                                icon: Compass,
                                label: 'Discover tab',
                                copy: 'Quick picks for abs, legs, glutes, arms, and full-body training.',
                            },
                            {
                                icon: CheckCircle2,
                                label: 'Track progress',
                                copy: 'See completed workouts, return to any day, and keep your history in one place.',
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="rounded-[22px] border border-white/18 bg-white/12 px-4 py-4 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full bg-white/16 p-2">
                                        <item.icon className="h-4 w-4" />
                                    </div>
                                    <p className="text-sm font-black uppercase tracking-[0.16em]">{item.label}</p>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-white/78">{item.copy}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mobile-card p-5">
                    <div className="space-y-2">
                        <p className="section-label">Continue</p>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Sign in with your email</h2>
                        <p className="text-sm leading-6 text-slate-600">
                            Returning users go to their dashboard. First-time users can start onboarding right after sign-in.
                        </p>
                    </div>

                    {error && (
                        <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 shadow-[0_10px_30px_rgba(37,99,235,0.06)] outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <button
                                type="submit"
                                disabled={loadingTarget !== null}
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#0ea5e9,#2563eb,#ec4899)] px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_16px_32px_rgba(37,99,235,0.22)] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
                            >
                                {loadingTarget === 'dashboard' ? 'Opening dashboard...' : 'Login'}
                                <ArrowRight className="h-4 w-4" />
                            </button>

                            <button
                                type="button"
                                disabled={!email || loadingTarget !== null}
                                onClick={() => {
                                    void submit('onboarding');
                                }}
                                className="flex w-full items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loadingTarget === 'onboarding' ? 'Starting onboarding...' : 'Create my plan'}
                                <Sparkles className="h-4 w-4" />
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}
