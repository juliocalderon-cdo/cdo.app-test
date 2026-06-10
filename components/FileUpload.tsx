import React, { useState, useCallback } from 'react';
import { UploadIcon, FileIcon } from './Icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        htmlFor="dropzone-file"
        className={`relative flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-lg cursor-pointer bg-zinc-800 transition-colors ${
          dragActive ? 'border-sky-500 bg-zinc-700' : 'border-zinc-600 hover:border-sky-500 hover:bg-zinc-700'
        }`}
      >
        <div className="absolute w-full h-full" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <svg className="w-12 h-12 mb-4 text-sky-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mb-2 text-base text-zinc-400">Analizando archivo...</p>
              <p className="text-sm text-zinc-400">El análisis con IA puede tardar unos segundos.</p>
            </div>
          ) : selectedFile ? (
            <>
              <FileIcon className="w-16 h-16 mb-3 text-zinc-500" />
              <p className="mb-2 text-base font-semibold text-zinc-300">{selectedFile.name}</p>
              <p className="text-sm text-zinc-400">Archivo seleccionado. ¡Listo para crear la tarea!</p>
            </>
          ) : (
            <>
              <UploadIcon className="w-16 h-16 mb-3 text-zinc-400" />
              <p className="mb-2 text-lg text-zinc-400">
                <span className="font-semibold">Click para subir</span> o arrastra y suelta
              </p>
              <p className="text-base text-zinc-400">Excel (.xlsx, .xls) o CSV (.csv)</p>
            </>
          )}
        </div>
        <input id="dropzone-file" type="file" className="hidden" onChange={handleChange} accept=".xlsx, .xls, .csv" disabled={isLoading} />
      </label>
    </div>
  );
};