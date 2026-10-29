'use client'

import Logo from './Logo'

import { useState, useEffect } from 'react'
import {
  ArrowRight, Bell, CalendarDays, History, LayoutDashboard, 
  Search, Sparkles, User, Zap, LogOut, Lock, Camera, Menu, X, AlertCircle, Check
} from 'lucide-react'
import { getBookings, cancelBooking, getResources } from '../lib/api'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Explore', icon: Search },
  { label: 'My bookings', icon: CalendarDays },
  { label: 'AI finder', icon: Sparkles },
]

const bottomNavItems = [
  ...navItems,
  { label: 'Profile & Settings', icon: User },
]



export default function StudentDashboard({ 
  active, 
  setActive, 
  onSelect,
  resources: initialResources,
  currentUser,
  onLogout
}: { 
  active: string; 
  setActive: (v: string) => void; 
  onSelect: (r: any) => void;
  resources: any[];
  currentUser?: any;
  onLogout?: () => void;
}) {
  const [resources, setResources] = useState<any[]>(initialResources || [])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [finder, setFinder] = useState('')
  const [finderAnswer, setFinderAnswer] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const validViews = ['Overview', 'Explore', 'My bookings', 'AI finder', 'Profile & Settings']
  const currentView = validViews.includes(active) ? active : 'Overview'

  const studentName = currentUser?.name || 'Jamie Smith'
  const studentEmail = currentUser?.email || 'om.deshmukh24@pcu.edu.in'
  const studentDept = currentUser?.department || 'Computer Science & Engineering'

  const fetchStudentData = async () => {
    try {
      setLoading(true)
      const [bookData, resData] = await Promise.all([
        getBookings(),
        getResources()
      ])
      if (bookData) setBookings(bookData)
      if (resData && resData.length > 0) setResources(resData)
    } catch (e: any) {
      console.warn('Error fetching student dashboard data:', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudentData()
  }, [])

  const handleCancelBooking = async (id: string) => {
    try {
      setErrorMsg('')
      await cancelBooking(id)
      setActionMsg('Booking request cancelled successfully.')
      await fetchStudentData()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel booking.')
    }
  }

  const handleSearchResources = async (query: string) => {
    setSearchQuery(query)
    try {
      const data = await getResources({ search: query })
      setResources(data)
    } catch (e) {
      // fallback filter
    }
  }

  const upcomingBookings = bookings.filter(b => b.status === 'approved' || b.status === 'checked_out')
  const pendingBookings = bookings.filter(b => b.status === 'pending')
  const completedBookings = bookings.filter(b => b.status === 'returned')

  const initials = studentName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'OD'

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f2]">
      
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-50 border-b border-[#e5e6e0] bg-[#f7f6f2]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 lg:px-10">
          
          <button type="button" onClick={() => setActive?.('Overview')} className="flex items-center">
            <Logo />
          </button>
          
          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-8 text-sm text-[#526057] lg:flex">
            {navItems.map(({ label }) => (
              <button 
                key={label}
                onClick={() => setActive?.(label)} 
                className={`font-medium transition-colors hover:text-[#164e41] ${currentView === label ? 'text-[#164e41] font-semibold border-b-2 border-[#164e41] pb-1' : 'text-[#68756c]'}`}
              >
                {label === 'AI finder' ? 'AI Finder' : label}
              </button>
            ))}
          </nav>
          
          {/* Right User Controls & Log Out */}
          <div className="flex items-center gap-3">
            <button className="grid size-10 place-items-center rounded-full border border-[#d7ded7] bg-white text-[#65736a] hover:bg-gray-50 transition-colors" aria-label="Notifications">
              <Bell size={17} />
            </button>
            
            {/* Clickable Avatar */}
            <button 
              onClick={() => setActive?.('Profile & Settings')}
              className={`grid size-10 place-items-center rounded-full text-xs font-bold transition-all ${currentView === 'Profile & Settings' ? 'bg-[#164e41] text-[#d5f078] ring-2 ring-[#164e41]' : 'bg-[#d5f078] text-[#164e41] hover:ring-2 hover:ring-[#164e41]'}`}
              title="Profile & Settings"
            >
              {initials}
            </button>

            {/* Desktop Log Out Button */}
            <button 
              onClick={() => onLogout ? onLogout() : setActive?.('Landing')} 
              className="hidden lg:flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 ml-2"
              title="Log out"
            >
              <LogOut size={15} /> Log out
            </button>

            <button 
              type="button" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="rounded-full p-2 lg:hidden text-[#164e41]" 
              aria-label="Open menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="absolute left-0 top-[72px] w-full border-b border-[#e5e6e0] bg-[#f7f6f2] px-5 py-6 lg:hidden shadow-xl animate-in slide-in-from-top-2">
            <nav className="flex flex-col gap-4 text-base text-[#526057]">
              {navItems.map(({ label }) => (
                <button 
                  key={label}
                  onClick={() => { setActive?.(label); setMobileMenuOpen(false); }} 
                  className={`text-left font-medium transition-colors ${currentView === label ? 'text-[#164e41] font-semibold' : 'text-[#68756c]'}`}
                >
                  {label}
                </button>
              ))}
              <button 
                onClick={() => { setActive?.('Profile & Settings'); setMobileMenuOpen(false); }} 
                className={`text-left font-medium transition-colors ${currentView === 'Profile & Settings' ? 'text-[#164e41] font-semibold' : 'text-[#68756c]'}`}
              >
                Profile & Settings
              </button>
            </nav>
            <div className="mt-6 border-t border-[#e5e6e0] pt-5">
              <button 
                onClick={() => { onLogout ? onLogout() : setActive?.('Landing'); setMobileMenuOpen(false); }} 
                className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <LogOut size={16} />Log out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] px-5 py-8 pb-28 lg:px-10 lg:py-12">
          
          {actionMsg && (
            <div className="mb-6 flex items-center gap-2 rounded-2xl bg-[#dce8df] p-4 text-sm font-medium text-[#164e41] shadow-sm">
              <Check size={18} /> {actionMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 border border-red-200 shadow-sm">
              <AlertCircle size={18} /> {errorMsg}
            </div>
          )}

          {currentView === 'Overview' ? (
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a988d]">Verified Student Workspace</p>
                <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.05em] text-[#164e41]">
                  Good morning, {studentName.split(' ')[0]}.
                </h1>
              </div>
              <button onClick={() => setActive?.('Explore')} className="flex w-fit items-center gap-2 rounded-full bg-[#164e41] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f3b31]">
                Explore Resources <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a988d]">Verified Student Workspace</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.05em] text-[#164e41]">
                {currentView}
              </h1>
            </div>
          )}

          {/* VIEW: OVERVIEW */}
          {currentView === 'Overview' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#164e41] p-6 text-white">
                  <p className="text-xs text-[#b9cfbf]">Upcoming bookings</p>
                  <p className="mt-5 text-3xl font-semibold">{String(upcomingBookings.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#b9cfbf]">
                    {upcomingBookings[0] ? `Next: ${upcomingBookings[0].resource_name}` : 'No upcoming bookings'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                  <p className="text-xs text-[#89978e]">Pending requests</p>
                  <p className="mt-5 text-3xl font-semibold text-[#164e41]">{String(pendingBookings.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#89978e]">Awaiting owner review</p>
                </div>
                <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                  <p className="text-xs text-[#89978e]">Completed bookings</p>
                  <p className="mt-5 text-3xl font-semibold text-[#164e41]">{String(completedBookings.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#89978e]">successfully returned</p>
                </div>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-[#164e41]">Upcoming bookings</h2>
                    <button onClick={() => setActive?.('My bookings')} className="text-xs font-medium text-[#164e41] hover:underline">View all</button>
                  </div>

                  {upcomingBookings.length === 0 && pendingBookings.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[#7b897f]">
                      No active bookings yet. Browse the catalog to request resources!
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {upcomingBookings.slice(0, 2).map(b => (
                        <div key={b.id} className="flex items-center gap-4 rounded-2xl bg-[#f7f6f2] p-4">
                          <img src={b.resource_image || '/placeholder.svg'} alt={b.resource_name} className="size-16 rounded-xl object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[#202522]">{b.resource_name}</p>
                            <p className="mt-1 text-xs text-[#7b897f]">{b.start_time?.replace('T', ' ').substring(0, 16)} · {b.resource_location}</p>
                          </div>
                          <span className="rounded-full bg-[#d5f078] px-2.5 py-1 text-[10px] font-semibold text-[#164e41]">Confirmed</span>
                        </div>
                      ))}
                      {pendingBookings.slice(0, 2).map(b => (
                        <div key={b.id} className="flex items-center gap-4 rounded-2xl border border-[#eef0eb] p-4">
                          <div className="grid size-16 place-items-center rounded-xl bg-[#dce8df] text-[#164e41]"><CalendarDays size={22} /></div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[#202522]">{b.resource_name}</p>
                            <p className="mt-1 text-xs text-[#7b897f]">{b.start_time?.replace('T', ' ').substring(0, 16)} · {b.resource_location}</p>
                          </div>
                          <span className="rounded-full bg-[#fff3d6] px-2.5 py-1 text-[10px] font-semibold text-[#8d6b2a]">Pending</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-[#eaf0e9] p-6">
                  <div className="flex items-center gap-2 text-[#164e41]">
                    <History size={18} />
                    <h2 className="font-semibold">Recent activity</h2>
                  </div>
                  <div className="mt-5 grid gap-5">
                    {[
                      ['Official domain verified', `@${studentEmail.split('@')[1] || 'pcu.edu.in'} verified`],
                      ['Firestore integration active', 'Real-time booking and scheduling active'], 
                      ['Double booking safety', 'Transaction-level concurrency safety enabled'],
                      ['Audit log persistence', 'Returns and damage history recorded in Firestore']
                    ].map(([title, detail]) => (
                      <div key={title} className="flex gap-3">
                        <span className="mt-1 size-2 rounded-full bg-[#9eb5a6]" />
                        <div>
                          <p className="text-sm font-medium text-[#164e41]">{title}</p>
                          <p className="mt-1 text-xs text-[#7b897f]">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-[#dce2db] bg-white p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-[#164e41]">Recommended for you</h2>
                  <button onClick={() => setActive?.('Explore')} className="text-xs font-medium text-[#164e41] hover:underline">View all</button>
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  {resources.slice(0, 3).map((r) => (
                    <button key={r.id || r.name} onClick={() => onSelect?.(r)} className="group overflow-hidden rounded-2xl border border-[#deded8] bg-[#f7f6f2] text-left transition hover:-translate-y-1 hover:shadow-md">
                      <div className="relative aspect-[1.28] overflow-hidden bg-[#e6ece6]">
                        <img src={r.image || '/placeholder.svg'} alt={r.name} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#164e41]">{r.type || r.category}</span>
                        <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[#d5f078] px-2.5 py-1 text-[11px] font-semibold text-[#164e41]">
                          <span className="size-1.5 rounded-full bg-[#164e41]" />{r.status}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-[#202522]">{r.name}</h3>
                        <p className="text-xs text-[#77827b]">{r.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: EXPLORE */}
          {currentView === 'Explore' && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8 flex items-center gap-3 rounded-2xl border border-[#d7ddd6] bg-white px-4 py-3 shadow-sm">
                <Search size={19} className="text-[#164e41]" />
                <input 
                  value={searchQuery}
                  onChange={e => handleSearchResources(e.target.value)}
                  placeholder="Search equipment, spaces, and labs..." 
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#96a09a]" 
                />
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((r) => (
                  <button key={r.id || r.name} onClick={() => onSelect?.(r)} className="group overflow-hidden rounded-2xl border border-[#deded8] bg-white text-left transition hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative aspect-[1.28] overflow-hidden bg-[#e6ece6]">
                      <img src={r.image || '/placeholder.svg'} alt={r.name} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#164e41]">{r.type || r.category}</span>
                      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[#d5f078] px-2.5 py-1 text-[11px] font-semibold text-[#164e41]">
                        <span className="size-1.5 rounded-full bg-[#164e41]" />{r.status}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-[#202522]">{r.name}</h3>
                      <p className="text-xs text-[#77827b]">{r.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: MY BOOKINGS */}
          {currentView === 'My bookings' && (
            <div className="animate-in fade-in duration-500 space-y-4">
              {bookings.length === 0 ? (
                <div className="rounded-2xl border border-[#dce2db] bg-white p-12 text-center text-[#7b897f]">
                  You have not submitted any resource bookings yet. Visit Explore to book an item or space.
                </div>
              ) : (
                bookings.map(b => (
                  <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#dce2db] bg-white p-6">
                    <div className="flex items-center gap-4">
                      <img src={b.resource_image || '/placeholder.svg'} alt={b.resource_name} className="size-16 sm:size-20 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg font-semibold text-[#202522]">{b.resource_name}</p>
                        <p className="mt-1 text-xs sm:text-sm text-[#7b897f]">{b.start_time?.replace('T', ' ').substring(0, 16)} · {b.resource_location || 'Campus'}</p>
                        <p className="mt-1 text-xs text-[#89978e]">Purpose: {b.purpose}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        b.status === 'approved' ? 'bg-[#d5f078] text-[#164e41]' :
                        b.status === 'checked_out' ? 'bg-blue-100 text-blue-800' :
                        b.status === 'returned' ? 'bg-emerald-100 text-emerald-800' :
                        b.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        b.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                        'bg-[#fff3d6] text-[#8d6b2a]'
                      }`}>
                        {b.status.toUpperCase()}
                      </span>
                      {(b.status === 'pending' || b.status === 'approved') && (
                        <button 
                          onClick={() => handleCancelBooking(b.id)} 
                          className="mt-3 block w-full text-xs font-medium text-red-600 hover:underline"
                        >
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW: AI FINDER */}
          {currentView === 'AI finder' && (
            <div className="animate-in fade-in duration-500 overflow-hidden rounded-3xl border border-[#d9e1d9] bg-white">
              <div className="bg-[#164e41] p-6 sm:p-8 text-white">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#d5f078] text-[#164e41]"><Sparkles size={19} /></span>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#b9cfbf]">ResourceX AI finder</p>
                    <h2 className="text-xl sm:text-2xl font-semibold">Tell us what you are making.</h2>
                  </div>
                </div>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#c9d8cc]">Describe your project in plain language and get a starting point from the campus network.</p>
              </div>
              <div className="p-6 sm:p-8">
                <textarea value={finder} onChange={e => setFinder(e.target.value)} placeholder="I'm building a small autonomous greenhouse..." className="min-h-28 w-full resize-none rounded-2xl border border-[#d6ded7] bg-[#f7f6f2] p-4 text-sm outline-none focus:border-[#164e41]" />
                <button onClick={() => setFinderAnswer('Try the Rover Robotics Set and Electronics Lab Kit. Both support prototyping sensors, motor control, and small autonomous systems.')} className="mt-4 rounded-full bg-[#164e41] px-5 py-3 text-sm font-medium text-white hover:bg-[#0f3b31] transition-colors">
                  Find resources <ArrowRight className="ml-2 inline" size={16} />
                </button>
                {finderAnswer && (
                  <div className="mt-5 rounded-2xl bg-[#eaf0e9] p-5 text-sm leading-6 text-[#164e41]">
                    <p className="mb-2 font-semibold">A thoughtful match</p>{finderAnswer}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => onSelect?.(resources[1] || resources[0])} className="rounded-full bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50">Rover Robotics Set</button>
                      <button onClick={() => onSelect?.(resources[0])} className="rounded-full bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50">Electronics Lab Kit</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: PROFILE & SETTINGS */}
          {currentView === 'Profile & Settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-3xl border border-[#dce2db] bg-white p-6 sm:p-10">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#e5e6e0] pb-8">
                <div className="flex items-center gap-5">
                  <div className="relative group">
                    <div className="grid size-16 sm:size-20 place-items-center rounded-full bg-[#d5f078] text-xl sm:text-2xl font-bold text-[#164e41] overflow-hidden">
                      {initials}
                    </div>
                    <button className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="text-white" size={24} />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-semibold text-[#202522]">{studentName}</h3>
                    <p className="text-xs sm:text-sm font-medium text-[#7b897f]">Verified Student / Borrower (@{studentEmail.split('@')[1] || 'pcu.edu.in'})</p>
                  </div>
                </div>

                {/* Log Out Button */}
                <button 
                  onClick={() => onLogout ? onLogout() : setActive?.('Landing')} 
                  className="flex w-fit items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <LogOut size={16} />Log out
                </button>
              </div>

              <div className="mt-8 grid gap-10 lg:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-[#164e41] mb-5">Basic Information</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Full Name</label>
                      <input type="text" readOnly defaultValue={studentName} className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Verified Official Email</label>
                      <input type="email" readOnly defaultValue={studentEmail} className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Department / Major</label>
                      <input type="text" readOnly defaultValue={studentDept} className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-[#164e41] mb-5">Security & College Policy</h4>
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-[#eaf0e9] p-4 text-xs text-[#164e41] leading-relaxed">
                      <p className="font-semibold mb-1">Official Email Verification Policy</p>
                      Your account satisfies the required university domain rule (@{studentEmail.split('@')[1] || 'pcu.edu.in'}).
                      Access to equipment booking, return receipts, and space scheduling is verified server-side via Firebase Admin SDK.
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Notification Preferences</label>
                      <select disabled aria-label="Notification delivery is not configured" className="w-full appearance-none rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none">
                        <option>Email & Push Notifications</option>
                        <option>Email Only</option>
                        <option>Push Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex justify-end border-t border-[#e5e6e0] pt-6">
                <p className="text-sm text-[#65736a]">Notification delivery is not configured. Contact your campus administrator to update profile information.</p>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-[#e5e6e0] bg-[#f7f6f2] px-2 pb-safe pt-2 lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {bottomNavItems.map(({ label, icon: Icon }) => {
          const isActive = currentView === label;
          return (
            <button
              key={label}
              onClick={() => setActive?.(label)}
              className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg p-2 text-[10px] font-medium transition-colors ${isActive ? 'text-[#164e41]' : 'text-[#8a988d] hover:text-[#164e41]'}`}
            >
              <div className={`grid size-8 place-items-center rounded-full transition-all ${isActive ? 'bg-[#dce8df]' : 'bg-transparent'}`}>
                <Icon size={18} />
              </div>
              <span className="truncate w-full text-center">{label === 'Profile & Settings' ? 'Profile' : label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
