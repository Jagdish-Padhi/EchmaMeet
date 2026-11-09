import { useState } from 'react';
import { createPortal } from 'react-dom';
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

  const modalElement = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="import-diagram-modal-card"
        style={{ width: 720 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="iac-export-title"
      >
        <div className="import-modal-header">
          <div className="import-modal-title" id="iac-export-title">
            Export Infrastructure-as-Code Manifest
          </div>
          <button
            type="button"
            className="import-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="import-editor-body" style={{ maxHeight: '65vh' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`import-template-tab ${format === 'istio' ? 'active' : ''}`}
                onClick={() => setFormat('istio')}
              >
                Istio CRD
              </button>
              <button
                type="button"
                className={`import-template-tab ${format === 'k8s' ? 'active' : ''}`}
                onClick={() => setFormat('k8s')}
              >
                Envoy Mesh
              </button>
            </div>
            <button type="button" className="import-action-btn" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy YAML'}
            </button>
          </div>

          <pre className="iac-manifest-code">
            {manifestYaml}
          </pre>
        </div>

        <div className="import-modal-footer">
          <div />
          <div className="import-footer-buttons">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownload}>
              Download YAML
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
}
