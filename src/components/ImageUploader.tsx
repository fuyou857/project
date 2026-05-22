import { useState, useRef, type ChangeEvent } from 'react';
import { FaUpload, FaTimes } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { useApp } from '../stores';

interface Attachment {
  id: string;
  url: string;
  name: string;
  size: number;
}

interface ImageUploaderProps {
  value: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
}

export default function ImageUploader({
  value,
  onChange,
  maxFiles = 5,
  maxSizeMB = 10,
  accept = 'image/jpeg,image/jpg,image/png,image/gif',
  disabled = false,
}: ImageUploaderProps) {
  const { currentCompany } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const allowedTypes = accept.split(',');
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `文件大小不能超过${maxSizeMB}MB`;
    }
    if (!allowedTypes.includes(file.type)) {
      return '仅支持 jpg, jpeg, png, gif 格式';
    }
    return null;
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (value.length + files.length > maxFiles) {
      alert(`最多只能上传${maxFiles}张图片`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const newAttachments: Attachment[] = [...value];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const error = validateFile(file);
        if (error) {
          alert(error);
          continue;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        await new Promise<void>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              const ext = file.name.split('.').pop() || 'jpg';
              const path = `${currentCompany?.id || 'common'}/task_progress/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
              
              const { error: uploadError } = await supabase.storage
                .from('files')
                .upload(path, Uint8Array.from(atob(base64), c => c.charCodeAt(0)), {
                  contentType: file.type,
                });

              if (uploadError) throw uploadError;

              const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);

              newAttachments.push({
                id: Math.random().toString(36).substr(2, 9),
                url: publicUrl,
                name: file.name,
                size: file.size,
              });

              setUploadProgress(Math.round(((i + 1) / files.length) * 100));
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
        });
      }

      onChange(newAttachments);
    } catch (err: unknown) {
      alert('上传失败：' + (err instanceof Error ? err.message : ''));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) {
      alert('请上传图片文件');
      return;
    }

    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const synthetic = {
      target: { files: dt.files },
    } as ChangeEvent<HTMLInputElement>;
    await handleFileSelect(synthetic);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeAttachment = (id: string) => {
    onChange(value.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : 'bg-gray-50 border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
        }`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          disabled={disabled || value.length >= maxFiles}
          className="hidden"
        />
        
        {uploading ? (
          <div className="space-y-2">
            <FaUpload className="mx-auto h-8 w-8 text-blue-500 animate-pulse" />
            <p className="text-sm text-gray-600">上传中 {uploadProgress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <FaUpload className="mx-auto h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              点击上传或拖拽图片到此处
            </p>
            <p className="text-xs text-gray-400">
              支持 jpg, png, gif 格式，单张不超过{maxSizeMB}MB，最多{maxFiles}张
            </p>
            <p className="text-xs text-gray-400">
              已上传 {value.length}/{maxFiles}
            </p>
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map((attachment) => (
            <div key={attachment.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttachment(attachment.id);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <FaTimes className="h-3 w-3" />
                </button>
              )}
              <p className="mt-1 text-xs text-gray-500 truncate" title={attachment.name}>
                {attachment.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
