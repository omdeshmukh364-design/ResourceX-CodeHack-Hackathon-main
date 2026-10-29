'use client'

import Logo from './Logo'

import { useState, useEffect } from 'react'
import {
  ArrowRight, Bell, CalendarDays, History, LayoutDashboard, 
  Users, Package, Search, Sparkles, User, Zap, LogOut, Lock, 
  Camera, Trash2, CheckCircle2, AlertCircle, X, ShieldAlert, Check, Menu
} from 'lucide-react'
import {
  getUsers,
  updateUserStatus,
  getResources,
  deleteResource,
  getBookings
} from '../lib/api'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'User Management', icon: Users },
  { label: 'Resource Management', icon: Package },
]



export default function AdminDashboard({ 
  active, 
  setActive,
  resources: initialResources,
  onRemoveResource,
  currentUser,
  onLogout,
  onRefreshResources
}: { 
  active: string; 
  setActive: (v: string) => void;
  resources: any[];
  onRemoveResource: (idOrName: string) => void;
  currentUser?: any;
  onLogout?: () => void;
  onRefreshResources?: () => void;
}) {
  const [users, setUsers] = useState<any[]>([])
  const [resources, setResources] = useState<any[]>(initialResources || [])
  const [bookings, setBookings] = useState<any[]>([])
  
  const [userSearch, setUserSearch] = useState('')
  const [resourceSearch, setResourceSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [actionMsg, setActionMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const validViews = ['Overview', 'User Management', 'Resource Management', 'Profile & Settings']
  const currentView = validViews.includes(active) ? active : 'Overview'

  const adminName = currentUser?.name || 'Admin User'
  const adminEmail = currentUser?.email || 'admin@pcu.edu.in'

  const fetchAdminData = async () => {
    try {
      const [userData, resData, bookData] = await Promise.all([
        getUsers(),
        getResources(),
        getBookings()
      ])
      if (userData) setUsers(userData)
      if (resData) setResources(resData)
      if (bookData) setBookings(bookData)
    } catch (err: any) {
      console.warn('Error fetching admin data:', err.message)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [])

  // Toggle User Status (Prevent admin self-deactivation)
  const handleToggleUserStatus = async (uid: string, email: string, currentStatus: string) => {
    if (uid === currentUser?.uid || email === adminEmail) {
      setErrorMsg('Safety check: You cannot deactivate your own admin account.')
      return
    }

    const nextStatus = currentStatus === 'Active' ? 'Deactivated' : 'Active'
    setErrorMsg('')
    try {
      await updateUserStatus(uid, nextStatus as 'Active' | 'Deactivated')
      setActionMsg(`User account status updated to ${nextStatus}.`)
      await fetchAdminData()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user status.')
    }
  }

  const handleDeleteResource = async (res: any) => {
    if (!confirm(`Are you sure you want to remove "${res.name}" as an Administrator?`)) return
    setErrorMsg('')
    try {
      await deleteResource(res.id)
      setActionMsg(`Listing "${res.name}" removed from platform.`)
      onRemoveResource(res.id)
      await fetchAdminData()
      if (onRefreshResources) onRefreshResources()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete resource.')
    }
  }

  // Filtered lists
  const filteredUsers = users.filter(u => 
    !userSearch || 
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  const filteredResources = resources.filter(r => {
    const matchesSearch = !resourceSearch || r.name?.toLowerCase().includes(resourceSearch.toLowerCase()) || (r.category && r.category.toLowerCase().includes(resourceSearch.toLowerCase()))
    const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter || r.type === categoryFilter
    return matchesSearch && matchesCategory
  })

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
              AD
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

          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a988d]">System Administration (@{adminEmail.split('@')[1] || 'pcu.edu.in'})</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.05em] text-[#164e41]">
              {currentView === 'Overview' ? 'Welcome back, Administrator.' : currentView}
            </h1>
          </div>

          {/* VIEW 1: OVERVIEW */}
          {currentView === 'Overview' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#164e41] p-6 text-white">
                  <p className="text-xs text-[#b9cfbf]">Total Users</p>
                  <p className="mt-5 text-3xl font-semibold">{String(users.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#b9cfbf]">Registered campus members</p>
                </div>
                <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                  <p className="text-xs text-[#89978e]">Total Resources</p>
                  <p className="mt-5 text-3xl font-semibold text-[#164e41]">{String(resources.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#89978e]">Active listings</p>
                </div>
                <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                  <p className="text-xs text-[#89978e]">Total Bookings</p>
                  <p className="mt-5 text-3xl font-semibold text-[#164e41]">{String(bookings.length).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-[#89978e]">Processed requests</p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid gap-4 sm:grid-cols-2">
                <button onClick={() => setActive('User Management')} className="flex items-center justify-between rounded-2xl border border-[#dce2db] bg-white p-6 text-left transition hover:border-[#164e41]">
                  <div>
                    <h3 className="font-semibold text-[#164e41]">Manage Users</h3>
                    <p className="text-xs text-[#7b897f] mt-1">Audit accounts, change activation status, and enforce domain policy.</p>
                  </div>
                  <ArrowRight size={18} className="text-[#164e41]" />
                </button>
                <button onClick={() => setActive('Resource Management')} className="flex items-center justify-between rounded-2xl border border-[#dce2db] bg-white p-6 text-left transition hover:border-[#164e41]">
                  <div>
                    <h3 className="font-semibold text-[#164e41]">Manage Resources</h3>
                    <p className="text-xs text-[#7b897f] mt-1">Audit all active platform listings, equipment, and lab reservations.</p>
                  </div>
                  <ArrowRight size={18} className="text-[#164e41]" />
                </button>
              </div>

              {/* Recent Platform Activity */}
              <div className="rounded-2xl border border-[#dce2db] bg-white p-6">
                <div className="flex items-center gap-2 text-[#164e41] mb-4">
                  <History size={18} />
                  <h2 className="font-semibold">Recent Platform Activity</h2>
                </div>
                <div className="space-y-4">
                  {[
                    ['Domain Restriction Enforced', `Exclusively allowing @${adminEmail.split('@')[1] || 'pcu.edu.in'}`],
                    ['Firestore Security Rules', 'Read/write permissions synchronized with Firebase Auth'],
                    ['Concurrency Control Active', 'Resource lock prevention prevents simultaneous double-bookings'],
                    ['FastAPI Backend Integrated', 'Modular REST routers handling users, resources, bookings, and returns']
                  ].map(([title, detail]) => (
                    <div key={title} className="flex gap-3">
                      <span className="mt-1 size-2 rounded-full bg-[#9eb5a6]" />
                      <div>
                        <p className="text-sm font-medium text-[#164e41]">{title}</p>
                        <p className="mt-0.5 text-xs text-[#7b897f]">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: USER MANAGEMENT */}
          {currentView === 'User Management' && (
            <div className="animate-in fade-in duration-500 space-y-6">
              <div className="flex items-center gap-3 rounded-2xl border border-[#d7ddd6] bg-white px-4 py-3 shadow-sm">
                <Search size={19} className="text-[#164e41]" />
                <input 
                  value={userSearch} 
                  onChange={e => setUserSearch(e.target.value)} 
                  placeholder="Search users by name or email..." 
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#96a09a]" 
                />
              </div>

              <div className="rounded-2xl border border-[#dce2db] bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-[#68756c]">
                  <thead className="bg-[#f7f6f2] text-xs uppercase text-[#8a988d]">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Name</th>
                      <th className="px-6 py-4 font-semibold">Email</th>
                      <th className="px-6 py-4 font-semibold">Role</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e6e0]">
                    {filteredUsers.map(user => (
                      <tr key={user.uid || user.id}>
                        <td className="px-6 py-4 font-medium text-[#202522]">{user.name}</td>
                        <td className="px-6 py-4">{user.email}</td>
                        <td className="px-6 py-4 capitalize">
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-[#164e41]">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === 'Active' ? 'bg-[#d5f078] text-[#164e41]' : 'bg-red-50 text-red-700'}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleToggleUserStatus(user.uid || user.id, user.email, user.status)} 
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${user.status === 'Active' ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'bg-[#164e41] text-white hover:bg-[#0f3b31]'}`}
                          >
                            {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: RESOURCE MANAGEMENT */}
          {currentView === 'Resource Management' && (
            <div className="animate-in fade-in duration-500 space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-3 rounded-2xl border border-[#d7ddd6] bg-white px-4 py-3 shadow-sm flex-1">
                  <Search size={19} className="text-[#164e41]" />
                  <input 
                    value={resourceSearch} 
                    onChange={e => setResourceSearch(e.target.value)} 
                    placeholder="Search all platform resources..." 
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#96a09a]" 
                  />
                </div>
                <select 
                  value={categoryFilter} 
                  onChange={e => setCategoryFilter(e.target.value)} 
                  className="rounded-2xl border border-[#d7ddd6] bg-white px-4 py-3 text-sm outline-none text-[#164e41]"
                >
                  <option value="All">All Categories</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Space">Space</option>
                  <option value="Lab">Lab</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Robotics">Robotics</option>
                  <option value="Media">Media</option>
                  <option value="Prototyping">Prototyping</option>
                </select>
              </div>

              <div className="rounded-2xl border border-[#dce2db] bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-[#68756c]">
                  <thead className="bg-[#f7f6f2] text-xs uppercase text-[#8a988d]">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Resource Name</th>
                      <th className="px-6 py-4 font-semibold">Category</th>
                      <th className="px-6 py-4 font-semibold">Location</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e6e0]">
                    {filteredResources.map(res => (
                      <tr key={res.id || res.name}>
                        <td className="px-6 py-4 font-medium text-[#202522]">{res.name}</td>
                        <td className="px-6 py-4">{res.type || res.category || 'Equipment'}</td>
                        <td className="px-6 py-4">{res.location}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#dce8df] px-2.5 py-1 text-xs font-semibold text-[#164e41]">
                            {res.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteResource(res)} 
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            Remove Listing
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 4: PROFILE & SETTINGS */}
          {currentView === 'Profile & Settings' && (
            <div className="animate-in fade-in duration-500 rounded-3xl border border-[#dce2db] bg-white p-6 sm:p-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#e5e6e0] pb-8">
                <div className="flex items-center gap-5">
                  <div className="grid size-20 place-items-center rounded-full bg-[#164e41] text-2xl font-bold text-[#d5f078]">AD</div>
                  <div>
                    <h3 className="text-2xl font-semibold text-[#202522]">{adminName}</h3>
                    <p className="text-sm font-medium text-[#7b897f]">System Administrator (@{adminEmail.split('@')[1] || 'pcu.edu.in'})</p>
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
                  <h4 className="font-semibold text-[#164e41] mb-5">Administrator Details</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Full Name</label>
                      <input type="text" readOnly defaultValue={adminName} className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#65736a]">Official Email</label>
                      <input type="email" readOnly defaultValue={adminEmail} className="w-full rounded-xl border border-[#d6ded7] bg-[#f7f6f2] p-3 text-sm outline-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-[#164e41] mb-5">System Scope</h4>
                  <div className="rounded-2xl bg-[#eaf0e9] p-4 text-xs text-[#164e41] leading-relaxed">
                    <p className="font-semibold mb-1">Root Oversight</p>
                    Full operational control across users, active resources, and scheduled bookings. Privilege escalation by unauthenticated clients is strictly rejected.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  )
}
