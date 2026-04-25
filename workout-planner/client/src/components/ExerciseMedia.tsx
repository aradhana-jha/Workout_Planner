import { PlayCircle, Video } from 'lucide-react';

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
}

export function ExerciseMedia({
    title,
    videoUrl,
    isExpanded,
    onToggle,
}: ExerciseMediaProps) {
    const source = videoUrl ? resolveVideoSource(videoUrl) : null;

    return (
        <div className="relative overflow-hidden rounded-[24px] border border-[#DDE7EA] bg-[#0B1220] shadow-[0_18px_60px_rgba(11,18,32,0.20)]">
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
                <div className="aspect-video bg-[radial-gradient(circle_at_top,rgba(34,199,184,0.18),transparent_52%),linear-gradient(135deg,#0B1220,#132238_58%,#10243B)]">
                    <div className="flex h-full items-center justify-center">
                        <div className="rounded-full border border-white/20 bg-white/10 p-5 backdrop-blur">
                            <Video className="h-8 w-8 text-white" />
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0B1220] transition hover:bg-[#E8FBF8]"
                    >
                        <PlayCircle className="h-4 w-4" />
                        {source ? (isExpanded ? 'Hide' : 'Play') : 'Preview'}
                    </button>
                </div>
            </div>
        </div>
    );
}
