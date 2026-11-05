import { memo, useId } from 'react';

export interface EchmaLogoProps {
  readonly size?: number | string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly className?: string;
  readonly useGradient?: boolean;
  readonly ariaLabel?: string;
}

/**
 * EchmaMeet Brand Logo
 *
 * Dynamic enterprise SVG logo featuring the upper echo acoustic stroke
 * and lower continuous E ribbon with theme-aware gradient fills.
 */
export const EchmaLogo = memo(function EchmaLogo({
  size = 32,
  width,
  height,
  className = '',
  useGradient = true,
  ariaLabel = 'EchmaMeet Logo',
}: EchmaLogoProps) {
  const reactId = useId();
  const gradientId = `echma-logo-grad-${reactId.replace(/[^a-zA-Z0-9-_]/g, '')}`;

  const renderWidth = width ?? size;
  const renderHeight = height ?? size;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="18 16 92 89"
      width={renderWidth}
      height={renderHeight}
      fill="none"
      className={`echma-brand-logo ${className}`.trim()}
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {useGradient && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--echma-logo-grad-start, #38bdf8)" />
            <stop offset="100%" stopColor="var(--echma-logo-grad-end, #0082fb)" />
          </linearGradient>
        </defs>
      )}

      <g fill={useGradient ? `url(#${gradientId})` : 'currentColor'}>
        {/* Upper echo stroke */}
        <path
          d="
            M20 70
            V51
            C20 31.67 33.67 18 53 18
            H108
            C105.3 26.2 100.3 32 91.5 32
            H54
            C44.8 32 38.8 36.1 33 43.5
            L20 60
            Z
          "
        />

        {/* Lower continuous E ribbon */}
        <path
          d="
            M20 77
            L41 51
            C45.5 45.5 51 43 59 43
            H103
            L96 54
            C93.8 57.5 90.5 59 85.5 59
            H60
            C55.5 59 52.5 60.7 52.5 64
            C52.5 67.3 55.5 69 60 69
            H108
            C105.5 89 92.5 103 72 103
            H48
            C30.5 103 20 92.5 20 77
            Z
          "
        />
      </g>
    </svg>
  );
});
