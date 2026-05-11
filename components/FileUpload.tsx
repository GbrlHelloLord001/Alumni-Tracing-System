
import React, { useState, useRef } from 'react';
import { Upload, FileText, Camera, File } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  label?: string;
  acceptCamera?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  isLoading, 
  label = "Upload Document",
  acceptCamera = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type (PDF or Image)
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (validTypes.includes(file.type)) {
      setFileName(file.name);
      onFileSelect(file);
    } else {
      alert("Please upload a PDF or Image file.");
    }
  };

  const triggerInput = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full mb-2">
      <div 
        className={`relative w-full h-44 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group border-2 border-dashed
          ${dragActive 
            ? 'border-luGreen bg-green-50 scale-[1.02] shadow-lg' 
            : 'border-gray-200 bg-gray-50/50 hover:bg-white hover:border-luGreen/50'
          }
          ${fileName ? 'bg-green-50/30 border-luGreen' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
      >
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          accept={acceptCamera ? "image/*" : ".pdf,.jpg,.jpeg,.png"}
          onChange={handleChange}
          disabled={isLoading}
        />

        {fileName ? (
          <div className="flex flex-col items-center animate-fade-in p-4 z-10">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3 shadow-sm">
                <FileText className="w-7 h-7 text-luGreen" />
            </div>
            <p className="text-sm font-bold text-gray-800 text-center px-4 truncate max-w-[200px]">{fileName}</p>
            <p className="text-xs text-luGreen font-medium mt-1 hover:underline">Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-4 z-10 transition-transform duration-300 group-hover:-translate-y-1">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors duration-300 ${dragActive ? 'bg-white shadow-md' : 'bg-gray-200 group-hover:bg-green-100'}`}>
                {acceptCamera ? (
                   <Camera className={`w-6 h-6 ${dragActive ? 'text-luGreen animate-bounce' : 'text-gray-500 group-hover:text-luGreen'}`} />
                ) : (
                   <Upload className={`w-6 h-6 ${dragActive ? 'text-luGreen animate-bounce' : 'text-gray-500 group-hover:text-luGreen'}`} />
                )}
            </div>
            <p className="text-sm font-bold text-gray-700">
              {label}
            </p>
            <p className="text-xs text-gray-400 mt-1 font-medium">
              {acceptCamera ? 'Take a photo or upload image' : 'Drag & Drop PDF/Image'}
            </p>
          </div>
        )}

        {/* Animated Background Pulse for Drag State */}
        {dragActive && (
            <div className="absolute inset-0 z-0 bg-green-400/10 animate-pulse"></div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="relative w-12 h-12">
                 <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-luGreen border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-xs font-bold text-luGreen mt-3 uppercase tracking-wider animate-pulse">Analyzing...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
