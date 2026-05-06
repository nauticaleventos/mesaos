interface Props { onFinish: () => void }

export default function StepDone({ onFinish }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 text-center pt-10">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="text-2xl font-serif text-text font-semibold">¡Familia lista!</h1>
        <p className="text-muted mt-2">Ya tienes todo configurado. Ahora puedes generar tu primer menú semanal.</p>
      </div>
      <button onClick={onFinish} className="btn-primary max-w-xs">
        Ir al inicio →
      </button>
    </div>
  )
}
