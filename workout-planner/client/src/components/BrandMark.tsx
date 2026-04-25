import clsx from 'clsx';

export function BrandMark({
    size = 'md',
    className,
}: {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const sizeClasses = size === 'sm'
        ? 'h-11 w-11'
        : size === 'lg'
            ? 'h-20 w-20'
            : 'h-14 w-14';

    return (
        <div
            className={clsx(
                'relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#0B1220_0%,#10243B_60%,#18BDB2_130%)] shadow-[0_18px_36px_rgba(11,18,32,0.22)]',
                sizeClasses,
                className
            )}
        >
            <div className="absolute inset-[18%] rounded-[18px] border border-white/28 bg-white/16 backdrop-blur-sm" />
            <div className="absolute left-[24%] top-[28%] h-[12%] w-[52%] rounded-full bg-white/90" />
            <div className="absolute left-[24%] top-[48%] h-[12%] w-[36%] rounded-full bg-white/72" />
            <div className="absolute right-[24%] top-[48%] h-[12%] w-[12%] rounded-full bg-white" />
        </div>
    );
}
