import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import toast from 'react-hot-toast'

export default function UploadPage() {
  const navigate = useNavigate()
  const { addSignal } = useSignalStore()

  const [name, setName] = useState('')
  const [sampleRate, setSampleRate] = useState('1000')
  const [duration, setDuration] = useState('10')
  const [channels, setChannels] = useState('1')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['.csv', '.json', '.npy']
    const hasValidExtension = allowedTypes.some(ext => file.name.toLowerCase().endsWith(ext))
    if (!hasValidExtension) {
      return 'File must be CSV, JSON, or NPY format'
    }
    if (file.size > 100 * 1024 * 1024) {
      return 'File size must be less than 100MB'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast.error('Please select a file')
      return
    }

    const fileError = validateFile(file)
    if (fileError) {
      toast.error(fileError)
      return
    }

    if (!name || !sampleRate || !duration) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('sample_rate', sampleRate)
      formData.append('duration_seconds', duration)
      formData.append('channels', channels)
      if (description) formData.append('description', description)
      formData.append('file', file)

      const signal = await signalsApi.upload(formData)
      addSignal(signal)
      toast.success('Signal uploaded successfully!')
      navigate(`/signals/${signal.id}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Failed to upload signal')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="page-header">
        <h1 className="page-title">Upload Signal</h1>
        <p className="page-description">Upload a time-series signal file for analysis. Supported formats: CSV, JSON, NPY</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input type="file" id="file" onChange={handleFileChange} className="hidden" accept=".csv,.json,.npy" />
          <label htmlFor="file" className="cursor-pointer">
            <Upload className="mx-auto w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-1">Drop your signal file here or click to browse</p>
            <p className="text-sm text-gray-500">CSV, JSON, or NPY format (max 100MB)</p>
            {file && (
              <div className="mt-4 flex items-center justify-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900 truncate max-w-xs">{file.name}</span>
                <span className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}
          </label>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">Signal Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ECG Recording, Vibration Sensor Data"
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="sampleRate" className="label">Sample Rate (Hz) *</label>
            <input
              type="number"
              id="sampleRate"
              value={sampleRate}
              onChange={(e) => setSampleRate(e.target.value)}
              placeholder="1000"
              className="input"
              required
              min="1"
            />
          </div>
          <div>
            <label htmlFor="duration" className="label">Duration (seconds) *</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="10"
              className="input"
              required
              min="1"
            />
          </div>
          <div>
            <label htmlFor="channels" className="label">Channels</label>
            <input
              type="number"
              id="channels"
              value={channels}
              onChange={(e) => setChannels(e.target.value)}
              placeholder="1"
              className="input"
              min="1"
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of the signal..."
            className="input"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isUploading}>
            {isUploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Upload Signal</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}