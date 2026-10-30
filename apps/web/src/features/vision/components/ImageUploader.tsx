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
        border: '2px dashed #cbd5e1',
        borderRadius: 8,
        padding: '32px 16px',
        textAlign: 'center',
        background: '#f8fafc',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#475569' }}>
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
