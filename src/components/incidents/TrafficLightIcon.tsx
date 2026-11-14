import { forwardRef, type SVGProps } from "react";

/** Traffic-light glyph drawn in the same 24px stroke style as lucide-react icons. */
export const TrafficLightIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement> & { size?: number | string }>(
  function TrafficLightIcon({ size = 24, strokeWidth = 2, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <rect x="7" y="2" width="10" height="20" rx="3" />
        <circle cx="12" cy="7" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="17" r="1.6" />
        <path d="M7 6H4.5M7 11H4.5M17 6h2.5M17 11h2.5" />
      </svg>
    );
  },
);
