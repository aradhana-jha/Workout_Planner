import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Dumbbell, Sparkles, TimerReset } from 'lucide-react';

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
        <div className="app-shell flex items-center justify-center px-4 py-10">
            <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr,0.85fr]">
                <section className="surface-panel relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.34),transparent_26rem),linear-gradient(140deg,rgba(255,255,255,0.92),rgba(255,247,237,0.84))] p-8 sm:p-10">
                    <div className="absolute -right-10 top-10 h-44 w-44 rounded-full bg-amber-300/20 blur-3xl" />
                    <div className="relative max-w-xl space-y-8">
                        <div className="space-y-4">
                            <p className="section-label text-amber-700">Workout Planner</p>
                            <h1 className="max-w-lg text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                                A guided home-workout coach, not another blank tracker.
                            </h1>
                            <p className="max-w-xl text-lg leading-8 text-slate-600">
                                Get a beginner-friendly 30-day plan, open the right session instantly, and follow each exercise with a cleaner guided workout flow.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {[
                                {
                                    icon: Sparkles,
                                    label: 'Personalized plan',
                                    copy: 'Shape each day around your goal, recovery, and available equipment.',
                                },
                                {
                                    icon: TimerReset,
                                    label: 'Guided sessions',
                                    copy: 'See your next move, your target, and the session progress at a glance.',
                                },
                                {
                                    icon: Dumbbell,
                                    label: 'Exercise media ready',
                                    copy: 'Every movement card is designed to pull in demos and coaching cues cleanly.',
                                },
                            ].map(feature => (
                                <div key={feature.label} className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_18px_35px_rgba(15,23,42,0.06)]">
                                    <feature.icon className="mb-3 h-5 w-5 text-amber-600" />
                                    <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-700">
                                        {feature.label}
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        {feature.copy}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="surface-panel p-8 sm:p-10">
                    <div className="mx-auto max-w-md space-y-8">
                        <div className="space-y-3">
                            <p className="section-label">Continue</p>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">
                                Sign in with your email
                            </h2>
                            <p className="text-base leading-7 text-slate-600">
                                Returning users go straight to their dashboard. First-time users can jump directly into onboarding after sign-in.
                            </p>
                        </div>

                        {error && (
                            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.04)] outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="submit"
                                    disabled={loadingTarget !== null}
                                    className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                                >
                                    {loadingTarget === 'dashboard' ? 'Opening dashboard...' : 'Sign in'}
                                    <ArrowRight className="h-4 w-4" />
                                </button>

                                <button
                                    type="button"
                                    disabled={!email || loadingTarget !== null}
                                    onClick={() => {
                                        void submit('onboarding');
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loadingTarget === 'onboarding' ? 'Starting onboarding...' : 'Create my plan'}
                                    <Sparkles className="h-4 w-4" />
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    );
}
