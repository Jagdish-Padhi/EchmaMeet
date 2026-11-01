export function ReviewRoomSection() {
  return (
    <section id="meeting-room" className="landing-section">
      <div className="section-header">
        <span className="section-eyebrow">THE REAL-TIME REVIEW ROOM</span>
        <h2 className="section-title">Google Meet Built Inside an Architecture Canvas</h2>
        <p className="section-desc">
          Stop screen-sharing static diagrams while arguing theoretically. EchmaMeet brings your
          entire engineering team into one shared room with voice, live cursors, and interactive
          failure injection.
        </p>
      </div>

      <div className="steps-pipeline-grid">
        <div className="step-card">
          <div className="step-badge">INTEGRATED AUDIO</div>
          <div className="step-icon-wrap">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h3 className="step-title">Push-to-Talk Team Voice</h3>
          <p className="step-desc">
            Jump into the room with zero Zoom or Meet links. Talk naturally with low-latency audio
            while pointing at nodes and discussing connection limits together.
          </p>
          <div className="step-tags">
            <span>Instant Room Voice</span>
            <span>Multiplayer Cursors</span>
            <span>Zero Installs</span>
          </div>
        </div>

        <div className="step-card">
          <div className="step-badge">SHARED CHAOS DIAL</div>
          <div className="step-icon-wrap">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3 className="step-title">Simulate Failures Live in the Call</h3>
          <p className="step-desc">
            When an engineer asks &quot;What happens if Redis latency spikes?&quot;, turn the slider
            live in the meeting. Everyone sees the p99 latency curve jump and requests fail in real
            time.
          </p>
          <div className="step-tags">
            <span>Packet Delay Chaos</span>
            <span>Toxiproxy Backing</span>
            <span>Deterministic Trials</span>
          </div>
        </div>

        <div className="step-card">
          <div className="step-badge">SHARED CONSENSUS</div>
          <div className="step-icon-wrap">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3 className="step-title">End the Call with Ready-to-Merge IaC</h3>
          <p className="step-desc">
            Don&apos;t leave with &quot;action items to follow up.&quot; EchmaMeet exports the agreed,
            empirically proven topology straight into Terraform and Envoy configuration files.
          </p>
          <div className="step-tags">
            <span>Production Terraform</span>
            <span>Envoy YAML</span>
            <span>Docker Compose</span>
          </div>
        </div>
      </div>
    </section>
  );
}
