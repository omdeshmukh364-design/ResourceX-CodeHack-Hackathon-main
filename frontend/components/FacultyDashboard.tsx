'use client'

import Logo from './Logo'

import { useState, useEffect } from 'react'
import {
  ArrowRight, Bell, CalendarDays, History, LayoutDashboard, 
  Package, CheckCircle2, XCircle, Plus, Search, Sparkles, User, 
  Zap, LogOut, Lock, Camera, Trash2, Edit3, Check, AlertCircle, X, Menu
} from 'lucide-react'
import {
  getResources,
  createResource,
  deleteResource,
  getBookings,
  approveBooking,
  rejectBooking,
  returnBooking,
  getReturns
} from '../lib/api'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'My Resources', icon: Package },
  { label: 'Booking Requests', icon: CalendarDays },
  { label: 'Returns & Reports', icon: History },
]



export default function FacultyDashboard({ 
  active, 
  setActive,
  currentUser,
  onLogout
}: { 
  active: string; 
  setActive: (v: string) => void;
  currentUser?: any;
  onLogout?: () => void;
}) {
  const [resources, setResources] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [returns, setReturns] = useState<any[]>([])
  const [returnRecords, setReturnRecords] = useState<any[]>([])
  
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Modals & Form States
  const [showAddModal, setShowAddModal] = useState(false)
  const [newRes, setNewRes] = useState({ name: '', category: 'Equipment', type: 'Equipment', location: '', description: '', status: 'Available today', quantity: 1 })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const [conditionModalItem, setConditionModalItem] = useState<any>(null)
  const [condition, setCondition] = useState('Good')
  const [note, setNote] = useState('')

  const validViews = ['Overview', 'My Resources', 'Booking Requests', 'Returns & Reports', 'Profile & Settings']
  const currentView = validViews.includes(active) ? active : 'Overview'

  const facultyName = currentUser?.name || 'Dr. Robert Reynolds'
  const facultyEmail = currentUser?.email || 'reynolds@pcu.edu.in'
  const initials = facultyName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'DR'

  const fetchFacultyData = async () => {
    try {
      setLoading(true)
      const [resData, bookData, retData] = await Promise.all([
        getResources({ owner_uid: currentUser?.uid }),
        getBookings({ owner_uid: currentUser?.uid }),
        getReturns()
      ])
      if (resData) setResources(resData)
      if (bookData) {
        setRequests(bookData)
        // Active checked-out items awaiting return
        setReturns(bookData.filter(b => b.status === 'checked_out' || b.status === 'approved'))
      }
      if (retData) setReturnRecords(retData)
    } catch (err: any) {
      console.warn('Error fetching faculty data:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFacultyData()
  }, [])

  // Handlers
  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRes.name || !newRes.location) return
    setErrorMsg('')
    try {
      await createResource({
        name: newRes.name,
        category: newRes.category,
        type: newRes.type || 'Equipment',
        location: newRes.location,
        description: newRes.description || 'Faculty-managed lab equipment',
        status: newRes.status,
        quantity: Number(newRes.quantity) || 1
      })
      setActionMsg(`Resource "${newRes.name}" created successfully.`)
      setNewRes({ name: '', category: 'Equipment', type: 'Equipment', location: '', description: '', status: 'Available today', quantity: 1 })
      setShowAddModal(false)
      await fetchFacultyData()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create resource.')
    }
  }

  const handleDeleteResource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource listing?')) return
    setErrorMsg('')
    try {
      await deleteResource(id)
      setActionMsg('Resource deleted successfully.')
      await fetchFacultyData()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete resource.')
    }
  }

  const handleRequestAction = async (id: string, action: 'Approved' | 'Rejected') => {
    setErrorMsg('')
    try {
      if (action === 'Approved') {
        await approveBooking(id, 'Approved by resource owner')
        setActionMsg('Booking request approved.')
      } else {
        await rejectBooking(id, 'Unavailable for the requested schedule')
        setActionMsg('Booking request rejected.')
      }
      await fetchFacultyData()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to ${action.toLowerCase()} request.`)
    }
  }

  const handleReturnAction = async (bookingId: string) => {
    setErrorMsg('')
    try {
      await returnBooking(bookingId, {
        condition: condition,
        damage_notes: note || undefined
      })
      setActionMsg(`Return processed successfully with condition: ${condition}.`)
      setConditionModalItem(null)
      setNote('')
      await fetchFacultyData()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process return.')
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const checkedOutCount = requests.filter(r => r.status === 'checked_out').length

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
                {label}
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
              className={`grid size-10 place-items-center rounded-full text-xs font-bold transition-all ${currentView === 'Profile & Settings' ? 'bg-[#164e41] text-[#d5f078] ring-2 ring-[#164e41]' : 'bg-[#164e41] text-[#d5f078] hover:ring-2 hover:ring-[#164e41]'}`}
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

          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a988d]">Faculty Workspace (@{facultyEmail.split('@')[1] || 'pcu.edu.in'})</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.05em] text-[#164e41]">
                {currentView === 'Overview' ? `Welcome back, ${facultyName.split(' ')[0]}.` : currentView}
              </h1>
            </div>
            {currentView === 'Overview' && (
              <button onClick={() => setShowAddModal(true)} className="flex w-fit items-center gap-2 rounded-full bg-[#164e41] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f3b31]">
                <Plus size={16} /> Add a Resource
              </button>
            )}
          </div>

          {/* VIEW 1: OVERVIEW */}
          {currentView === 'Overview' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#164e41] p-6 text-white">
                  <p className="text-xs text-[#b9cfbf]">Your Resources</p>
                  <p className="mt-5 text-3xl font-semibold">{String(resources.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#b9cfbf]">Managed items & spaces</p>
                </div>
                <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                  <p className="text-xs text-[#89978e]">Pending Requests</p>
                  <p className="mt-5 text-3xl font-semibold text-[#164e41]">{String(pendingRequests.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#89978e]">Requires approval</p>
                </div>
                <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                  <p className="text-xs text-[#89978e]">Active Bookings</p>
                  <p className="mt-5 text-3xl font-semibold text-[#164e41]">{String(checkedOutCount).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#89978e]">Currently checked out</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-[#164e41]">Recent Booking Requests</h2>
                  <button onClick={() => setActive('Booking Requests')} className="text-xs font-medium text-[#164e41] hover:underline">View all</button>
                </div>
                {requests.length === 0 ? (
                  <div className="py-6 text-center text-sm text-[#7b897f]">No student requests found for your resources yet.</div>
                ) : (
                  <div className="space-y-3">
                    {requests.slice(0, 4).map(req => (
                      <div key={req.id} className="flex items-center justify-between rounded-xl bg-[#f7f6f2] p-4">
                        <div>
                          <p className="font-medium text-[#202522]">{req.requester_name} requested <span className="text-[#164e41] font-semibold">{req.resource_name}</span></p>
                          <p className="text-xs text-[#7b897f]">{req.start_time?.replace('T', ' ').substring(0, 16)} · {req.purpose}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${req.status === 'approved' ? 'bg-[#d5f078] text-[#164e41]' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : req.status === 'returned' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: MY RESOURCES */}
          {currentView === 'My Resources' && (
            <div className="animate-in fade-in duration-500 space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-[#68756c]">Manage equipment, labs, and spaces assigned to you.</p>
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 rounded-full bg-[#164e41] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f3b31]">
                  <Plus size={16} /> Add Resource
                </button>
              </div>

              {resources.length === 0 ? (
                <div className="rounded-2xl border border-[#dce2db] bg-white p-12 text-center text-[#7b897f]">
                  No resources listed under your ownership yet. Click &quot;Add Resource&quot; to list equipment or labs.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {resources.map(res => (
                    <div key={res.id} className="rounded-2xl border border-[#dce2db] bg-white p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="rounded-full bg-[#dce8df] px-2.5 py-1 text-[11px] font-medium text-[#164e41]">{res.category}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${res.condition === 'Damaged' ? 'bg-red-100 text-red-700' : 'text-emerald-700 bg-emerald-50'}`}>
                            {res.condition || 'Good'} · {res.status}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-[#164e41]">{res.name}</h3>
                        <p className="mt-1 text-xs text-[#7b897f]">{res.location}</p>
                        <p className="mt-3 text-sm text-[#68756c]">{res.description}</p>
                      </div>
                      <div className="mt-6 flex justify-end gap-2 border-t border-[#f0f2ed] pt-4">
                        <button onClick={() => handleDeleteResource(res.id)} className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                          <Trash2 size={14} /> Remove Listing
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: BOOKING REQUESTS */}
          {currentView === 'Booking Requests' && (
            <div className="animate-in fade-in duration-500 space-y-4">
              {requests.length === 0 ? (
                <div className="rounded-2xl border border-[#dce2db] bg-white p-12 text-center text-[#7b897f]">
                  No student booking requests found.
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#dce2db] bg-white p-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#164e41]">{req.requester_name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${req.status === 'approved' ? 'bg-[#d5f078] text-[#164e41]' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : req.status === 'returned' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#202522] mt-1">Requested: {req.resource_name}</p>
                      <p className="text-xs text-[#7b897f] mt-0.5">Time: {req.start_time?.replace('T', ' ').substring(0, 16)} &rarr; {req.end_time?.replace('T', ' ').substring(0, 16)}</p>
                      <p className="text-xs text-[#89978e] mt-1">Student Email: {req.requester_email} · Purpose: {req.purpose}</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleRequestAction(req.id, 'Approved')} className="flex items-center gap-1 rounded-full bg-[#164e41] px-4 py-2 text-xs font-medium text-white hover:bg-[#0f3b31]">
                          <Check size={14} /> Approve
                        </button>
                        <button onClick={() => handleRequestAction(req.id, 'Rejected')} className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-100">
                          <X size={14} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW 4: RETURNS & REPORTS */}
          {currentView === 'Returns & Reports' && (
            <div className="animate-in fade-in duration-500 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[#164e41]">Active Checkouts Awaiting Return</h3>
                <p className="text-xs text-[#68756c]">Inspect physical item condition upon check-in and record damages.</p>
              </div>

              {returns.filter(r => r.status === 'checked_out' || r.status === 'approved').length === 0 ? (
                <div className="rounded-2xl border border-[#dce2db] bg-white p-8 text-center text-sm text-[#7b897f]">
                  No items currently checked out.
                </div>
              ) : (
                <div className="space-y-4">
                  {returns.filter(r => r.status === 'checked_out' || r.status === 'approved').map(ret => (
                    <div key={ret.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#dce2db] bg-white p-6">
                      <div>
                        <h4 className="font-semibold text-[#164e41]">{ret.resource_name}</h4>
                        <p className="text-sm text-[#202522] mt-0.5">Borrowed by {ret.requester_name} ({ret.requester_email})</p>
                        <p className="text-xs text-amber-700 mt-1">Status: {ret.status.toUpperCase()} · Scheduled End: {ret.end_time?.replace('T', ' ').substring(0, 16)}</p>
                      </div>
                      <button onClick={() => setConditionModalItem(ret)} className="rounded-full bg-[#164e41] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#0f3b31]">
                        Process Return
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Historical Return Records */}
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-[#164e41] mb-2">Completed Return History</h3>
                {returnRecords.length === 0 ? (
                  <div className="rounded-2xl border border-[#dce2db] bg-white p-8 text-center text-sm text-[#7b897f]">
                    No historical returns recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {returnRecords.map((rec: any) => (
                      <div key={rec.id} className="rounded-2xl border border-[#dce2db] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#164e41]">{rec.resource_name}</p>
                          <p className="text-xs text-[#68756c]">Returned by {rec.borrower_name} · Recorded at {rec.returned_at?.replace('T', ' ').substring(0, 16)}</p>
                          {rec.damage_notes && (
                            <p className="text-xs font-medium text-red-600 mt-1">Damage Note: {rec.damage_notes}</p>
                          )}
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rec.return_condition === 'Damaged' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                          Condition: {rec.return_condition}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 5: PROFILE & SETTINGS */}
          {currentView === 'Profile & Settings' && (
            <div className="animate-in fade-in duration-500 rounded-3xl border border-[#dce2db] bg-white p-6 sm:p-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#e5e6e0] pb-8">
                <div className="flex items-center gap-5">
                  <div className="grid size-20 place-items-center rounded-full bg-[#164e41] text-2xl font-bold text-[#d5f078]">{initials}</div>
                  <div>
                    <h3 className="text-2xl font-semibold text-[#202522]">{facultyName}</h3>
                    <p className="text-sm font-medium text-[#7b897f]">Faculty / Resource Owner (@{facultyEmail.split('@')[1] || 'pcu.edu.in'})</p>
                  </div>
                </div>
                <button 
                  onClick={() => onLogout ? onLogout() : setActive?.('Landing')} 
                  className="flex w-fit items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <LogOut size={16} />Log out
                </button>
              </div>
              <div className="mt-8 grid gap-10 lg:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-[#164e41] mb-5">Faculty Information</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Full Name</label>
                      <input type="text" readOnly defaultValue={facultyName} className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Official Email</label>
                      <input type="email" readOnly defaultValue={facultyEmail} className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-[#164e41] mb-5">Ownership Permissions</h4>
                  <div className="rounded-2xl bg-[#eaf0e9] p-4 text-xs text-[#164e41] leading-relaxed">
                    <p className="font-semibold mb-1">Resource & Booking Authority</p>
                    As authenticated Faculty, you hold authorization to list department resources, approve/reject student booking requests, and record return condition status. Modifications to other faculty resources are prohibited.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ADD RESOURCE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#164e41]/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-[#f7f6f2] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#164e41]">Add New Resource</h2>
              <button onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddResource} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#65736a] mb-1">Resource Name</label>
                <input required value={newRes.name} onChange={e => setNewRes({ ...newRes, name: e.target.value })} placeholder="e.g. 3D Printer Pro" className="w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#65736a] mb-1">Category</label>
                <select value={newRes.category} onChange={e => setNewRes({ ...newRes, category: e.target.value, type: e.target.value })} className="w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm">
                  <option>Equipment</option><option>Space</option><option>Lab</option><option>Robotics</option><option>Electronics</option><option>Media</option><option>Prototyping</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#65736a] mb-1">Location</label>
                <input required value={newRes.location} onChange={e => setNewRes({ ...newRes, location: e.target.value })} placeholder="e.g. Maker Space Bay 2" className="w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#65736a] mb-1">Description</label>
                <textarea required value={newRes.description} onChange={e => setNewRes({ ...newRes, description: e.target.value })} placeholder="Details and technical specifications..." className="w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm" />
              </div>
              <button type="submit" className="w-full rounded-full bg-[#164e41] py-3 text-sm font-medium text-white transition hover:bg-[#0f3b31]">
                Save Resource to Firestore
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONDITION REPORT MODAL */}
      {conditionModalItem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#164e41]/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-[#f7f6f2] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-[#164e41]">Record Return Condition</h2>
              <button onClick={() => setConditionModalItem(null)}><X size={18} /></button>
            </div>
            <p className="text-xs text-[#7b897f] mb-4">Item: {conditionModalItem.resource_name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#65736a] mb-1">Condition Status</label>
                <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm outline-none">
                  <option value="Good">Good</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#65736a] mb-1">Inspection & Damage Notes</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Minor scratches on surface or good condition" className="w-full rounded-xl border border-[#d6ded7] bg-white p-3 text-sm outline-none" />
              </div>
              <button onClick={() => handleReturnAction(conditionModalItem.id)} className="w-full rounded-full bg-[#164e41] py-3 text-sm font-medium text-white transition hover:bg-[#0f3b31]">
                Confirm & Record Return
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
