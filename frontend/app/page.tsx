'use client'

import Logo from '../components/Logo'

import { useMemo, useState, useEffect } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3,
  HandHeart, MapPin, Menu, PackageCheck, Search, X, Zap, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react'
import { auth } from '../lib/firebase'
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth'
import { fetchApi, validateAuthConfiguration } from '../lib/api'
import StudentDashboard from '../components/StudentDashboard'
import FacultyDashboard from '../components/FacultyDashboard'
import AdminDashboard from '../components/AdminDashboard'
import {
  getResources,
  createBooking,
  registerStudent,
  getCurrentUser,
  clearStoredToken,
  COLLEGE_DOMAIN
} from '../lib/api'


function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)

  const handleVideoEnd = () => {
    setFadeOut(true)
    setTimeout(() => {
      onComplete()
    }, 600)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#f7f6f2] transition-opacity duration-600 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <video
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="max-h-full max-w-full object-contain"
      >
        <source src="/intro-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      <button 
        type="button" 
        onClick={handleVideoEnd}
        className="absolute bottom-10 right-10 rounded-full bg-[#164e41]/10 px-4 py-2 text-xs font-medium text-[#164e41] backdrop-blur-sm transition hover:bg-[#164e41]/20"
      >
        Skip intro &rarr;
      </button>
    </div>
  )
}

