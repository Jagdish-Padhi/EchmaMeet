export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'How does the live review meeting work?',
    answer:
      'EchmaMeet integrates distributed systems modeling with low-latency push-to-talk voice and multiplayer presence. Your team joins a shared room, reviews the topology together, and tests failure scenarios interactively with zero third-party meeting software.',
  },
  {
    question: 'How does the AI SRE agent participate in the meeting?',
    answer:
      'The autonomous AI SRE participates as a reliability specialist during your review. Powered by Gnani Prisma voice recognition, it follows the architectural discussion, analyzes topology dependency graphs, warns against risky retry configurations, and provides mathematically verified circuit breaker policies directly on canvas.',
  },
  {
    question: 'Do we need Docker or heavy local infrastructure?',
    answer:
      'No. EchmaMeet runs simulations in-browser with lightweight background daemons. You do not need local Docker containers, Minikube, or dedicated cluster infrastructure to test complex multi-service architectures.',
  },
  {
    question: 'Can we export our verified meeting designs straight to code?',
    answer:
      'Yes. Once your team approves the resilient architecture, you can export it in one click into production-ready HashiCorp Terraform modules, Envoy Proxy configurations, and Docker Compose manifests before ending the meeting.',
  },
  {
    question: 'Is our team discussion and architecture private and secure?',
    answer:
      'All audio streams, system topologies, and configuration data are encrypted in transit via TLS 1.3 and at rest with AES-256. EchmaMeet also supports self-hosted deployment inside your private VPC or on-premise infrastructure with SAML/SSO integration.',
  },
];

interface FaqSectionProps {
  readonly openFaqIndex: number | null;
  readonly onToggleFaq: (index: number) => void;
}

export function FaqSection({ openFaqIndex, onToggleFaq }: FaqSectionProps) {
  return (
    <section id="faq" className="landing-section">
      <div className="section-header">
        <span className="section-eyebrow">QUESTIONS &amp; ANSWERS</span>
        <h2 className="section-title">Frequently Asked Questions</h2>
        <p className="section-desc">
          Quick, straightforward answers about EchmaMeet&apos;s live review rooms and AI SRE
          copilot.
        </p>
      </div>

      <div className="faq-accordion-wrap">
        {FAQ_ITEMS.map((faq, index) => {
          const isOpen = openFaqIndex === index;
          return (
            <div
              key={faq.question}
              className={`faq-item ${isOpen ? 'open' : ''}`}
              onClick={() => onToggleFaq(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleFaq(index);
                }
              }}
              aria-expanded={isOpen}
            >
              <div className="faq-question-row">
                <div className="faq-question-text">
                  <h3 className="faq-title">{faq.question}</h3>
                </div>
                <span className="faq-toggle-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </div>
              <div className="faq-answer-collapse">
                <div className="faq-answer-content">
                  <p>{faq.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
