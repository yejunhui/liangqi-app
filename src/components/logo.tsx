import { cn } from "@/utils/cn";

export function Logo({ compact = false }: { compact?: boolean }) {
    return (
        <div className="flex items-center gap-2.5">
            <LogoMark />
            {!compact && (
                <span className="flex flex-col leading-none">
                    <span className="text-[17px] font-bold tracking-tight text-text">两讫</span>
                    <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-muted">
                        LIANGQI
                    </span>
                </span>
            )}
        </div>
    );
}

export function LogoMark({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl bg-[#1c1917] shadow-sm ring-1 ring-white/10",
                className,
            )}
        >
            <svg viewBox="0 0 64 64" className="size-6" fill="none" aria-hidden="true">
                <rect x="11" y="13" width="15" height="34" rx="7.5" fill="#5eead4" />
                <rect x="38" y="23" width="15" height="24" rx="7.5" fill="#fbbf24" />
                <path
                    d="M11 53h42"
                    stroke="#f7f2e8"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
            </svg>
        </span>
    );
}