function ResourceCard({ resource, onSelect }: { resource: any; onSelect: () => void }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-[#deded8] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(32,37,34,0.10)]">
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-label={`View ${resource.name}`}>
        <div className="relative aspect-[1.28] overflow-hidden bg-[#e6ece6]">
          <img src={resource.image || '/placeholder.svg'} alt={resource.name} className="size-full object-cover transition duration-500 group-hover:scale-105" />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#164e41]">{resource.type || resource.category || 'Equipment'}</span>
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[#d5f078] px-2.5 py-1 text-[11px] font-semibold text-[#164e41]">
            <span className="size-1.5 rounded-full bg-[#164e41]" />{resource.status}
          </span>
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-tight text-[#202522]">{resource.name}</h3>
            <ArrowUpRight size={17} className="shrink-0 text-[#819088] transition group-hover:text-[#164e41]" />
          </div>
          <p className="text-xs text-[#77827b]">{resource.category}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[#77827b]">
            <MapPin size={13} />{resource.location}
          </p>
        </div>
      </button>
    </article>
  )
}

function SearchPanel({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="relative z-10 mx-auto -mt-8 max-w-5xl rounded-2xl border border-[#d7ddd6] bg-white p-4 sm:p-2 shadow-[0_16px_40px_rgba(22,78,65,0.10)] md:-mt-10">
      <div className="grid items-center gap-2 sm:gap-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <label className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-[#f7f6f2]">
          <Search size={19} className="text-[#164e41] shrink-0" />
          <span className="sr-only">Search resources</span>
          <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch(value)} placeholder="What do you need for your project?" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#96a09a]" />
        </label>
        {[['Category', 'All categories'], ['Campus', 'North Science'], ['When', 'Any time']].map(([label, val]) => (
          <button type="button" key={label} className="flex items-center justify-between border-t sm:border-t-0 sm:border-l border-[#e8ebe6] px-4 py-3 text-left">
            <span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-[#9aa39d]">{label}</span>
              <span className="text-sm text-[#39443d]">{val}</span>
            </span>
            <ChevronDown size={15} className="text-[#8b978e]" />
          </button>
        ))}
        <button type="button" onClick={() => onSearch(value)} className="mt-2 sm:mt-0 flex w-full items-center justify-center gap-2 rounded-xl bg-[#164e41] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#0f3b31] md:w-auto">
          <Search size={16} />Search
        </button>
      </div>
    </div>
  )
}

function DetailModal({ resource, onClose, onRequireLogin }: { resource: any; onClose: () => void; onRequireLogin: () => void }) {
  const [startDate, setStartDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [startTime, setStartTime] = useState('10:00')
  const [durationHours, setDurationHours] = useState('2')
  const [purpose, setPurpose] = useState('Research and project prototyping work')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleBookingSubmit = async () => {
    if (submitting) return
    if (!auth.currentUser) {
      onRequireLogin()
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    try {
      const start = new Date(`${startDate}T${startTime}:00`)
      const end = new Date(start.getTime() + Number(durationHours) * 60 * 60 * 1000)
      const startIso = start.toISOString()
      const endIso = end.toISOString()

      await createBooking({
        resource_id: resource.id || 'res-electronics-001',
        start_time: startIso,
        end_time: endIso,
        purpose: purpose || 'Academic coursework and lab research'
      })
      setSubmitted(true)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit booking request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#164e41]/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-[#f7f6f2] shadow-2xl">
        <div className="relative">
          <img src={resource.image || '/placeholder.svg'} alt={resource.name} className="h-48 sm:h-52 w-full object-cover" />
          <button type="button" onClick={onClose} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-[#164e41]" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#809087]">{resource.category} · {resource.type || 'Equipment'}</p>
              <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-[#164e41]">{resource.name}</h2>
            </div>
            <span className="rounded-full bg-[#d5f078] px-3 py-1 text-xs font-semibold text-[#164e41]">{resource.status}</span>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-[#65736a]">
            <p className="flex gap-2"><MapPin size={16} className="text-[#164e41] shrink-0" />{resource.location}</p>
            <p className="flex gap-2"><Clock3 size={16} className="text-[#164e41] shrink-0" />Bookings are reviewed and approved by the resource owner</p>
          </div>

          {errorMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {submitted ? (
            <div className="mt-6 rounded-2xl bg-[#dce8df] p-4 text-sm text-[#164e41]">
              <div className="flex items-center gap-2 font-semibold"><Check size={17} />Booking Request Submitted!</div>
              <p className="mt-1 text-xs text-[#5f7667]">Your request is securely recorded in Cloud Firestore and sent to the faculty owner for review.</p>
              <button type="button" onClick={onClose} className="mt-4 w-full rounded-full bg-[#164e41] py-2 text-xs font-medium text-white">Done</button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-[#65736a]">Date
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm outline-none" />
                </label>
                <label className="text-xs font-medium text-[#65736a]">Start Time
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm outline-none" />
                </label>
              </div>
              <div className="mt-3">
                <label className="text-xs font-medium text-[#65736a]">Purpose of Booking
                  <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Capstone Project prototype testing" className="mt-1 w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm outline-none" />
                </label>
              </div>
              <button 
                type="button" 
                disabled={submitting} 
                onClick={handleBookingSubmit} 
                className="mt-5 w-full rounded-full bg-[#164e41] py-3 text-sm font-medium text-white transition hover:bg-[#0f3b31] disabled:opacity-50"
              >
                {submitting ? 'Submitting to Firestore...' : 'Request booking'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Hero({ onSearch, onList }: { onSearch: (v: string) => void; onList: () => void }) {
  return (
    <>
      <section className="mx-auto max-w-[1240px] px-5 pb-10 pt-16 lg:px-8 lg:pb-14 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
          <div>
            <p className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7c8b81]">
              <span className="size-2 rounded-full bg-[#d5f078]" />The campus sharing network
            </p>
            <h1 className="max-w-xl text-[clamp(2.5rem,5vw,5.25rem)] font-semibold leading-[1.05] sm:leading-[0.98] tracking-[-0.065em] text-[#164e41]">
              Great ideas deserve access to <span className="text-[#83a18e]">great resources.</span>
            </h1>
            <p className="mt-5 sm:mt-7 max-w-md text-sm sm:text-base leading-7 text-[#68756c]">
              Discover equipment, book spaces, and unlock the potential of resources already available on your campus.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="button" onClick={() => document.getElementById('resource-grid')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#164e41] px-5 py-3 text-sm font-medium text-white">
                Explore resources <ArrowRight size={16} />
              </button>
              <button type="button" onClick={onList} className="w-full sm:w-auto rounded-full border border-[#bdc9c0] px-5 py-3 text-sm font-medium text-[#164e41] hover:bg-white text-center">
                List a resource
              </button>
            </div>
            <div className="mt-10 flex items-center gap-3 text-xs text-[#829087]">
              <span className="flex -space-x-2">
                <span className="grid size-7 place-items-center rounded-full border-2 border-[#f7f6f2] bg-[#d5f078] text-[10px] font-bold text-[#164e41]">OD</span>
                <span className="grid size-7 place-items-center rounded-full border-2 border-[#f7f6f2] bg-[#c5d9ce] text-[10px] font-bold text-[#164e41]">RR</span>
                <span className="grid size-7 place-items-center rounded-full border-2 border-[#f7f6f2] bg-[#164e41] text-[10px] font-bold text-white">+</span>
              </span>
              Built for students, faculty & campus communities (@{COLLEGE_DOMAIN})
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[28px] bg-[#dce8df] shadow-[0_24px_70px_rgba(22,78,65,0.15)]">
              <img src="/resourcex-lab.png" alt="Students collaborating in the Engineering Innovation Lab" className="aspect-[1.16] w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 left-5 flex items-center gap-3 rounded-2xl border border-[#dce4dc] bg-white p-3 shadow-[0_15px_30px_rgba(22,78,65,0.14)] md:left-8">
              <span className="grid size-10 place-items-center rounded-xl bg-[#dce8df] text-[#164e41]"><PackageCheck size={20} /></span>
              <span>
                <span className="block text-[10px] uppercase tracking-widest text-[#89978e]">Available today</span>
                <span className="block text-sm font-semibold text-[#164e41]">Electronics Lab Kit</span>
              </span>
            </div>
          </div>
        </div>
      </section>
      <SearchPanel onSearch={onSearch} />
    </>
  )
}

function ExplorePublic({ resources, onSelect, onSearch, query, onList }: { resources: any[]; onSelect: (r: any) => void; onSearch: (v: string) => void; query: string; onList: () => void }) {
  const filtered = useMemo(() => resources.filter(r => !query || `${r.name} ${r.category} ${r.location}`.toLowerCase().includes(query.toLowerCase())), [resources, query])
  return (
    <main id="explore">
      <Hero onSearch={onSearch} onList={onList} />
      <section className="mx-auto max-w-[1240px] px-5 pb-20 pt-24 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b978e]">Explore the network</p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#164e41] md:text-4xl">Find what your next idea needs.</h2>
          </div>
          <button type="button" onClick={() => onSearch('')} className="hidden items-center gap-2 text-sm font-medium text-[#164e41] sm:flex">
            View all resources <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" id="resource-grid">
          {filtered.map(r => <ResourceCard key={r.id || r.name} resource={r} onSelect={() => onSelect(r)} />)}
        </div>
        {filtered.length === 0 && <div className="py-20 text-center text-[#718078]">No resources match “{query}”. Try another search.</div>}
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how" className="py-24 px-5 lg:px-10 bg-[#f0ede6]/50 border-y border-[#e5e6e0]">
        <div className="mx-auto max-w-[1300px]">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:items-center">
            <div>
              <span className="inline-block rounded-full bg-[#dce8df] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#164e41]">
                Simple by Design
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.04em] text-[#164e41] leading-tight">
                From “I need” to <span className="italic font-normal">“I made it.”</span>
              </h2>
              <p className="mt-5 text-base sm:text-lg text-[#65736a] leading-relaxed max-w-md">
                ResourceX makes it effortless to find what is already on campus, so creators, students, and researchers can spend less time searching and more time building.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="group relative rounded-3xl border border-[#deded8] bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-[#164e41]/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="grid size-12 place-items-center rounded-2xl bg-[#164e41] text-white shadow-md transition-transform group-hover:scale-110">
                      <Search size={20} />
                    </div>
                    <span className="text-xs font-bold tracking-widest text-[#a3b1a8]">01</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#164e41]">Discover</h3>
                  <p className="mt-2 text-sm text-[#77837a] leading-relaxed">
                    Search the campus network for specialized equipment, quiet spaces, and lab expertise.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#f0f2ed] flex items-center text-xs font-semibold text-[#164e41] gap-1 group-hover:translate-x-1 transition-transform">
                  Explore network &rarr;
                </div>
              </div>

              <div className="group relative rounded-3xl border border-[#deded8] bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-[#164e41]/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="grid size-12 place-items-center rounded-2xl bg-[#d5f078] text-[#164e41] shadow-md transition-transform group-hover:scale-110">
                      <CalendarDays size={20} />
                    </div>
                    <span className="text-xs font-bold tracking-widest text-[#a3b1a8]">02</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#164e41]">Request</h3>
                  <p className="mt-2 text-sm text-[#77837a] leading-relaxed">
                    Choose a time slot that fits your schedule and send a clean booking request to the owner.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#f0f2ed] flex items-center text-xs font-semibold text-[#164e41] gap-1 group-hover:translate-x-1 transition-transform">
                  Fast approvals &rarr;
                </div>
              </div>

              <div className="group relative rounded-3xl border border-[#deded8] bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-[#164e41]/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="grid size-12 place-items-center rounded-2xl bg-[#eaf0e9] text-[#164e41] shadow-md transition-transform group-hover:scale-110">
                      <Sparkles size={20} />
                    </div>
                    <span className="text-xs font-bold tracking-widest text-[#a3b1a8]">03</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#164e41]">Share back</h3>
                  <p className="mt-2 text-sm text-[#77837a] leading-relaxed">
                    Use it, record the return condition, and leave the next creator with a smooth handoff.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#f0f2ed] flex items-center text-xs font-semibold text-[#164e41] gap-1 group-hover:translate-x-1 transition-transform">
                  Smarter campus &rarr;
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="institutions" className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8">
        <div className="rounded-[28px] bg-[#164e41] px-7 py-12 text-white md:px-14 md:py-14">
          <div className="grid items-end gap-10 md:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b9cfbf]">For institutions</p>
              <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] md:text-4xl lg:text-5xl">Your resources are already making an impact.</h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-[#c3d2c8]">Turn underused equipment and spaces into a living network of opportunity for your campus community.</p>
            </div>
            <button type="button" onClick={onList} className="flex w-full sm:w-fit items-center justify-center gap-2 rounded-full bg-[#d5f078] px-5 py-3 text-sm font-semibold text-[#164e41]">
              Start sharing <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function Footer() { 
  return (
    <footer className="border-t border-[#e3e5df]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 text-xs text-[#87938a] sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <Logo />
        <span>© 2026 ResourceX · Official PCU Campus Sharing Network (@{COLLEGE_DOMAIN})</span>
        <div className="flex gap-5">
          <a href="#how">How it works</a>
          <a href="#institutions">For institutions</a>
          <a href="mailto:om.deshmukh24@pcu.edu.in">Contact</a>
        </div>
      </div>
    </footer>
  )
}

function Login({ onLogin, onBack }: { onLogin: (user: any) => void; onBack: () => void }) {
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [loginRole, setLoginRole] = useState('student')
  const [password, setPassword] = useState('')
  
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const switchMode = (newMode: 'signin' | 'register' | 'forgot') => {
    setError('')
    setIsDuplicateEmail(false)
    setMode(newMode)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    
    try {
      const normalized = email.trim().toLowerCase()
      await validateAuthConfiguration()
      await signOut(auth)
      clearStoredToken()
      const credential = await signInWithEmailAndPassword(auth, normalized, password)
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user)
      }
      await credential.user.getIdToken(true)
      // Recovery requires a server-owned registration marker and cannot assign roles.
      if (loginRole === 'student') {
        const result = await credential.user.getIdTokenResult()
        if (result.claims.student_registration) {
          await fetchApi('/api/auth/recover-student', { method: 'POST' })
        }
      }
      const userProfile = await fetchApi(`/api/auth/me?expected_role=${loginRole}`)
      onLogin(userProfile)
    } catch (err: any) {
      await signOut(auth)
      clearStoredToken()
      setError(err.message || 'Failed to authenticate. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setIsDuplicateEmail(false)
    setLoading(true)

    const normalized = regEmail.trim().toLowerCase()
    if (!normalized.endsWith(`@${COLLEGE_DOMAIN}`)) {
      setError(`Official College Restriction: Student accounts must end with @${COLLEGE_DOMAIN}. Lookalike domains and personal emails are rejected.`)
      setLoading(false)
      return
    }

    if (!regName || !regEmail || !regPassword) {
      setError('All fields are required.')
      setLoading(false)
      return
    }
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      await validateAuthConfiguration()
      await registerStudent({
        name: regName,
        email: normalized,
        password: regPassword,
        department: 'Computer Science & Engineering'
      })
      const credential = await signInWithEmailAndPassword(auth, normalized, regPassword)
      await sendEmailVerification(credential.user)
      await signOut(auth)
      clearStoredToken()
      setSuccessMsg(`Account created for ${normalized}. Check your inbox to verify your email before signing in.`)
      setEmail(normalized)
      setIsDuplicateEmail(false)
      setMode('signin')
    } catch (err: any) {
      const msg = err.message || 'Registration failed.'
      if (
        msg.includes('already registered') || 
        msg.includes('already exists') ||
        msg.toLowerCase().includes('already')
      ) {
        setIsDuplicateEmail(true)
        setError('This email is already registered. Please sign in or reset your password.')
      } else {
        setIsDuplicateEmail(false)
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase())
      setSuccessMsg('If an account exists, check its inbox for password reset instructions.')
      setMode('signin')
    } catch (err: any) {
      setError(err.message || 'Could not send password reset instructions.')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 pt-10 pb-20">
      <div className="relative w-full max-w-md rounded-[24px] bg-white p-6 sm:p-8 shadow-[0_16px_40px_rgba(22,78,65,0.08)] border border-[#e5e6e0]">
        
        <button type="button" onClick={onBack} className="absolute left-4 sm:left-6 top-6 flex items-center gap-1.5 text-sm font-medium text-[#65736a] transition hover:text-[#164e41]">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="mb-6 mt-8 sm:mt-4 flex justify-center">
          <Logo />
        </div>
        
        <div className="mb-6 grid grid-cols-3 gap-2" aria-label="Login role">
          {['student', 'teacher', 'admin'].map(role => (
            <button key={role} type="button" disabled={loading} aria-pressed={loginRole === role}
              onClick={() => { setLoginRole(role); switchMode('signin') }}
              className={`rounded-xl px-2 py-3 text-sm capitalize ${loginRole === role ? 'bg-[#164e41] text-white' : 'bg-[#eaf0e9] text-[#164e41]'}`}>
              {role} Login
            </button>
          ))}
        </div>
        {mode === 'signin' && (
          <>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#164e41]">Welcome back</h2>
            <p className="mt-2 text-center text-sm text-[#68756c]">Sign in to your ResourceX account</p>
            
            {error && <p className="mt-4 text-center text-sm font-medium text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}
            {successMsg && <p className="mt-4 text-center text-sm font-medium text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">{successMsg}</p>}
            
            <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Official Campus Email (@{COLLEGE_DOMAIN})</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#164e41]" placeholder={`om.deshmukh24@${COLLEGE_DOMAIN}`} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#65736a]">Password</label>
                  <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-[#164e41] hover:underline">Forgot password?</button>
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#164e41]" placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="mt-6 w-full rounded-full bg-[#164e41] py-3 text-sm font-medium text-white transition hover:bg-[#0f3b31] disabled:opacity-50">
                {loading ? 'Authenticating with Backend...' : 'Sign in to Workspace'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-[#68756c]">
              <p>{loginRole === 'student' && <>Don&apos;t have an account? <button type="button" onClick={() => switchMode('register')} className="font-semibold text-[#164e41] hover:underline">Student Register</button></>}</p>
            </div>


          </>
        )}

        {mode === 'register' && (
          <>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#164e41]">Create Student Account</h2>
            <p className="mt-2 text-center text-sm text-[#68756c]">Restricted exclusively to @{COLLEGE_DOMAIN}</p>
            
            {isDuplicateEmail ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-950">Email Already Registered</p>
                    <p className="mt-1 text-amber-800 leading-relaxed">
                      This email is already registered. Please sign in or reset your password.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(regEmail.trim().toLowerCase());
                          switchMode('signin');
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-[#164e41] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f3b31] transition shadow-sm"
                      >
                        Switch to Student Sign In &rarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(regEmail.trim().toLowerCase());
                          switchMode('forgot');
                        }}
                        className="rounded-full border border-[#164e41]/30 bg-white px-3.5 py-2 text-xs font-medium text-[#164e41] hover:bg-gray-50 transition"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              error && <p className="mt-4 text-center text-sm font-medium text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>
            )}
            
            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Full Name</label>
                <input type="text" value={regName} onChange={e => setRegName(e.target.value)} required className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#164e41]" placeholder="Om Deshmukh" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Official Campus Email (@{COLLEGE_DOMAIN})</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#164e41]" placeholder={`om.deshmukh24@${COLLEGE_DOMAIN}`} />
                <p className="mt-1 text-[10px] text-[#78887e]">Note: Gmail, Yahoo, Outlook, and other personal domains will be rejected by policy.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Password</label>
                <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#164e41]" placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Confirm Password</label>
                <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} required className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#164e41]" placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="mt-6 w-full rounded-full bg-[#164e41] py-3 text-sm font-medium text-white transition hover:bg-[#0f3b31] disabled:opacity-50">
                {loading ? 'Validating Domain & Creating Account...' : 'Register Student Account'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-[#68756c]">
              <p>Already have an account? <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-[#164e41] hover:underline">Sign in</button></p>
            </div>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-[#164e41]">Reset Password</h2>
            <p className="mt-2 text-center text-sm text-[#68756c]">Enter your campus email to receive a reset link</p>
            
            <form className="mt-6 space-y-4" onSubmit={handleForgot}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#164e41]" placeholder={`om.deshmukh24@${COLLEGE_DOMAIN}`} />
              </div>
              <button type="submit" disabled={loading} className="mt-6 w-full rounded-full bg-[#164e41] py-3 text-sm font-medium text-white transition hover:bg-[#0f3b31]">
                Send Reset Link
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-[#68756c]">
              <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-[#164e41] hover:underline">Back to Sign In</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default function Page() {
  const [active, setActive] = useState('Landing')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [resources, setResources] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showIntro, setShowIntro] = useState(true)

  // Load resources from FastAPI backend on mount
  const loadResources = async () => {
    try {
      const data = await getResources()
      if (data) {
        setResources(data)
      }
    } catch (e) {
      console.warn('Backend not ready yet, using cached resources:', e)
    }
  }

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('resourcex_intro_seen')
    if (hasSeenIntro) {
      setShowIntro(false)
    }

    clearStoredToken()
    let cancelled = false
    void auth.authStateReady().then(async () => {
      if (!auth.currentUser) return
      try {
        const profile = await getCurrentUser()
        if (!cancelled && auth.currentUser) { setCurrentUser(profile); setActive('Overview') }
      } catch { if (!cancelled) setCurrentUser(null) }
    })
    loadResources()
    return () => { cancelled = true }
  }, [])

  const handleIntroComplete = () => {
    setShowIntro(false)
    sessionStorage.setItem('resourcex_intro_seen', 'true')
  }

  const handleLogout = () => {
    void signOut(auth)
    clearStoredToken()
    setCurrentUser(null)
    setActive('Landing')
  }
  
  const userRole = currentUser?.role || 'student'
  const isLanding = active === 'Landing'
  const isLogin = active === 'Login'
  const isDashboard = !!currentUser && active !== 'Landing' && active !== 'Login'

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#202522]">
      {showIntro && isLanding && <IntroAnimation onComplete={handleIntroComplete} />}

      {/* Header only renders if intro animation is finished */}
      {!showIntro && isLanding && (
        <header className="relative z-50 border-b border-[#e5e6e0] bg-[#f7f6f2]/95">
          <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
            <button type="button" onClick={() => setActive('Landing')}><Logo /></button>
            
            <nav className="hidden items-center gap-8 text-sm text-[#526057] md:flex">
              <a href="#explore" className="font-medium text-[#164e41]">Explore resources</a>
              <a href="#how">How it works</a>
              <a href="#institutions">For institutions</a>
            </nav>
            
            <div className="flex items-center gap-3">
              {currentUser ? (
                <button 
                  type="button" 
                  onClick={() => setActive('Overview')} 
                  className="rounded-full bg-[#164e41] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f3b31]"
                >
                  Go to Workspace ({currentUser.role})
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setActive('Login')} className="hidden text-sm font-medium text-[#526057] md:block">Sign in</button>
                  <button type="button" onClick={() => setActive('Login')} className="hidden md:block rounded-full bg-[#164e41] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f3b31]">Get started</button>
                </>
              )}
              
              <button 
                type="button" 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                className="rounded-full p-2 md:hidden" 
                aria-label="Open menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="absolute left-0 top-[72px] w-full border-b border-[#e5e6e0] bg-[#f7f6f2] px-5 py-6 md:hidden shadow-xl animate-in slide-in-from-top-2">
              <nav className="flex flex-col gap-5 text-base text-[#526057]">
                <a href="#explore" onClick={() => setMobileMenuOpen(false)} className="font-medium text-[#164e41]">Explore resources</a>
                <a href="#how" onClick={() => setMobileMenuOpen(false)}>How it works</a>
                <a href="#institutions" onClick={() => setMobileMenuOpen(false)}>For institutions</a>
              </nav>
              <div className="mt-8 flex flex-col gap-3 border-t border-[#e5e6e0] pt-6">
                <button type="button" onClick={() => { setMobileMenuOpen(false); setActive('Login'); }} className="w-full rounded-full border border-[#d6ded7] bg-white px-4 py-3 text-sm font-medium text-[#164e41]">
                  Sign in
                </button>
                <button type="button" onClick={() => { setMobileMenuOpen(false); setActive('Login'); }} className="w-full rounded-full bg-[#164e41] px-4 py-3 text-sm font-medium text-white">
                  Get started
                </button>
              </div>
            </div>
          )}
        </header>
      )}

      {!showIntro && isLanding && (
        <ExplorePublic 
          resources={resources} 
          onSelect={setSelected} 
          onSearch={setQuery} 
          query={query} 
          onList={() => setActive('Login')} 
        />
      )}
      
      {isLogin && (
        <Login 
          onLogin={(profile) => { 
            setCurrentUser(profile); 
            setActive('Overview'); 
          }} 
          onBack={() => setActive('Landing')} 
        />
      )}
      
      {isDashboard && userRole === 'admin' && (
        <AdminDashboard 
          active={active} 
          setActive={setActive} 
          resources={resources} 
          currentUser={currentUser}
          onLogout={handleLogout}
          onRefreshResources={loadResources}
          onRemoveResource={(idOrName) => {
            setResources(resources.filter(r => r.name !== idOrName && r.id !== idOrName))
          }} 
        />
      )}

      {isDashboard && userRole === 'teacher' && (
        <FacultyDashboard 
          active={active} 
          setActive={setActive} 
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {isDashboard && userRole === 'student' && (
        <StudentDashboard 
          active={active} 
          setActive={setActive} 
          onSelect={setSelected} 
          resources={resources} 
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )} 
      
      {!showIntro && isLanding && <Footer />}
      
      {selected && (
        <DetailModal 
          resource={selected} 
          onClose={() => setSelected(null)} 
          onRequireLogin={() => {
            setSelected(null)
            setActive('Login')
          }}
        />
      )}
    </div>
  )
}
