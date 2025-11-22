import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Profile, Visibility } from '../../services/profileApi'
import { changeMyPassword, getMyProfile, saveMyProfile } from '../../services/profileApi'
import { DEPARTMENTS } from '../../services/locationService'
import { ValidatedInput } from '../../hooks/useValidation'
import { VALIDATION_RULES } from '../../utils/inputValidation'

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
  
  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [department, setDepartment] = useState<string>('')
  const [municipality, setMunicipality] = useState<string>('')

  // Password form
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdStatus, setPwdStatus] = useState<string | null>(null)
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load(){
      if (!user) return
      try {
        const p = await getMyProfile(user.id)
        const nameFallback = (p.full_name && p.full_name.trim() && p.full_name !== 'Usuario') ? p.full_name : (user.full_name || '')
        const patched = { ...p, full_name: nameFallback }
        if (mounted) setProfile(patched)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo cargar el perfil'
        setError(msg)
      }
    }
    load()
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    const deptName = department ? (DEPARTMENTS.find(d => d.id === department)?.name || '') : ''
    const composed = `${municipality || ''}${deptName ? ', ' + deptName : ''}`
    if (profile) setProfile({ ...profile, address: composed })
  }, [department, municipality])

  // Auto-save: debounce profile
  const debouncedProfile = useDebounced(profile)
  useEffect(() => {
    if (!user || !debouncedProfile) return
    ;(async () => {
      setSaving(true)
      setError(null)
      try {
        const patch = {
          full_name: (debouncedProfile.full_name ?? '').replace(/^\s+/, ''),
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

  const handleSave = async () => {
    if (!profile) return
    if (!user) { setError('Inicia sesión para guardar cambios'); return }
    setSaving(true)
    setError(null)
    try {
      const patch = {
        full_name: (profile.full_name ?? '').replace(/^\s+/, ''),
        address: profile.address ?? '',
        name_visibility: profile.name_visibility,
        email_visibility: profile.email_visibility,
        phone_visibility: profile.phone_visibility,
        address_visibility: profile.address_visibility,
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
  }

  const onChange = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    if (!profile) return
    setProfile({ ...profile, [key]: value })
  }

  

  const getLocation = async () => {
    try {
      setLocError(null); setLocLoading(true)
      if (!('geolocation' in navigator)) { setLocError('GPS no disponible'); setLocLoading(false); return }
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const { latitude, longitude } = pos.coords
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
            const data = await res.json()
            const addr = (data && data.display_name) ? data.display_name : `${latitude}, ${longitude}`
            onChange('address', addr)
            resolve()
          } catch (e) { setLocError('No se pudo obtener la dirección'); reject(e as Error) }
        }, (err) => { setLocError('Permiso de ubicación denegado'); reject(err) }, { enableHighAccuracy: true, timeout: 8000 })
      })
    } finally { setLocLoading(false) }
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
      await changeMyPassword(pwdNew, pwdCurrent)
      setPwdStatus('Contraseña actualizada. Si la sesión expira, vuelve a iniciar sesión.')
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo cambiar la contraseña'
      setPwdStatus(msg)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
        <div className="border-b border-gray-100 p-6 md:p-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-green-800">Cuenta y privacidad</h1>
            {error && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          </div>
          {!!savedLabel && <span className="text-sm text-gray-600">{savedLabel}</span>}
        </div>

        <section className="p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Perfil</h2>
          </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-600">Nombre</label>
            <ValidatedInput
              value={profile?.full_name ?? ''}
              onChange={(v)=> onChange('full_name', v.replace(/^\s+/, ''))}
              rule={VALIDATION_RULES.userName}
              placeholder="Nombre"
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              showIcon={true}
              maxLength={100}
            />
            <VisibilitySelect label="Visibilidad del nombre" value={profile?.name_visibility ?? 'contacts'} onChange={(v)=> onChange('name_visibility', v)} />
          </div>
          
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600">Dirección</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500">Departamento</label>
                <select
                  value={department}
                  onChange={(e)=> setDepartment(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                >
                  <option value="">Selecciona un departamento</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Municipio</label>
                <ValidatedInput
                  value={municipality}
                  onChange={(v)=> setMunicipality(v)}
                  rule={VALIDATION_RULES.location}
                  placeholder="Ej: Armenia, Pereira, Manizales"
                  className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                  showIcon={true}
                />
                <p className="mt-1 text-xs text-gray-500">Escribe el nombre del municipio donde se encuentra tu dirección</p>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              <span className="font-medium">Dirección compuesta:</span>
              <span className="ml-1">{profile?.address || '—'}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={getLocation} disabled={locLoading} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
                {locLoading ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
              </button>
              {locError && <span className="text-xs text-red-600">{locError}</span>}
            </div>
            <VisibilitySelect label="Visibilidad de la dirección" value={profile?.address_visibility ?? 'private'} onChange={(v)=> onChange('address_visibility', v)} />
          </div>
        </div>
          <p className="text-xs text-gray-500">La dirección se cifra antes de guardarse.</p>
          <div className="mt-6 flex justify-center">
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-md bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </section>

        <section className="border-t border-gray-100 p-6 md:p-8 space-y-4">
          <h2 className="text-lg font-semibold">Seguridad</h2>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-gray-600">Contraseña actual</label>
              <div className="relative">
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  value={pwdCurrent}
                  onChange={(e)=> setPwdCurrent(e.target.value.replace(/^\s+|\s+$/g, ''))}
                  className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 pr-10 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                />
                <button
                  type="button"
                  aria-label={showCurrentPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowCurrentPwd(v => !v)}
                  className="absolute inset-y-0 right-2 mt-1 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showCurrentPwd ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" />
                      <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <PasswordStrength value={pwdNew} />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={pwdNew}
                  onChange={(e)=> setPwdNew(e.target.value.replace(/^\s+|\s+$/g, ''))}
                  className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 pr-10 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                />
                <button
                  type="button"
                  aria-label={showNewPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowNewPwd(v => !v)}
                  className="absolute inset-y-0 right-2 mt-1 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showNewPwd ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" />
                      <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600">Confirmar nueva contraseña</label>
              <div className="relative">
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={pwdConfirm}
                  onChange={(e)=> setPwdConfirm(e.target.value.replace(/^\s+|\s+$/g, ''))}
                  className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 pr-10 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                />
                <button
                  type="button"
                  aria-label={showConfirmPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowConfirmPwd(v => !v)}
                  className="absolute inset-y-0 right-2 mt-1 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPwd ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" />
                      <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={onChangePassword} className="rounded-md border border-green-600 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-600 hover:text-white">Cambiar contraseña</button>
          {pwdStatus && <span className="text-sm text-gray-600">{pwdStatus}</span>}
        </div>
        </section>

        
      </div>
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

function PasswordStrength({ value }: { value: string }){
  const len = value.length
  const hasLower = /[a-z]/.test(value)
  const hasUpper = /[A-Z]/.test(value)
  const hasNum = /[0-9]/.test(value)
  const hasSym = /[^A-Za-z0-9]/.test(value)
  let score = 0
  if (len >= 8) score++
  if (hasLower && hasUpper) score++
  if (hasNum) score++
  if (hasSym) score++
  const label = score <= 1 ? 'Débil' : score === 2 ? 'Media' : score === 3 ? 'Buena' : 'Fuerte'
  const color = score <= 1 ? 'text-red-600' : score === 2 ? 'text-yellow-600' : score === 3 ? 'text-green-600' : 'text-green-700'
  return <p className={`mt-2 text-xs ${color}`}>Fortaleza: {label}</p>
}

/**/ 
