import React, { useRef, useState, useEffect } from 'react';
import { Icon } from '../common';
import { uploadFileWithProgress, getUploadStatus } from '../../services/adminApi';

type UploadMode = 'file' | 'url';

interface FileUploadProps {
    label: string;
    accept?: string;
    value?: string;
    onChange: (value: string, file?: File) => void;
    onDurationDetected?: (durationSeconds: number) => void;
    placeholder?: string;
    hint?: string;
    maxSizeMB?: number;
    showModeToggle?: boolean;
    defaultMode?: UploadMode;
}

const FileUpload: React.FC<FileUploadProps> = ({
    label,
    accept = '*/*',
    value = '',
    onChange,
    onDurationDetected,
    placeholder = 'Chọn file hoặc nhập URL',
    hint,
    maxSizeMB = 100,
    showModeToggle = true,
    defaultMode = 'url',
}) => {
    const [mode, setMode] = useState<UploadMode>(defaultMode);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [s3Available, setS3Available] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check if S3 is configured
    useEffect(() => {
        const checkS3Status = async () => {
            try {
                const status = await getUploadStatus();
                setS3Available(status.s3Configured);
            } catch {
                setS3Available(false);
            }
        };
        checkS3Status();
    }, []);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const validateFile = (file: File): boolean => {
        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) {
            setError(`File quá lớn. Tối đa ${maxSizeMB}MB`);
            return false;
        }
        setError(null);
        return true;
    };

    // Extract video duration from file
    const extractVideoDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('video/')) {
                resolve(0);
                return;
            }
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(Math.round(video.duration));
            };
            video.onerror = () => resolve(0);
            video.src = URL.createObjectURL(file);
        });
    };

    const handleFile = async (file: File) => {
        if (!validateFile(file)) return;

        // Check if S3 is available for upload
        if (!s3Available) {
            setError('Object Storage chưa được cấu hình. Vui lòng sử dụng URL.');
            setMode('url');
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            // Extract duration for video files
            if (file.type.startsWith('video/') && onDurationDetected) {
                const duration = await extractVideoDuration(file);
                if (duration > 0) {
                    onDurationDetected(duration);
                }
            }

            // Determine upload type based on accept prop
            const uploadType = accept.includes('video') ? 'video' : 'image';

            const result = await uploadFileWithProgress(file, uploadType, (percent) => {
                setUploadProgress(percent);
            });

            setUploadProgress(100);
            onChange(result.url, file);
        } catch (err: any) {
            console.error('Upload failed:', err);
            setError(err.message || 'Upload thất bại. Vui lòng thử lại.');
        } finally {
            setUploading(false);
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
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const clearFile = () => {
        onChange('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-secondary">{label}</label>
                {showModeToggle && (
                    <div className="flex items-center gap-1 bg-background-dark rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => s3Available && setMode('file')}
                            disabled={!s3Available}
                            title={!s3Available ? 'Object Storage chưa được cấu hình' : 'Upload file trực tiếp'}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!s3Available
                                ? 'text-gray-500 cursor-not-allowed'
                                : mode === 'file'
                                    ? 'bg-primary text-on-primary'
                                    : 'text-text-secondary hover:text-white'
                                }`}
                        >
                            Upload {!s3Available && '⚠️'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('url')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'url'
                                ? 'bg-primary text-on-primary'
                                : 'text-text-secondary hover:text-white'
                                }`}
                        >
                            URL
                        </button>
                    </div>
                )}
            </div>

            {mode === 'file' ? (
                <div
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragActive
                        ? 'border-primary bg-primary/10'
                        : 'border-border-color hover:border-primary/50'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={accept}
                        onChange={handleChange}
                        className="hidden"
                    />

                    {value ? (
                        <div className="flex items-center justify-center gap-4">
                            {accept.includes('image') && (
                                <img
                                    src={value}
                                    alt="Preview"
                                    className="w-20 h-20 object-cover rounded-lg"
                                />
                            )}
                            {accept.includes('video') && (
                                <video
                                    src={value}
                                    className="w-32 h-20 object-cover rounded-lg"
                                />
                            )}
                            <div className="flex flex-col items-start gap-2">
                                <p className="text-sm text-white truncate max-w-xs">
                                    File đã được chọn
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleButtonClick}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Thay đổi
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        className="text-xs text-red-400 hover:underline"
                                    >
                                        Xóa
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : uploading ? (
                        <div className="space-y-3">
                            <div className="animate-spin mx-auto w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                            <p className="text-sm text-text-secondary">
                                Đang upload... {uploadProgress}%
                            </p>
                            <div className="w-full h-2 bg-background-dark rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <Icon
                                name="cloud_upload"
                                className="text-4xl text-text-secondary mx-auto mb-3"
                            />
                            <p className="text-sm text-text-secondary mb-2">
                                Kéo thả file vào đây hoặc
                            </p>
                            <button
                                type="button"
                                onClick={handleButtonClick}
                                className="px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-lg hover:bg-primary-hover transition-colors"
                            >
                                Chọn File
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="relative">
                    <input
                        type="url"
                        value={value}
                        onChange={handleUrlChange}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                    />
                    <Icon
                        name="link"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
            {hint && !error && <p className="text-xs text-text-secondary">{hint}</p>}
        </div>
    );
};

export default FileUpload;
