export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'How does the live review meeting work?',
    answer:
      'EchmaMeet combines high-fidelity architecture design with integrated team audio and multiplayer presence—like Google Meet built directly into a distributed systems whiteboard. Your team jumps on voice, inspects the topology together, and tests failure scenarios collaboratively with zero external meeting software required.',
  },
  {
    question: 'How does the AI SRE agent participate in the meeting?',
    answer:
      'The autonomous AI SRE agent acts like a principal reliability engineer sitting in your meeting room. It listens to the discussion context, continuously analyzes live telemetry and dependency graphs in the background, warns the team when someone proposes a risky retry or timeout policy, and drops mathematically verified circuit-breaker fixes directly onto the canvas.',
  },
  {
    question: 'Do we need Docker or heavy local infrastructure?',
    answer:
      'No. EchmaMeet runs completely inside your browser with lightweight background simulation daemons. You do not need to install local Docker containers, Minikube, or heavy cluster runtimes to test complex multi-service topologies.',
  },
  {
    question: 'Can we export our verified meeting designs straight to code?',
    answer:
      'Yes. Once your team and the AI agent agree on the resilient topology, you can export it in one click into production-ready HashiCorp Terraform modules, Envoy Proxy YAML, and Docker Compose files before ending the meeting.',
  },
  {
    question: 'Is our team discussion and architecture private and secure?',
    answer:
      'Yes. All audio streams, node configurations, and topology data are encrypted in transit with TLS 1.3 and at rest with AES-256. For organizations with strict compliance requirements, EchmaMeet can be deployed entirely inside your own private VPC or air-gapped on-premise infrastructure with SAML/SSO authentication.',
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
