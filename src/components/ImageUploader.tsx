import { useRef, useState } from 'react'

export type ImageUploaderProps = {
  label?: string
  multiple?: boolean
  onChange: (files: File[]) => void
  initialUrls?: string[]
}

export default function ImageUploader({ label = 'Imágenes del producto', multiple = true, onChange, initialUrls = [] }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [previews, setPreviews] = useState<string[]>(initialUrls)

  function handleFiles(filesList: FileList | null) {
    if (!filesList) return
    const files = Array.from(filesList)
    onChange(files)
    const localPreviews = files.map((f) => URL.createObjectURL(f))
    setPreviews(localPreviews)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-2 flex flex-col items-start gap-3">
        <div className="flex flex-wrap gap-3">
          {previews.map((src, idx) => (
            <img key={idx} src={src} alt={`preview-${idx}`} className="h-20 w-20 rounded-lg border object-cover shadow-sm" />
          ))}
          {previews.length === 0 && (
            <div className="text-sm text-gray-500">No has seleccionado imágenes.</div>
          )}
        </div>
        <div>
          <input ref={inputRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow active:translate-y-0"
          >
            Seleccionar imágenes
          </button>
        </div>
      </div>
    </div>
  )
}
