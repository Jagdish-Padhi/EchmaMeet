export interface FemaleArchitectIconProps {
  readonly size?: number | string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly className?: string;
  readonly strokeWidth?: number;
}

/**
 * Elegant female side-view profile icon with gentle wave hair and headset/earpiece,
 * representing Echma as a distinguished female Principal SRE.
 */
export function FemaleArchitectIcon({
  size = 18,
  width,
  height,
  className = '',
  strokeWidth = 1.8,
}: FemaleArchitectIconProps) {
  const w = width ?? size;
  const h = height ?? size;

  return (
    <svg
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Delicate side profile face line: forehead -> nose bridge -> tip -> lip -> chin -> jaw */}
      <path d="M12 4.5c-2.5 0-4.8 1.6-5.3 4.1-.3 1.3-.1 2.6.2 3.8.3 1.2 1.4 1.4 1.4 2.5 0 .8-.5 1.5-.7 2.2-.3 1.1.2 2.2 1.2 2.7 1.2.6 2.7.7 4 .3 1.8-.6 3.2-2.1 3.2-4.1 0-.6-.1-1.2-.3-1.8" />
      {/* Elegant side-swept hair flowing back */}
      <path d="M11.5 4.5c2.8 0 5.5 1.8 6.2 4.6.8 3.2-.2 6.6-2.5 8.9-1.3 1.3-3.2 2-5 2" />
      <path d="M13.5 7c2 1 3.5 2.8 3.5 5.2 0 1.8-.8 3.4-2 4.3" />
      {/* Sleek architectural headset earpiece */}
      <circle cx="12" cy="12.5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 14.1v1.6c0 .8.6 1.4 1.4 1.4h.8" />
    </svg>
  );
}
