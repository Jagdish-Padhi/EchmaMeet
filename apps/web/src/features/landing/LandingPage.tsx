import { useCallback, useState } from 'react';
import type { ScenarioSpec } from '@chaosboard/contracts';
import { LandingHeader } from './components/LandingHeader';
import { LandingHero } from './components/LandingHero';
import { ReviewRoomSection } from './components/ReviewRoomSection';
import { AiSreSection } from './components/AiSreSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { ComparisonSection } from './components/ComparisonSection';
import { PricingSection } from './components/PricingSection';
import { FaqSection } from './components/FaqSection';
import { LandingFooter } from './components/LandingFooter';

export interface LandingPageProps {
  readonly onLaunchStudio: (scenarioId?: string) => void;
  readonly scenarios?: readonly ScenarioSpec[];
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly isAuthenticated?: boolean;
  readonly onOpenAuth?: (mode?: 'login' | 'signup') => void;
}

export function LandingPage({
  onLaunchStudio,
  theme,
  onToggleTheme,
  isAuthenticated = false,
  onOpenAuth,
}: LandingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  }, []);

  const handleAuthAction = useCallback(
    (mode: 'login' | 'signup') => {
      if (onOpenAuth) {
        onOpenAuth(mode);
      } else {
        onLaunchStudio();
      }
    },
    [onOpenAuth, onLaunchStudio],
  );

  return (
    <div className="landing-page-root">
      <div className="landing-ambient-glow" aria-hidden="true" />

      <LandingHeader
        isAuthenticated={isAuthenticated}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLaunchStudio={() => onLaunchStudio()}
        onAuthAction={handleAuthAction}
      />

      <LandingHero onLaunchStudio={() => onLaunchStudio()} />

      <ReviewRoomSection />

      <AiSreSection />

      <HowItWorksSection />

      <ComparisonSection />

      <PricingSection
        billingCycle={billingCycle}
        onBillingCycleChange={setBillingCycle}
        onAuthAction={handleAuthAction}
      />

      <FaqSection openFaqIndex={openFaqIndex} onToggleFaq={toggleFaq} />

      <LandingFooter onLaunchStudio={() => onLaunchStudio()} onAuthAction={handleAuthAction} />
    </div>
  );
}
