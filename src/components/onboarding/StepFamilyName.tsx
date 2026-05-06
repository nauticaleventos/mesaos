import { useState } from 'react'
import { useFamilyStore } from '../../store/familyStore'

interface Props {
  userId: string
  onCreated: () => void
}

export default function StepFamilyName({ userId, onCreated }: Props) {
  const [familyName, setFamilyName]   = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [submitted, setSubmitted]     = useState(false)   // bloqueo extra anti-doble-click
  const createFamily                  = useFamilyStore(s => s.createFamily)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familyName.trim() || !displayName.trim()) return
    if (submitted) return                                  // ya se envió, ignorar
    setSubmitted(true)
    setLoading(true)
    setError(null)
    const err = await createFamily(familyName.trim(), displayName.trim(), userId)
    setLoading(false)
    if (err) {
      setSubmitted(false)                                  // solo resetear si hay error real
      return setError(err)
    }
    onCreated()
  }

  const canSubmit = !loading && !submitted && familyName.trim() && displayName.trim()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif text-text font-semibold">Hola 👋</h1>
        <p className="text-muted mt-1">Configuremos tu familia en dos preguntas.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="input-label">¿Cómo te llamás vos?</label>
          <input
            type="text"
            placeholder="Ej: Abel, Ale..."
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            autoFocus
            required
            disabled={loading}
          />
          <p className="text-muted text-xs mt-1">Tu nombre en la app.</p>
        </div>

        <div>
          <label className="input-label">¿Cómo se llama tu familia?</label>
          <input
            type="text"
            placeholder="Ej: Familia Brieva, Los García..."
            value={familyName}
            onChange={e => setFamilyName(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {loading ? 'Creando...' : 'Continuar →'}
        </button>
      </form>
    </div>
  )
}
