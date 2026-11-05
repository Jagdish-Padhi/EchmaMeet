// Timer functions exist in both browsers and Node; declared here so the package needs no DOM or
// Node type libraries.
declare function setTimeout(fn: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;
