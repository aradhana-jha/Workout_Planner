import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

// Question configurations
const QUESTIONS = [
    {
        id: 'goal',
        title: 'What is your main goal for the next 30 days?',
        type: 'single',
        options: [
            'Build muscle and shape',
            'Get stronger',
            'Lose body fat and improve conditioning',
            'Improve fitness and energy'
        ]
    },
    {
        id: 'equipment',
        title: 'What equipment do you have access to?',
        subtitle: 'Choose all that apply',
        type: 'multi',
        options: [
            'No equipment',
            'Resistance bands',
            'Dumbbells',
            'Kettlebell',
            'Barbell and weight plates',
            'Bench',
            'Pull-up bar',
            'Treadmill',
            'Full gym access'
        ]
    },
    {
        id: 'timePerWorkout',
        title: 'How much time can you spend per workout?',
        type: 'single',
        options: [
            { label: '15 minutes', value: 15 },
            { label: '25 minutes', value: 25 },
            { label: '40 minutes', value: 40 },
            { label: '60 minutes', value: 60 }
        ]
    },
    {
        id: 'experienceLevel',
        title: 'What best describes your experience with workouts?',
        type: 'single',
        options: [
            { label: 'Beginner (I have not worked out consistently)', value: 'beginner' },
            { label: 'Some experience (I have done it before, not consistent recently)', value: 'some experience' },
            { label: 'Intermediate (I train regularly and know basic form)', value: 'intermediate' },
            { label: 'Advanced (I train regularly and track progress)', value: 'advanced' }
        ]
    },
    {
        id: 'recentConsistency',
        title: 'How many days per week can you realistically train?',
        subtitle: 'This sets your workout days and rest days. Pick what you can repeat consistently.',
        type: 'single',
        options: [
            { label: '3 days per week', value: '3 days per week' },
            { label: '4 days per week', value: '4 days per week' },
            { label: '5 days per week', value: '5 days per week' }
        ]
    },
    {
        id: 'painAreas',
        title: 'Do you have pain or an injury that we should plan around?',
        subtitle: 'Choose all that apply',
        type: 'multi',
        options: [
            'None',
            'Lower back',
            'Knees',
            'Shoulders',
            'Neck',
            'Wrists',
            'Ankles'
        ]
    },
    {
        id: 'intensityPreference',
        title: 'How hard do you want workouts to feel most days?',
        type: 'single',
        options: [
            { label: 'Easy (I want to build the habit first)', value: 'Easy' },
            { label: 'Moderate (challenging but doable)', value: 'Moderate' },
            { label: 'Hard (I like intense workouts)', value: 'Hard' }
        ]
    }
];

interface FormData {
    goal: string;
    equipment: string[];
    timePerWorkout: number;
    experienceLevel: string;
    recentConsistency: string;
    painAreas: string[];
    movementRestrictions: string[];
    intensityPreference: string;
}

