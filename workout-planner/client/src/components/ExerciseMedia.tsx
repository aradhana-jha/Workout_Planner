import { ExternalLink, PlayCircle, Video } from 'lucide-react';

type VideoSource =
    | { kind: 'youtube' | 'vimeo'; embedUrl: string; externalUrl: string; posterUrl?: string; label: string }
    | { kind: 'file'; src: string; externalUrl: string; posterUrl?: string; label: string }
    | { kind: 'external'; externalUrl: string; posterUrl?: string; label: string };

function getYoutubeId(url: URL) {
    if (url.hostname.includes('youtu.be')) {
        return url.pathname.slice(1);
    }

    if (url.searchParams.get('v')) {
        return url.searchParams.get('v');
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const embedIndex = parts.findIndex(part => part === 'embed' || part === 'shorts');
    if (embedIndex >= 0) {
        return parts[embedIndex + 1];
    }

    return null;
}

function resolveVideoSource(videoUrl: string): VideoSource {
    try {
        const url = new URL(videoUrl);
        const hostname = url.hostname.replace('www.', '');
        const extension = url.pathname.split('.').pop()?.toLowerCase();

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            const id = getYoutubeId(url);
            if (id) {
                return {
                    kind: 'youtube',
                    embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
                    externalUrl: videoUrl,
                    posterUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
                    label: 'YouTube demo',
                };
            }
        }

        if (hostname.includes('vimeo.com')) {
            const id = url.pathname.split('/').filter(Boolean).pop();
            if (id) {
                return {
                    kind: 'vimeo',
                    embedUrl: `https://player.vimeo.com/video/${id}`,
                    externalUrl: videoUrl,
                    label: 'Vimeo demo',
                };
            }
        }

        if (extension && ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(extension)) {
            return {
                kind: 'file',
                src: videoUrl,
                externalUrl: videoUrl,
                label: 'Hosted demo',
            };
        }
    } catch {
        return {
            kind: 'external',
            externalUrl: videoUrl,
            label: 'Open demo',
        };
    }

    return {
        kind: 'external',
        externalUrl: videoUrl,
        label: 'Open demo',
    };
}

interface ExerciseMediaProps {
    title: string;
    videoUrl: string | null;
    isExpanded: boolean;
    onToggle: () => void;
    muscleGroup: string;
    difficulty: string;
}

export function ExerciseMedia({
    title,
    videoUrl,
    isExpanded,
    onToggle,
    muscleGroup,
    difficulty,
}: ExerciseMediaProps) {
    const source = videoUrl ? resolveVideoSource(videoUrl) : null;

    return (
        <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
            {source && isExpanded && (source.kind === 'youtube' || source.kind === 'vimeo') ? (
                <iframe
                    className="aspect-video w-full"
                    src={source.embedUrl}
                    title={`${title} demo`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            ) : source && isExpanded && source.kind === 'file' ? (
                <video
                    className="aspect-video w-full bg-black object-cover"
                    controls
                    playsInline
                    src={source.src}
                    poster={source.posterUrl}
                />
            ) : source?.posterUrl ? (
                <div className="relative aspect-video">
                    <img src={source.posterUrl} alt={`${title} demo preview`} className="h-full w-full object-cover opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                </div>
            ) : (
                <div className="aspect-video bg-[radial-gradient(circle_at_top,#334155,transparent_55%),linear-gradient(135deg,#0f172a,#1e293b_58%,#334155)]">
                    <div className="flex h-full items-center justify-center">
                        <div className="rounded-full border border-white/20 bg-white/10 p-5 backdrop-blur">
                            <Video className="h-8 w-8 text-white" />
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90 backdrop-blur">
                    {muscleGroup}
                </span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100 backdrop-blur">
                    {difficulty}
                </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-slate-950/70 px-4 py-3 text-white backdrop-blur-md">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/55">
                            Exercise Demo
                        </p>
                        <p className="text-sm font-semibold">
                            {source ? source.label : 'Video slot ready'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onToggle}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-100"
                        >
                            <PlayCircle className="h-4 w-4" />
                            {source ? (isExpanded ? 'Hide demo' : 'Play demo') : 'Preview area'}
                        </button>
                        {source && (
                            <a
                                href={source.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
