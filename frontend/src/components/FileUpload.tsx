'use client';

import { useCallback, useState, useEffect } from 'react';
import { Upload, Check, X } from 'lucide-react';
import { previewFile, PreviewResponse } from '@/lib/api';

interface FileUploadProps {
  onFileSelect: (file: File, delimiter: string, trimZeros: boolean) => void;
  isLoading?: boolean;
}

const DELIMITERS = [
  { label: 'Semicolon (;)', value: ';' },
  { label: 'Comma (,)', value: ',' },
  { label: 'Tab', value: '\t' },
];

export default function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const [delimiter, setDelimiter] = useState(';');
  const [trimZeros, setTrimZeros] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadPreview = useCallback(async (file: File, delim: string, trim: boolean) => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await previewFile(file, delim, trim);
      setPreview(result);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFile) {
      loadPreview(selectedFile, delimiter, trimZeros);
    }
  }, [selectedFile, delimiter, trimZeros, loadPreview]);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith('.csv')) {
        handleFileSelected(file);
      }
    },
    [handleFileSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected]
  );

  const handleConfirm = useCallback(() => {
    if (selectedFile) onFileSelect(selectedFile, delimiter, trimZeros);
  }, [selectedFile, onFileSelect, delimiter, trimZeros]);

  const handleCancel = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setPreviewError(null);
  }, []);

  if (selectedFile && (preview || previewLoading || previewError)) {
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Preview: {selectedFile.name}</h3>
            <button onClick={handleCancel} className="text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Delimiter:</span>
              <div className="flex gap-1">
                {DELIMITERS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDelimiter(d.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                      delimiter === d.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-neutral-800 border border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-700'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trimZeros}
                onChange={(e) => setTrimZeros(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
              />
              <span className="text-sm text-neutral-400">Trim Zeros</span>
            </label>
          </div>

          {previewLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500/30 border-t-primary-500"></div>
            </div>
          )}

          {previewError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
              {previewError}
            </div>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-neutral-800/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-white">{preview.total_rows}</div>
                  <div className="text-xs text-neutral-400">Total Rows</div>
                </div>
                <div className="bg-neutral-800/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-white">{preview.total_columns}</div>
                  <div className="text-xs text-neutral-400">Columns</div>
                </div>
                <div className="bg-neutral-800/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-white">{preview.rows_after_trim}</div>
                  <div className="text-xs text-neutral-400">Rows after Trim</div>
                </div>
              </div>

              {(preview.zero_rows_start > 0 || preview.zero_rows_end > 0) && (
                <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs mb-4">
                  {preview.zero_rows_start > 0 && <span>{preview.zero_rows_start} zero rows at start. </span>}
                  {preview.zero_rows_end > 0 && <span>{preview.zero_rows_end} zero rows at end.</span>}
                  {!trimZeros && <span className="ml-1 text-yellow-300">Enable &quot;Trim Zeros&quot; to remove them.</span>}
                </div>
              )}

              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-white/10">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-900">
                    <tr className="text-neutral-400 border-b border-white/10">
                      <th className="px-2 py-1.5 text-left">#</th>
                      {Array.from({ length: preview.total_columns }, (_, i) => (
                        <th key={i} className="px-2 py-1.5 text-right">Col {i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, ri) => (
                      <tr key={ri} className="text-neutral-300 border-b border-white/5 hover:bg-white/5">
                        <td className="px-2 py-1 text-neutral-500">{ri + 1}</td>
                        {row.map((val, ci) => (
                          <td key={ci} className={`px-2 py-1 text-right ${val === 0 ? 'text-neutral-600' : ''}`}>
                            {val.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows_after_trim > preview.preview.length && (
                <p className="text-xs text-neutral-500 mt-1 text-center">
                  Showing first {preview.preview.length} of {preview.rows_after_trim} rows
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm rounded-lg bg-neutral-800 border border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !preview}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-primary-600 to-emerald-600 text-white hover:from-primary-500 hover:to-emerald-500 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isLoading ? 'Uploading...' : 'Confirm Upload'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="card p-12 text-center cursor-pointer border-2 border-dashed border-white/20 hover:border-primary-500/50 transition-all duration-300"
      >
        <input
          type="file"
          accept=".csv,.CSV"
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
            Drop CSV file here or click to upload
          </p>
          <p className="text-sm text-neutral-400 mt-2">Supports CSV files with ; , and TAB delimiters</p>
        </label>
      </div>

      <div className="card p-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Delimiter:</span>
          <div className="flex gap-1">
            {DELIMITERS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDelimiter(d.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  delimiter === d.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-800 border border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trimZeros}
            onChange={(e) => setTrimZeros(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
          />
          <span className="text-sm text-neutral-400">Trim Zeros</span>
        </label>
      </div>
    </div>
  );
}
