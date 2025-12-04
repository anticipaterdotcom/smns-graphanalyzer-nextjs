'use client';

import { useCallback } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export default function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="card p-12 text-center cursor-pointer border-2 border-dashed border-white/20 hover:border-primary-500/50 transition-all duration-300"
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
        id="file-upload"
        disabled={isLoading}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary-400" />
        </div>
        <p className="text-lg font-medium text-white">
          {isLoading ? 'Uploading...' : 'Drop CSV file here or click to upload'}
        </p>
        <p className="text-sm text-neutral-400 mt-2">Supports semicolon-delimited CSV files</p>
      </label>
    </div>
  );
}
