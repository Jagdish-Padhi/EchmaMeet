import { HeroBackdrop } from './HeroBackdrop';

interface LandingHeroProps {
  readonly onLaunchStudio: () => void;
}

export function LandingHero({ onLaunchStudio }: LandingHeroProps) {
  return (
    <section id="hero" className="landing-hero-cinematic">
      <HeroBackdrop />

      <div className="hero-center-content">
        <h1 className="hero-headline">
          <span className="hero-headline-primary">Review architecture with your team.</span>
          <br />
          <span className="hero-headline-secondary">
            And break it <span className="hero-headline-accent">before production does.</span>
          </span>
        </h1>

        <div className="hero-actions">
          <button type="button" className="btn btn-primary btn-hero" onClick={onLaunchStudio}>
            Start Live Review Room &rarr;
          </button>

          <a href="#meeting-room" className="btn btn-secondary btn-hero">
            See How Meetings Work
          </a>
        </div>
      </div>
    </section>
  );
}
