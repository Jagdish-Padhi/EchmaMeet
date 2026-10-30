import React, { useRef } from 'react';
import { Button } from '../../../components/ui/Button';

export interface ImageUploaderProps {
  readonly onImageSelected: (file: File) => void;
  readonly isExtracting: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, isExtracting }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds maximum 10MB limit.');
        return;
      }
      onImageSelected(file);
    }
  };

  return (
    <div
      style={{
        border: '2px dashed rgba(56, 189, 248, 0.35)',
        borderRadius: 12,
        padding: '36px 20px',
        textAlign: 'center',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#38bdf8',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: 440 }}>
        Upload a photo or screenshot of a hand-drawn architecture diagram (PNG or JPEG, up to 10MB)
      </p>
      <Button
        variant="primary"
        onClick={() => fileInputRef.current?.click()}
        disabled={isExtracting}
      >
        {isExtracting ? 'Analyzing Image...' : 'Choose Image File'}
      </Button>
    </div>
  );
};
