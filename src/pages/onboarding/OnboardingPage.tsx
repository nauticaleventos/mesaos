import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useFamilyStore } from '../../store/familyStore'
import StepFamilyName from '../../components/onboarding/StepFamilyName'
import StepAddMemberSimple from '../../components/onboarding/StepAddMemberSimple'
import StepHabitos from '../../components/onboarding/StepHabitos'
import StepDone from '../../components/onboarding/StepDone'

type Step = 'family' | 'members' | 'habitos' | 'done'

export default function OnboardingPage() {
  const [step, setStep]     = useState<Step>('family')
  const { user }            = useAuthStore()
  const { family, members } = useFamilyStore()
  const navigate            = useNavigate()

  const handleFamilyCreated = () => setStep('members')
  const handleMemberAdded   = () => setStep('members') // queda en members para agregar más
  const handleFinish        = () => navigate('/')

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto flex flex-col gap-6">

      {/* Progreso */}
      <div className="flex items-center gap-2">
        <div className={`h-1 flex-1 rounded-full transition-all ${step !== 'family' ? 'bg-accent' : 'bg-border'}`} />
        <div className={`h-1 flex-1 rounded-full transition-all ${step === 'done' ? 'bg-accent' : 'bg-border'}`} />
      </div>

      {step === 'family' && (
        <StepFamilyName
          userId={user!.id}
          onCreated={handleFamilyCreated}
        />
      )}

      {step === 'members' && (
        <StepAddMemberSimple
          familyName={family?.name ?? ''}
          memberCount={members.length}
          onAdded={handleMemberAdded}
          onFinish={() => setStep('habitos')}
        />
      )}

      {step === 'habitos' && (
        <StepHabitos onContinue={() => setStep('done')} />
      )}

      {step === 'done' && (
        <StepDone onFinish={handleFinish} />
      )}
    </div>
  )
}
