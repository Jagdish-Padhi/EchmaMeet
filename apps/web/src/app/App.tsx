import { SystemStatus } from '../features/system-status';

export function App() {
  return (
    <main className="page">
      <header>
        <h1>ChaosBoard</h1>
        <p className="lede">
          Design-time chaos testing. Draw a system, break it on purpose, measure it, repair it.
        </p>
      </header>
      <SystemStatus />
    </main>
  );
}
