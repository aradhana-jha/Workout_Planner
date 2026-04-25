import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { APP_NAME } from '../lib/brand';
import logoImage from '../assets/brand/workout-planner-logo.png';

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
        <div className="app-shell overflow-hidden px-4 py-6">
            <div className="mobile-shell justify-center gap-5">
                <section className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(160deg,rgba(255,255,255,0.82),rgba(255,255,255,0.58))] px-5 py-7 shadow-[0_30px_70px_rgba(37,99,235,0.14)] backdrop-blur-xl">
                    <div className="absolute -left-10 top-4 h-24 w-24 rounded-full bg-sky-300/32 blur-2xl" />
                    <div className="absolute -right-8 bottom-4 h-28 w-28 rounded-full bg-pink-300/28 blur-2xl" />

                    <div className="relative flex flex-col items-center text-center">
                        <img
                            src={logoImage}
                            alt={`${APP_NAME} logo`}
                            className="h-28 w-28 rounded-[28px] object-cover shadow-[0_22px_48px_rgba(37,99,235,0.22)]"
                        />
                        <h1 className="mt-5 text-[2.35rem] font-black tracking-[-0.04em] text-slate-950">
                            {APP_NAME}
                        </h1>
                    </div>
                </section>

                <section className="mobile-card px-5 py-5">
                    <div className="space-y-2 text-center">
                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Login with Email</h2>
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
