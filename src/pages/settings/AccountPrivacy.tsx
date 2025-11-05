import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Profile, Visibility } from '../../services/profileService'
import { changeMyPassword, getMyProfile, saveMyProfile } from '../../services/profileService'

function useDebounced<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function AccountPrivacy(){
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Password form
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdStatus, setPwdStatus] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load(){
      if (!user) return
      try {
        const p = await getMyProfile(user.id)
        if (mounted) setProfile(p)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo cargar el perfil'
        setError(msg)
      }
    }
    load()
    return () => { mounted = false }
  }, [user])

  // Auto-save: debounce profile
  const debouncedProfile = useDebounced(profile)
  useEffect(() => {
    if (!user || !debouncedProfile) return
    ;(async () => {
      setSaving(true)
      setError(null)
      try {
        const patch = {
          full_name: debouncedProfile.full_name ?? '',
          email: debouncedProfile.email ?? '',
          phone: debouncedProfile.phone ?? '',
          address: debouncedProfile.address ?? '',
          name_visibility: debouncedProfile.name_visibility,
          email_visibility: debouncedProfile.email_visibility,
          phone_visibility: debouncedProfile.phone_visibility,
          address_visibility: debouncedProfile.address_visibility,
        }
        const saved = await saveMyProfile(user.id, patch)
        setProfile(saved)
        setSavedAt(Date.now())
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo guardar'
        setError(msg)
      } finally {
        setSaving(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedProfile?.full_name, debouncedProfile?.email, debouncedProfile?.phone, debouncedProfile?.address, debouncedProfile?.name_visibility, debouncedProfile?.email_visibility, debouncedProfile?.phone_visibility, debouncedProfile?.address_visibility])

  const savedLabel = useMemo(() => {
    if (saving) return 'Guardando...'
    if (savedAt) return 'Guardado'
    return ''
  }, [saving, savedAt])

  const onChange = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    if (!profile) return
    setProfile({ ...profile, [key]: value })
  }

  const onChangePassword = async () => {
    setPwdStatus(null)
    if (!pwdNew || pwdNew.length < 6) {
      setPwdStatus('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (pwdNew !== pwdConfirm) {
      setPwdStatus('La confirmación no coincide')
      return
    }
    try {
      await changeMyPassword(pwdNew)
      setPwdStatus('Contraseña actualizada. Si la sesión expira, vuelve a iniciar sesión.')
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo cambiar la contraseña'
      setPwdStatus(msg)
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-bold text-green-700">Cuenta y privacidad</h1>

      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <section className="mt-4 rounded-lg border bg-white p-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Perfil</h2>
          {!!savedLabel && <span className="text-sm text-gray-600">{savedLabel}</span>}
        </header>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-600">Nombre</label>
            <input value={profile?.full_name ?? ''} onChange={(e)=> onChange('full_name', e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            <VisibilitySelect label="Visibilidad del nombre" value={profile?.name_visibility ?? 'contacts'} onChange={(v)=> onChange('name_visibility', v)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Correo</label>
            <input type="email" value={profile?.email ?? ''} onChange={(e)=> onChange('email', e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            <VisibilitySelect label="Visibilidad del correo" value={profile?.email_visibility ?? 'contacts'} onChange={(v)=> onChange('email_visibility', v)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Teléfono</label>
            <input value={profile?.phone ?? ''} onChange={(e)=> onChange('phone', e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            <VisibilitySelect label="Visibilidad del teléfono" value={profile?.phone_visibility ?? 'contacts'} onChange={(v)=> onChange('phone_visibility', v)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600">Dirección</label>
            <textarea value={profile?.address ?? ''} onChange={(e)=> onChange('address', e.target.value)} className="mt-1 w-full rounded border px-3 py-2" rows={3} />
            <VisibilitySelect label="Visibilidad de la dirección" value={profile?.address_visibility ?? 'private'} onChange={(v)=> onChange('address_visibility', v)} />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">La dirección se cifra antes de guardarse.</p>
      </section>

      <section className="mt-4 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Seguridad</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-600">Contraseña actual</label>
            <input type="password" value={pwdCurrent} onChange={(e)=> setPwdCurrent(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Nueva contraseña</label>
            <input type="password" value={pwdNew} onChange={(e)=> setPwdNew(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Confirmar nueva contraseña</label>
            <input type="password" value={pwdConfirm} onChange={(e)=> setPwdConfirm(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={onChangePassword} className="rounded-md border border-green-600 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-600 hover:text-white">Cambiar contraseña</button>
          {pwdStatus && <span className="text-sm text-gray-600">{pwdStatus}</span>}
        </div>
      </section>
    </main>
  )
}

function VisibilitySelect({ label, value, onChange }: { label: string; value: Visibility; onChange: (v: Visibility)=>void }){
  return (
    <div className="mt-2">
      <label className="block text-xs text-gray-500">{label}</label>
      <select value={value} onChange={(e)=> onChange(e.target.value as Visibility)} className="mt-1 rounded border px-2 py-1 text-sm">
        <option value="public">Público</option>
        <option value="contacts">Contactos</option>
        <option value="private">Privado</option>
      </select>
    </div>
  )
}
