import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    CalendarDays,
    CheckCircle,
    ChevronRight,
    Clock3,
    Dumbbell,
    Flame,
    History,
    LoaderCircle,
} from 'lucide-react';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/authStore';

type FocusKey = 'full-body' | 'abs' | 'legs' | 'butt' | 'arms';

const FOCUS_OPTIONS: Array<{ key: FocusKey; label: string; blurb: string }> = [
    { key: 'full-body', label: 'Full body workout', blurb: 'Balanced daily training' },
    { key: 'abs', label: 'Abs workout', blurb: 'Core and trunk control' },
    { key: 'legs', label: 'Legs workout', blurb: 'Squat, hinge, and lunge work' },
    { key: 'butt', label: 'Butt workout', blurb: 'Glute-focused lower body work' },
    { key: 'arms', label: 'Arms workout', blurb: 'Push and pull upper-body work' },
];

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

interface FocusWorkoutExercise {
    id: string;
    name: string;
    muscleGroup: string;
    difficulty: string;
    description: string;
    targetLabel: string;
}

interface FocusWorkout {
    key: FocusKey;
    label: string;
    summary: string;
    profileSummary: string;
    estimatedMinutes: number;
    experienceLevel: string;
    exercises: FocusWorkoutExercise[];
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
        return '';
    }
    return new Date(date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

function formatMonthLabel(date: string) {
    return new Date(date).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });
}

function toDateKey(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function getHistoryGroups(days: Day[]) {
    const completedDays = days
        .filter((day) => day.completedAt)
        .sort((left, right) => new Date(right.completedAt ?? 0).getTime() - new Date(left.completedAt ?? 0).getTime());

    const groups: Array<{ month: string; items: Day[] }> = [];

    for (const day of completedDays) {
        const month = formatMonthLabel(day.completedAt!);
        const existing = groups.find((group) => group.month === month);

        if (existing) {
            existing.items.push(day);
        } else {
            groups.push({ month, items: [day] });
        }
    }

    return groups;
}

function getCalendarCells(days: Day[]) {
    const today = new Date();
    const calendarStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const weekdayOffset = calendarStart.getDay();
    calendarStart.setDate(calendarStart.getDate() - weekdayOffset);

    const completedDates = new Set(
        days
            .filter((day) => day.completedAt)
            .map((day) => toDateKey(new Date(day.completedAt!)))
    );

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + index);

        return {
            key: toDateKey(date),
            dayNumber: date.getDate(),
            isCurrentMonth: date.getMonth() === today.getMonth(),
            isToday: toDateKey(date) === toDateKey(today),
            isCompleted: completedDates.has(toDateKey(date)),
        };
    });
}

