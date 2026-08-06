import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Video } from 'lucide-react';

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
    const extension = videoUrl.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();

    if (extension && ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(extension)) {
        return {
            kind: 'file',
            src: videoUrl,
            externalUrl: videoUrl,
            label: 'Hosted demo',
        };
    }

    try {
        const url = new URL(videoUrl);
        const hostname = url.hostname.replace('www.', '');

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            const id = getYoutubeId(url);
            if (id) {
                const start = url.searchParams.get('start') ?? url.searchParams.get('t');
                const end = url.searchParams.get('end');
                const playerParams = new URLSearchParams({
                    rel: '0',
                    modestbranding: '1',
                    playsinline: '1',
                    autoplay: '1',
                    mute: '1',
                    loop: '1',
                    playlist: id,
                });

                if (start && /^\d+$/.test(start)) playerParams.set('start', start);
                if (end && /^\d+$/.test(end)) playerParams.set('end', end);

                return {
                    kind: 'youtube',
                    embedUrl: `https://www.youtube.com/embed/${id}?${playerParams.toString()}`,
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
    isExpanded?: boolean;
    onToggle?: () => void;
}

export function ExerciseMedia({
    title,
    videoUrl,
}: ExerciseMediaProps) {
    const source = useMemo(() => videoUrl ? resolveVideoSource(videoUrl) : null, [videoUrl]);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [hasLegacySideBars, setHasLegacySideBars] = useState(false);

    useEffect(() => {
        if (!source || source.kind !== 'file' || !videoRef.current) return;

        const video = videoRef.current;
        video.defaultPlaybackRate = 0.65;
        video.playbackRate = 0.65;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    void video.play().catch(() => {
                        video.pause();
                    });
                    return;
                }

                video.pause();
            },
            { threshold: 0.15 }
        );

        observer.observe(video);
        return () => observer.disconnect();
    }, [source]);

    const prepareHostedVideo = () => {
        const video = videoRef.current;
        if (!video) return;

        // Earlier 16:9 exports contain a square exercise frame centered between
        // baked-in side bars. Crop those exports at playback time while leaving
        // the newer square, edge-to-edge videos untouched.
        setHasLegacySideBars(video.videoWidth / video.videoHeight > 1.2);
        video.defaultPlaybackRate = 0.65;
        video.playbackRate = 0.65;
    };

    const startHostedVideo = () => {
        const video = videoRef.current;
        if (!video) return;

        video.defaultPlaybackRate = 0.65;
        video.playbackRate = 0.65;
        void video.play().catch(() => {
            // Native controls remain available if a browser blocks autoplay.
        });
    };

    return (
        <div className="relative overflow-hidden rounded-[24px] bg-[#0B1220] shadow-[0_14px_34px_rgba(11,18,32,0.16)]">
            {source && (source.kind === 'youtube' || source.kind === 'vimeo') ? (
                <iframe
                    className="aspect-video w-full"
                    src={source.embedUrl}
                    title={`${title} demo`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            ) : source && source.kind === 'file' ? (
                <div className="aspect-square w-full overflow-hidden bg-[#F4EFE8]">
                    <video
                        ref={videoRef}
                        className={`h-full w-full object-cover ${hasLegacySideBars ? 'scale-[1.67]' : ''}`}
                        muted
                        controls
                        loop
                        playsInline
                        preload="auto"
                        autoPlay
                        src={source.src}
                        poster={source.posterUrl}
                        onLoadedMetadata={prepareHostedVideo}
                        onLoadedData={startHostedVideo}
                        onCanPlay={startHostedVideo}
                        aria-label={`${title} exercise demo`}
                    />
                </div>
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

            {source?.kind === 'external' ? (
                <div className="absolute inset-x-0 bottom-0 p-3">
                    <a
                        href={source.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0B1220] transition hover:bg-[#E8FBF8]"
                    >
                        Open demo
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
            ) : null}
        </div>
    );
}
