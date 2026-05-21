'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import api from '@/lib/api'

interface ImageUploadProps {
  onUpload: (urls: string[]) => void
  maxSize?: number // in bytes, default 5MB
  accept?: string
  multiple?: boolean
  maxFiles?: number
  className?: string
  disabled?: boolean
}

interface UploadingFile {
  id: string
  file: File
  progress: number
  url?: string
  error?: string
}

export function ImageUpload({
  onUpload,
  maxSize = 5 * 1024 * 1024,
  accept = 'image/*',
  multiple = false,
  maxFiles = 5,
  className,
  disabled,
}: ImageUploadProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const generateId = () => Math.random().toString(36).slice(2, 9)

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Only image files are allowed'
    }
    if (file.size > maxSize) {
      return `File size must be less than ${formatBytes(maxSize)}`
    }
    return null
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getPresignedUrl = async (fileName: string, contentType: string) => {
    const res = await api.post('/admin/upload/presigned', {
      fileName,
      contentType,
    })
    return res.data as { presignedUrl: string; objectKey: string; publicUrl: string }
  }

  const uploadFile = async (uploadingFile: UploadingFile) => {
    try {
      setFiles((prev) =>
        prev.map((f) => (f.id === uploadingFile.id ? { ...f, progress: 10 } : f))
      )

      const { presignedUrl, publicUrl } = await getPresignedUrl(
        uploadingFile.file.name,
        uploadingFile.file.type
      )

      setFiles((prev) =>
        prev.map((f) => (f.id === uploadingFile.id ? { ...f, progress: 40 } : f))
      )

      await fetch(presignedUrl, {
        method: 'PUT',
        body: uploadingFile.file,
        headers: { 'Content-Type': uploadingFile.file.type },
      })

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id ? { ...f, progress: 100, url: publicUrl } : f
        )
      )

      return publicUrl
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setFiles((prev) =>
        prev.map((f) => (f.id === uploadingFile.id ? { ...f, error: message } : f))
      )
      throw err
    }
  }

  const handleFiles = useCallback(
    async (newFiles: FileList | null) => {
      if (!newFiles || newFiles.length === 0) return

      const fileArray = Array.from(newFiles)

      if (!multiple && fileArray.length > 1) {
        toast.error('Only one file can be uploaded')
        return
      }

      const totalFiles = files.length + fileArray.length
      if (multiple && totalFiles > maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`)
        return
      }

      const validFiles: UploadingFile[] = []

      for (const file of fileArray) {
        const error = validateFile(file)
        if (error) {
          toast.error(`${file.name}: ${error}`)
          continue
        }
        validFiles.push({ id: generateId(), file, progress: 0 })
      }

      if (validFiles.length === 0) return

      setFiles((prev) => (multiple ? [...prev, ...validFiles] : validFiles))

      const uploadedUrls: string[] = []

      for (const uploadingFile of validFiles) {
        try {
          const url = await uploadFile(uploadingFile)
          uploadedUrls.push(url)
        } catch {
          // Error already handled in uploadFile
        }
      }

      if (uploadedUrls.length > 0) {
        const allUrls = multiple
          ? [...files.filter((f) => f.url).map((f) => f.url!), ...uploadedUrls]
          : uploadedUrls
        onUpload(allUrls)
      }
    },
    [files, multiple, maxFiles, maxSize, onUpload]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleRemove = (id: string) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id)
      const urls = updated.filter((f) => f.url).map((f) => f.url!)
      onUpload(urls)
      return updated
    })
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onClick={disabled ? undefined : handleClick}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Upload className="size-5 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {accept === 'image/*' ? 'Images' : accept} up to {formatBytes(maxSize)}
            {multiple && ` (max ${maxFiles} files)`}
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-md border bg-background p-2 pr-3"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted overflow-hidden">
                {file.url ? (
                  <img
                    src={file.url}
                    alt={file.file.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {file.error ? (
                    <p className="text-xs text-destructive">{file.error}</p>
                  ) : file.progress < 100 ? (
                    <>
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {file.progress}%
                      </span>
                      {file.progress < 100 && !file.error && (
                        <Loader2 className="size-3 animate-spin text-muted-foreground" />
                      )}
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--success)' }}>Uploaded</p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(file.id)}
                disabled={!file.url && !file.error}
                aria-label="Remove file"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
