import type {
  ButtonHTMLAttributes,
  ComponentType,
  ReactNode,
  SVGProps,
} from "react";
import { ArrowRightIcon } from "../icons/ArrowRightIcon";

type ActionCardVariant = "primary" | "secondary";

interface ActionCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "title"
> {
  variant?: ActionCardVariant;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // 배지 아이콘 자리만 다른 걸(예: Lottie 애니메이션)로 바꾸고 싶을 때 사용. 없으면 icon을 그대로 렌더링.
  badgeIcon?: ReactNode;
  // 배경 장식 아이콘만 다른 걸로 바꾸고 싶을 때 사용. 없으면 icon을 그대로 렌더링.
  decorativeIcon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  subtitle: string;
  disabled?: boolean;
}

export function ActionCard({
  variant = "secondary",
  icon: Icon,
  badgeIcon,
  decorativeIcon: DecorativeIcon,
  title,
  subtitle,
  disabled,
  className = "",
  ...rest
}: ActionCardProps) {
  const isPrimary = variant === "primary" && !disabled;

  const containerClasses = isPrimary
    ? "bg-primary text-black border-2 border-primary"
    : "bg-white text-black border-2 border-disabled";

  const iconCircleClasses = isPrimary
    ? "bg-white text-primary"
    : "bg-white text-tertiary-text";

  const arrowCircleClasses = "border border-disabled bg-white/75 text-black";

  const decorativeIconClasses =
    variant === "primary"
      ? "-right-5 bottom-12 w-96"
      : "-right-5 bottom-16 w-80";

  const BackgroundIcon = DecorativeIcon ?? Icon;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={`relative flex min-h-120 w-full flex-col items-start justify-center gap-6 overflow-hidden rounded-3xl px-16 py-12 text-left shadow-xl transition-colors ${containerClasses} ${disabled ? "cursor-not-allowed opacity-60" : "active:brightness-95"} ${className}`}
      {...rest}
    >
      <BackgroundIcon
        className={`pointer-events-none absolute rotate-12 opacity-15 ${decorativeIconClasses} ${isPrimary ? "text-white" : "text-tertiary-text"}`}
      />

      <span
        className={`border-disabled relative z-10 flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border ${iconCircleClasses}`}
      >
        {badgeIcon ?? <Icon className="h-14 w-14" />}
      </span>

      <span className="relative z-10 flex flex-col gap-3">
        <span className="text-5xl font-bold tracking-[0.4em]">{title}</span>
        <span className={`text-tertiary-text text-2xl font-medium`}>
          {subtitle}
        </span>
      </span>

      <span
        className={`absolute right-8 bottom-8 z-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-full ${arrowCircleClasses}`}
      >
        <ArrowRightIcon className="h-10 w-10" />
      </span>
    </button>
  );
}