export function OnboardingPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        goal: '',
        equipment: [],
        timePerWorkout: 25,
        experienceLevel: '',
        recentConsistency: '',
        painAreas: [],
        movementRestrictions: [],
        intensityPreference: '',
    });

    const currentQuestion = QUESTIONS[currentStep];
    const isLastStep = currentStep === QUESTIONS.length - 1;
    const progress = ((currentStep + 1) / QUESTIONS.length) * 100;

    const handleSingleSelect = (questionId: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [questionId]: value }));
    };

    const handleMultiSelect = (questionId: string, value: string, maxSelect?: number) => {
        setFormData(prev => {
            const current = prev[questionId as keyof FormData] as string[];

            if (questionId === 'equipment') {
                if (value === 'No equipment') {
                    return { ...prev, equipment: current.includes(value) ? [] : [value] };
                }

                if (value === 'Full gym access') {
                    return { ...prev, equipment: current.includes(value) ? [] : [value] };
                }

                const homeEquipment = current.filter(item => item !== 'Full gym access' && item !== 'No equipment');
                return {
                    ...prev,
                    equipment: homeEquipment.includes(value)
                        ? homeEquipment.filter(item => item !== value)
                        : [...homeEquipment, value],
                };
            }

            // Handle "None" exclusivity
            if (value === 'None') {
                return { ...prev, [questionId]: ['None'] };
            }

            // Remove "None" if selecting something else
            const filtered = current.filter(v => v !== 'None');

            if (filtered.includes(value)) {
                return { ...prev, [questionId]: filtered.filter(v => v !== value) };
            } else {
                if (maxSelect && filtered.length >= maxSelect) {
                    return { ...prev, [questionId]: [...filtered.slice(1), value] };
                }
                return { ...prev, [questionId]: [...filtered, value] };
            }
        });
    };

    const canProceed = () => {
        const q = currentQuestion;
        if (q.type === 'single') {
            return formData[q.id as keyof FormData] !== '' && formData[q.id as keyof FormData] !== undefined;
        }
        if (q.type === 'multi') {
            return (formData[q.id as keyof FormData] as string[]).length > 0;
        }
        return true;
    };

    const handleNext = () => {
        if (isLastStep) {
            handleSubmit();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Prepare data for API
            const profileData = {
                goal: formData.goal,
                equipment: JSON.stringify(formData.equipment.length > 0 ? formData.equipment : ['No equipment']),
                timePerWorkout: formData.timePerWorkout,
                experienceLevel: formData.experienceLevel,
                recentConsistency: formData.recentConsistency,
                painAreas: JSON.stringify(formData.painAreas.length > 0 ? formData.painAreas : ['None']),
                movementRestrictions: JSON.stringify(['None']),
                workoutStylePreference: 'Decide for me',
                focusAreas: JSON.stringify(['Full body balance']),
                intensityPreference: formData.intensityPreference,
                startingAbilityPushups: null,
                startingAbilitySquats: null,
                startingAbilityPlank: null,
                sleepBucket: '7-8 hours',
                preferenceExclusions: JSON.stringify(['None'])
            };

            await api.post('/profile', profileData);
            sessionStorage.removeItem('post_auth_notice');
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to save profile', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderQuestion = () => {
        const q = currentQuestion;

        if (q.type === 'single' && q.options) {
            return (
                <div className="space-y-3">
                    {q.options.map((option, idx) => {
                        const value = typeof option === 'object' ? option.value : option;
                        const label = typeof option === 'object' ? option.label : String(option);
                        const isSelected = formData[q.id as keyof FormData] === value;

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSingleSelect(q.id, value)}
                                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${isSelected
                                    ? 'border-[#22C7B8] bg-[#F3FFFC] text-[#0B1220]'
                                    : 'border-[#DDE7EA] text-[#66758A] hover:border-[#C9D8DD]'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{label}</span>
                                    {isSelected && <Check className="w-5 h-5 text-[#0EAFA3]" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (q.type === 'multi' && q.options) {
            const selected = formData[q.id as keyof FormData] as string[];
            return (
                <div className="space-y-3">
                    {q.options.map((option, idx) => {
                        const optionStr = String(option);
                        const isSelected = selected.includes(optionStr);
                        const maxSelect = 'maxSelect' in q && typeof q.maxSelect === 'number' ? q.maxSelect : undefined;

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleMultiSelect(q.id, optionStr, maxSelect)}
                                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${isSelected
                                    ? 'border-[#22C7B8] bg-[#F3FFFC] text-[#0B1220]'
                                    : 'border-[#DDE7EA] text-[#66758A] hover:border-[#C9D8DD]'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{optionStr}</span>
                                    {isSelected && <Check className="w-5 h-5 text-[#0EAFA3]" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#0B1220_0%,#101B2E_42%,#132238_100%)]">
            {/* Progress bar */}
            <div className="bg-[rgba(247,250,250,0.94)] shadow-[0_12px_40px_rgba(11,18,32,0.16)] backdrop-blur-sm">
                <div className="max-w-xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#66758A]">
                            Question {currentStep + 1} of {QUESTIONS.length}
                        </span>
                        <span className="text-sm font-medium text-[#0EAFA3]">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#DDE7EA]">
                        <div
                            className="h-2 rounded-full bg-[linear-gradient(90deg,#0B1220,#10243B,#22C7B8)] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Question content */}
            <div className="flex-1 flex flex-col justify-center px-4 py-8">
                <div className="max-w-xl mx-auto w-full">
                    <div className="rounded-2xl border border-[#DDE7EA] bg-[#F7FAFA] p-8 shadow-[0_24px_48px_rgba(11,18,32,0.14)]">
                        <h2 className="mb-2 text-2xl font-bold text-[#0B1220]">
                            {currentQuestion.title}
                        </h2>
                        {currentQuestion.subtitle && (
                            <p className="mb-6 text-[#66758A]">{currentQuestion.subtitle}</p>
                        )}

                        <div className="mb-8">
                            {renderQuestion()}
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex justify-between">
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={currentStep === 0}
                                className={`flex items-center rounded-lg px-4 py-2 transition-all ${currentStep === 0
                                    ? 'cursor-not-allowed text-[#B7C3CF]'
                                    : 'text-[#66758A] hover:bg-white'
                                    }`}
                            >
                                <ChevronLeft className="w-5 h-5 mr-1" />
                                Back
                            </button>

                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!canProceed() || loading}
                                className={`flex items-center rounded-lg px-6 py-2 font-medium transition-all ${canProceed() && !loading
                                    ? 'bg-[linear-gradient(135deg,#0B1220_0%,#10243B_55%,#17BDB2_130%)] text-white shadow-[0_12px_24px_rgba(11,18,32,0.18)] hover:opacity-95'
                                    : 'cursor-not-allowed bg-[#DDE7EA] text-[#9BA9B8]'
                                    }`}
                            >
                                {loading ? (
                                    'Creating Plan...'
                                ) : isLastStep ? (
                                    <>
                                        Create My Plan
                                        <Check className="w-5 h-5 ml-1" />
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ChevronRight className="w-5 h-5 ml-1" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
