import { useState } from 'react'
import { useFamilyStore } from '../../store/familyStore'

interface Props {
  userId: string
  onCreated: () => void
}

export default function StepFamilyName({ userId, onCreated }: Props) {
  const [name, setName]   = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const createFamily = useFamilyStore(s => s.createFamily)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const err = await createFamily(name.trim(), userId)
    setLoading(false)
    if (err) return setError(err)
    onCreated()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif text-text font-semibold">Hola 👋</h1>
        <p className="text-muted mt-1">Primero, ¿cómo se llama tu familia?</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="input-label">Nombre de la familia</label>
          <input
            type="text"
            placeholder="Ej: Familia Brieva, Los García..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
          {loading ? 'Creando...' : 'Continuar →'}
        </button>
      </form>
    </div>
  )
}
