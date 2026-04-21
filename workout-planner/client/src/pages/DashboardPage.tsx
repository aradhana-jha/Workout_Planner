import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { CalendarDays, CheckCircle, ChevronRight, Circle, Dumbbell, Flame, Lock, Target, TimerReset } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';

interface Day {
    id: string;
    dayNumber: number;
    title: string;
    isCompleted: boolean;
    completedAt: string | null;
}

interface Plan {
    id: string;
    days: Day[];
}

function getStreak(days: Day[]) {
    let streak = 0;
    for (const day of days) {
        if (!day.isCompleted) {
            break;
        }
        streak += 1;
    }
    return streak;
}

function formatCompletionDate(date: string | null) {
    if (!date) {
        return null;
    }
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function DashboardMetric({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof Flame;
    label: string;
    value: string;
    tone: string;
}) {
    return (
        <div className="surface-panel p-5">
            <div className="flex items-start justify-between">
                <div>
                    <p className="section-label">{label}</p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
                </div>
                <div className={clsx('rounded-2xl p-3', tone)}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

export function DashboardPage() {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const res = await api.get('/workout/plan/current');
                setPlan(res.data.plan);
                setError(null);
            } catch (error) {
                console.error('Failed to fetch plan', error);
                setError('Unable to load your plan. Check the backend connection and try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchPlan();
    }, []);

    if (loading) {
        return (
            <div className="app-shell px-4 py-8">
                <div className="mx-auto max-w-6xl">
                    <div className="surface-panel animate-pulse p-10">
                        <div className="h-4 w-32 rounded-full bg-slate-200" />
                        <div className="mt-4 h-12 w-72 rounded-full bg-slate-200" />
                        <div className="mt-8 h-56 rounded-[28px] bg-slate-100" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-shell px-4 py-8">
                <div className="mx-auto max-w-3xl">
                    <div className="surface-panel space-y-6 p-8 text-center">
                        <p className="section-label">Dashboard unavailable</p>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">
                            We could not load your plan.
                        </h1>
                        <p className="text-base leading-7 text-slate-600">{error}</p>
                        <button
                            onClick={handleLogout}
                            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="app-shell px-4 py-8">
                <div className="mx-auto max-w-3xl">
                    <div className="surface-panel space-y-6 p-8 text-center">
                        <p className="section-label">No active plan</p>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">
                            Start your first guided block.
                        </h1>
                        <p className="mx-auto max-w-xl text-base leading-7 text-slate-600">
                            Answer a few onboarding questions and the app will build a 30-day sequence around your goal, equipment, and current fitness level.
                        </p>
                        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <button
                                onClick={() => navigate('/onboarding')}
                                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
                            >
                                Create a plan
                            </button>
                            <button
                                onClick={handleLogout}
                                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-slate-100"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentDayIndex = plan.days.findIndex(d => !d.isCompleted);
    const currentDay = currentDayIndex !== -1 ? plan.days[currentDayIndex] : null;
    const completedDays = plan.days.filter(d => d.isCompleted).length;
    const progressPercent = Math.round((completedDays / plan.days.length) * 100);
    const currentWeek = currentDay ? Math.ceil(currentDay.dayNumber / 7) : 5;
    const weekStartIndex = Math.max(0, (currentWeek - 1) * 7);
    const weekDays = plan.days.slice(weekStartIndex, weekStartIndex + 7);
    const streak = getStreak(plan.days);
    const remainingDays = plan.days.length - completedDays;
    const restDays = plan.days.filter(day => day.title.toLowerCase().includes('rest')).length;

    return (
        <div className="app-shell px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="section-label">Workout Planner</p>
                        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
                            Your training home base
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                            Week {currentWeek} of 5
                        </span>
                        <button
                            onClick={handleLogout}
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-white/70"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                <section className="grid gap-5 lg:grid-cols-[1.3fr,0.9fr]">
                    <div className="surface-panel overflow-hidden p-6 sm:p-8">
                        <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="max-w-2xl">
                                    <p className="section-label text-amber-700">Today</p>
                                    <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                                        {currentDay ? currentDay.title : 'You cleared the full plan'}
                                    </h2>
                                    <p className="mt-4 text-base leading-7 text-slate-600">
                                        {currentDay
                                            ? 'Your next session is ready. Open it, expand the movement demos, and work through each set with a clearer guided flow.'
                                            : 'All current sessions are done. You can revisit earlier days or start a new onboarding flow to generate another block.'}
                                    </p>
                                </div>
                                <div className="rounded-[24px] bg-amber-50 px-5 py-4 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.2)]">
                                    <p className="section-label text-amber-700">Progress</p>
                                    <p className="mt-3 text-4xl font-black text-slate-900">{progressPercent}%</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="progress-track">
                                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
                                    <span>{completedDays} of {plan.days.length} days completed</span>
                                    <span className="text-slate-300">•</span>
                                    <span>{remainingDays} sessions remaining</span>
                                    <span className="text-slate-300">•</span>
                                    <span>{restDays} built-in recovery days</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                    onClick={() => currentDay ? navigate(`/workout/${currentDay.id}`) : navigate('/onboarding')}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
                                >
                                    {currentDay ? 'Resume session' : 'Build next plan'}
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => navigate('/onboarding')}
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-600 transition hover:border-amber-300 hover:bg-amber-50"
                                >
                                    Rebuild from onboarding
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                        <DashboardMetric icon={Flame} label="Current streak" value={`${streak} days`} tone="bg-amber-100 text-amber-700" />
                        <DashboardMetric icon={Target} label="Next checkpoint" value={`Day ${currentDay?.dayNumber ?? plan.days.length}`} tone="bg-emerald-100 text-emerald-700" />
                        <DashboardMetric icon={TimerReset} label="Recovery built in" value={`${restDays} rest days`} tone="bg-sky-100 text-sky-700" />
                    </div>
                </section>

                <section className="surface-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="section-label">This week</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                Stay focused on the next seven days
                            </h2>
                        </div>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                            <CalendarDays className="h-4 w-4" />
                            Week {currentWeek}
                        </div>
                    </div>
                    <div className="mt-6 grid gap-3 md:grid-cols-7">
                        {weekDays.map((day) => {
                            const dayIndex = plan.days.findIndex(entry => entry.id === day.id);
                            const isLocked = dayIndex > (currentDayIndex === -1 ? plan.days.length : currentDayIndex);
                            const isCurrent = day.id === currentDay?.id;

                            return (
                                <button
                                    key={day.id}
                                    type="button"
                                    onClick={() => !isLocked && navigate(`/workout/${day.id}`)}
                                    disabled={isLocked}
                                    className={clsx(
                                        'rounded-[24px] border px-4 py-5 text-left transition',
                                        isCurrent
                                            ? 'border-amber-300 bg-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.12)]'
                                            : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white',
                                        isLocked && 'cursor-not-allowed opacity-45'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="section-label">{`Day ${day.dayNumber}`}</span>
                                        {day.isCompleted ? (
                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                        ) : isLocked ? (
                                            <Lock className="h-4 w-4 text-slate-400" />
                                        ) : (
                                            <Circle className="h-4 w-4 text-slate-300" />
                                        )}
                                    </div>
                                    <p className="mt-3 text-sm font-bold leading-6 text-slate-900">
                                        {day.title}
                                    </p>
                                    {formatCompletionDate(day.completedAt) && (
                                        <p className="mt-3 text-xs font-medium text-slate-500">
                                            Completed {formatCompletionDate(day.completedAt)}
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="surface-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="section-label">Plan map</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                Explore the full 30-day block
                            </h2>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                            <Dumbbell className="h-4 w-4" />
                            Full sequence
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {plan.days.map((day, index) => {
                        const isLocked = index > (currentDayIndex === -1 ? 30 : currentDayIndex);
                        const isCurrent = index === currentDayIndex;

                        return (
                            <button
                                key={day.id}
                                type="button"
                                onClick={() => !isLocked && navigate(`/workout/${day.id}`)}
                                disabled={isLocked}
                                className={clsx(
                                    'rounded-[26px] border p-5 text-left transition',
                                    isCurrent
                                        ? 'border-amber-300 bg-white shadow-[0_18px_40px_rgba(245,158,11,0.12)]'
                                        : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white',
                                    isLocked && 'cursor-not-allowed opacity-45'
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className={clsx(
                                        'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]',
                                        day.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    )}>
                                        Day {day.dayNumber}
                                    </span>
                                    {day.isCompleted ? (
                                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                                    ) : isLocked ? (
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    ) : (
                                        <Circle className="h-5 w-5 text-slate-300" />
                                    )}
                                </div>
                                <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900">
                                    {day.title}
                                </h3>
                                {formatCompletionDate(day.completedAt) && (
                                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        Completed {formatCompletionDate(day.completedAt)}
                                    </p>
                                )}
                            </button>
                        );
                    })}
                    </div>
                </section>
            </div>
        </div>
    );
}
