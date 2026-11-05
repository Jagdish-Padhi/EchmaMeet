import { useState } from 'react';
import type { Topology } from '@chaosboard/contracts';
import { generateIstioResilienceManifest, generateEnvoyMeshManifest } from '../utils/iac-generator';

export interface IacExportModalProps {
  readonly isOpen: boolean;
  readonly topology: Topology;
  readonly onClose: () => void;
}

export function IacExportModal({ isOpen, topology, onClose }: IacExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'istio' | 'k8s'>('istio');

  if (!isOpen) return null;

  const manifestYaml =
    format === 'istio'
      ? generateIstioResilienceManifest(topology)
      : generateEnvoyMeshManifest(topology);

  const handleCopy = () => {
    void navigator.clipboard.writeText(manifestYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFileName = format === 'istio' ? 'istio-resilience.yaml' : 'envoy-mesh.yaml';

  const handleDownload = () => {
    const blob = new Blob([manifestYaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="sre-yield-modal-card"
        style={{ width: 720 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="iac-export-title"
      >
        <div className="sre-modal-header">
          <div className="sre-agent-identity">
            <div
              className="sre-agent-emblem"
              style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8' }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div className="sre-agent-name" id="iac-export-title">
                Export Infrastructure-as-Code Manifest
              </div>
              <div className="sre-agent-subtitle">
                Production-Ready Istio VirtualService & DestinationRule YAML
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-drawer"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="sre-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`studio-action-pill ${format === 'istio' ? 'active' : ''}`}
                onClick={() => setFormat('istio')}
              >
                Istio CRD
              </button>
              <button
                type="button"
                className={`studio-action-pill ${format === 'k8s' ? 'active' : ''}`}
                onClick={() => setFormat('k8s')}
              >
                Envoy Mesh
              </button>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {copied ? 'Copied to Clipboard!' : 'Copy YAML'}
            </button>
          </div>

          <pre
            style={{
              background: '#030712',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.5,
              color: '#38bdf8',
              overflowX: 'auto',
              whiteSpace: 'pre',
            }}
          >
            {manifestYaml}
          </pre>
        </div>

        <div className="sre-modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownload}>
            Download YAML
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy Manifest'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
