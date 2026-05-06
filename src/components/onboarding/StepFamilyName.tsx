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
  const createFamily                  = useFamilyStore(s => s.createFamily)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familyName.trim() || !displayName.trim()) return
    setLoading(true)
    const err = await createFamily(familyName.trim(), displayName.trim(), userId)
    setLoading(false)
    if (err) return setError(err)
    onCreated()
  }

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
          />
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !familyName.trim() || !displayName.trim()}
        >
          {loading ? 'Creando...' : 'Continuar →'}
        </button>
      </form>
    </div>
  )
}