export function DashboardPage() {
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);

    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeFocus, setActiveFocus] = useState<FocusKey>('full-body');
    const [focusWorkouts, setFocusWorkouts] = useState<Partial<Record<FocusKey, FocusWorkout>>>({});
    const [focusLoading, setFocusLoading] = useState<FocusKey | null>(null);
    const [focusError, setFocusError] = useState<string | null>(null);

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
            } catch (fetchError) {
                console.error('Failed to fetch plan', fetchError);
                setError('Unable to load your plan. Check the backend connection and try again.');
            } finally {
                setLoading(false);
            }
        };

        void fetchPlan();
    }, []);

    useEffect(() => {
        if (focusWorkouts[activeFocus] || focusLoading === activeFocus) {
            return;
        }

        const fetchFocusWorkout = async () => {
            try {
                setFocusLoading(activeFocus);
                setFocusError(null);
                const res = await api.get(`/workout/focus/${activeFocus}`);
                setFocusWorkouts((current) => ({
                    ...current,
                    [activeFocus]: res.data.focusWorkout,
                }));
            } catch (fetchError) {
                console.error('Failed to fetch focus workout', fetchError);
                setFocusError('Unable to load body-focus suggestions right now.');
            } finally {
                setFocusLoading(null);
            }
        };

        void fetchFocusWorkout();
    }, [activeFocus, focusLoading, focusWorkouts]);

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

    const currentDay = plan.days.find((day) => !day.isCompleted) ?? null;
    const completedDays = plan.days.filter((day) => day.isCompleted).length;
    const remainingDays = plan.days.length - completedDays;
    const progressPercent = Math.round((completedDays / plan.days.length) * 100);
    const streak = getStreak(plan.days);
    const activeFocusWorkout = focusWorkouts[activeFocus];
    const historyGroups = getHistoryGroups(plan.days);
    const calendarCells = getCalendarCells(plan.days);
    const currentMonthLabel = new Date().toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="app-shell px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="section-label">Workout Planner</p>
                        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
                            Ready for your next workout
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                            {remainingDays} sessions left
                        </span>
                        <button
                            onClick={handleLogout}
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-white/70"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                <section className="surface-panel overflow-hidden p-6 sm:p-8">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="section-label text-amber-700">Current block</p>
                                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                                    {currentDay ? currentDay.title : 'You completed the active plan'}
                                </h2>
                                <p className="mt-4 text-base leading-7 text-slate-600">
                                    {currentDay
                                        ? 'Keep using the generated plan, or jump into a body-focus workout if you want to train a specific area today.'
                                        : 'You finished the current sequence. Rebuild the plan when you want a fresh 30-day block.'}
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[24rem]">
                                <div className="rounded-[24px] bg-amber-50 px-5 py-4 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.2)]">
                                    <p className="section-label text-amber-700">Progress</p>
                                    <p className="mt-3 text-4xl font-black text-slate-900">{progressPercent}%</p>
                                </div>
                                <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                                    <p className="section-label">Completed</p>
                                    <p className="mt-3 text-3xl font-black text-slate-900">{completedDays}/30</p>
                                </div>
                                <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                                    <p className="section-label">Streak</p>
                                    <p className="mt-3 text-3xl font-black text-slate-900">{streak} days</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
                                <span>{completedDays} of {plan.days.length} days completed</span>
                                <span className="text-slate-300">•</span>
                                <span>{remainingDays} sessions left</span>
                                <span className="text-slate-300">•</span>
                                <span>{streak} day streak</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => currentDay ? navigate(`/workout/${currentDay.id}`) : navigate('/onboarding')}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
                            >
                                {currentDay ? 'Start next planned day' : 'Build next plan'}
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => navigate('/onboarding')}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-600 transition hover:border-amber-300 hover:bg-amber-50"
                            >
                                Rebuild plan
                            </button>
                        </div>
                    </div>
                </section>

                <section className="surface-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="section-label">Body focus</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                Pick the area you want to train today
                            </h2>
                            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                                These workouts are suggested from your saved profile, so exercise count, duration, and set structure follow your current time budget and experience level.
                            </p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                            <Dumbbell className="h-4 w-4" />
                            Profile-based recommendations
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        {FOCUS_OPTIONS.map((focus) => {
                            const isActive = focus.key === activeFocus;
                            return (
                                <button
                                    key={focus.key}
                                    type="button"
                                    onClick={() => setActiveFocus(focus.key)}
                                    className={clsx(
                                        'rounded-[24px] border p-4 text-left transition',
                                        isActive
                                            ? 'border-amber-300 bg-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.12)]'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    )}
                                >
                                    <p className="section-label">{focus.label}</p>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">{focus.blurb}</p>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-6">
                        {focusLoading === activeFocus && !activeFocusWorkout ? (
                            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                Building your {FOCUS_OPTIONS.find((focus) => focus.key === activeFocus)?.label.toLowerCase()}...
                            </div>
                        ) : focusError && !activeFocusWorkout ? (
                            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                {focusError}
                            </div>
                        ) : activeFocusWorkout ? (
                            <div className="space-y-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="max-w-3xl">
                                        <p className="section-label text-amber-700">{activeFocusWorkout.label}</p>
                                        <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                            {activeFocusWorkout.summary}
                                        </h3>
                                        <p className="mt-3 text-base leading-7 text-slate-600">
                                            Built for {activeFocusWorkout.profileSummary.toLowerCase()}.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                                            {activeFocusWorkout.estimatedMinutes} min
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
                                            {activeFocusWorkout.experienceLevel}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
                                            {activeFocusWorkout.exercises.length} exercises
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-3 xl:grid-cols-2">
                                    {activeFocusWorkout.exercises.map((exercise) => (
                                        <div
                                            key={exercise.id}
                                            className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 transition hover:border-slate-300 hover:bg-white"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-lg font-black tracking-tight text-slate-900">
                                                        {exercise.name}
                                                    </p>
                                                    <p className="mt-2 text-sm font-semibold text-slate-500">
                                                        {exercise.muscleGroup} • {exercise.difficulty}
                                                    </p>
                                                </div>
                                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                                                    {exercise.targetLabel}
                                                </span>
                                            </div>
                                            <p className="mt-4 text-sm leading-6 text-slate-600">
                                                {exercise.description || 'Suggested from your profile and current training level.'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>

                <section className="surface-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="section-label">All days</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                Open any day in the plan
                            </h2>
                            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                                The full 30-day block stays visible, but now every day is clickable so users can jump wherever they want without locked cards.
                            </p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                            <CalendarDays className="h-4 w-4" />
                            Compact plan view
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {plan.days.map((day) => {
                            const isCurrent = currentDay?.id === day.id;

                            return (
                                <button
                                    key={day.id}
                                    type="button"
                                    onClick={() => navigate(`/workout/${day.id}`)}
                                    className={clsx(
                                        'rounded-[20px] border p-4 text-left transition',
                                        isCurrent
                                            ? 'border-amber-300 bg-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.12)]'
                                            : day.isCompleted
                                                ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300'
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="section-label">{`Day ${day.dayNumber}`}</span>
                                        {day.isCompleted ? (
                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-slate-400" />
                                        )}
                                    </div>
                                    <p className="mt-3 text-base font-black leading-6 text-slate-900">
                                        {day.title}
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        {day.isCompleted ? `Completed ${formatCompletionDate(day.completedAt)}` : 'Open workout'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="surface-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="section-label">History</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                Your completed workouts by month
                            </h2>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                            <History className="h-4 w-4" />
                            Completed session log
                        </div>
                    </div>

                    {historyGroups.length === 0 ? (
                        <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                            <p className="text-base font-semibold text-slate-700">
                                No workout history yet.
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                Complete a workout and it will appear here with the session name and date.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6 space-y-6">
                            {historyGroups.map((group) => (
                                <div key={group.month} className="space-y-3">
                                    <p className="section-label text-amber-700">{group.month}</p>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {group.items.map((day) => (
                                            <button
                                                key={day.id}
                                                type="button"
                                                onClick={() => navigate(`/workout/${day.id}`)}
                                                className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-base font-black text-slate-900">
                                                            {day.title}
                                                        </p>
                                                        <p className="mt-2 text-sm font-medium text-slate-500">
                                                            {formatCompletionDate(day.completedAt)}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                                                        <CheckCircle className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="surface-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="section-label">Calendar</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                Workout days in {currentMonthLabel}
                            </h2>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                            <Flame className="h-4 w-4" />
                            Highlighted workout days
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                                <div key={label} className="py-2">
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="mt-2 grid grid-cols-7 gap-2">
                            {calendarCells.map((cell) => (
                                <div
                                    key={cell.key}
                                    className={clsx(
                                        'flex aspect-square items-center justify-center rounded-[18px] border text-sm font-semibold transition',
                                        cell.isCurrentMonth
                                            ? 'border-slate-200 bg-white text-slate-700'
                                            : 'border-transparent bg-slate-100/70 text-slate-300',
                                        cell.isCompleted && 'border-amber-200 bg-amber-100 text-amber-800',
                                        cell.isToday && 'ring-2 ring-slate-900/10'
                                    )}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <span>{cell.dayNumber}</span>
                                        {cell.isCompleted && <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-amber-600" />
                                Workout completed
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4 text-slate-400" />
                                Dates are marked from the day you actually completed the workout
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
