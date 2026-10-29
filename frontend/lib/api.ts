import { auth } from './firebase'
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
export const COLLEGE_DOMAIN = process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || 'pcu.edu.in'

const TOKEN_KEY = 'resourcex_auth_token'
const USER_KEY = 'resourcex_user_profile'

export function clearStoredToken() {
  if (typeof window === 'undefined') return
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(TOKEN_KEY)
    store.removeItem(USER_KEY)
  }
}

export async function validateAuthConfiguration() {
  const policy = await fetchApi<{ firebase_project_id: string }>('/api/auth/policy')
  if (policy.firebase_project_id !== auth.app.options.projectId) {
    throw new Error('Firebase project mismatch. Configure frontend and backend for the same Firebase project.')
  }
}

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  await auth.authStateReady()
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(options.headers || {})
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  
  try {
    const res = await fetch(url, {
      ...options,
      headers
    })

    if (!res.ok) {
      let errorMsg = `Request failed (${res.status})`
      try {
        const errJson = await res.json()
        errorMsg = Array.isArray(errJson.detail) ? errJson.detail.map((e: any) => e.msg).join('; ') : (errJson.detail || errJson.message || JSON.stringify(errJson))
      } catch {
        const text = await res.text()
        if (text) errorMsg = text
      }
      throw new Error(errorMsg)
    }

    // Check if empty response (e.g. 204 or delete)
    const contentType = res.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return (await res.json()) as T
    }
    return {} as T
  } catch (err: any) {
    console.error(`API Error [${endpoint}]:`, err.message)
    throw err
  }
}

// ----------------- Resources -----------------
export async function getResources(params?: {
  search?: string
  category?: string
  location?: string
  condition?: string
  status?: string
  owner_uid?: string
}) {
  const q = new URLSearchParams()
  if (params?.search) q.set('search', params.search)
  if (params?.category) q.set('category', params.category)
  if (params?.location) q.set('location', params.location)
  if (params?.condition) q.set('condition', params.condition)
  if (params?.status) q.set('status', params.status)
  if (params?.owner_uid) q.set('owner_uid', params.owner_uid)
  
  const queryStr = q.toString() ? `?${q.toString()}` : ''
  return fetchApi<any[]>(`/api/resources${queryStr}`)
}

export async function getResource(id: string) {
  return fetchApi<any>(`/api/resources/${id}`)
}

export async function createResource(data: any) {
  return fetchApi<any>('/api/resources', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateResource(id: string, data: any) {
  return fetchApi<any>(`/api/resources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export async function deleteResource(id: string) {
  return fetchApi<any>(`/api/resources/${id}`, {
    method: 'DELETE'
  })
}

// ----------------- Bookings -----------------
export async function getBookings(params?: {
  status?: string
  requester_uid?: string
  owner_uid?: string
  resource_id?: string
}) {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.requester_uid) q.set('requester_uid', params.requester_uid)
  if (params?.owner_uid) q.set('owner_uid', params.owner_uid)
  if (params?.resource_id) q.set('resource_id', params.resource_id)

  const queryStr = q.toString() ? `?${q.toString()}` : ''
  return fetchApi<any[]>(`/api/bookings${queryStr}`)
}

export async function createBooking(data: {
  resource_id: string
  start_time: string
  end_time: string
  purpose: string
}) {
  return fetchApi<any>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function approveBooking(id: string, notes?: string) {
  return fetchApi<any>(`/api/bookings/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes })
  })
}

export async function rejectBooking(id: string, reason?: string) {
  return fetchApi<any>(`/api/bookings/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  })
}

export async function cancelBooking(id: string) {
  return fetchApi<any>(`/api/bookings/${id}/cancel`, {
    method: 'POST'
  })
}

export async function checkoutBooking(id: string, notes?: string) {
  return fetchApi<any>(`/api/bookings/${id}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ notes })
  })
}

export async function returnBooking(id: string, data: { condition: string; damage_notes?: string }) {
  return fetchApi<any>(`/api/bookings/${id}/return`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ----------------- Returns -----------------
export async function getReturns() {
  return fetchApi<any[]>('/api/returns')
}

// ----------------- Users (Admin) -----------------
export async function getUsers(search?: string, role?: string) {
  const q = new URLSearchParams()
  if (search) q.set('search', search)
  if (role) q.set('role', role)
  const queryStr = q.toString() ? `?${q.toString()}` : ''
  return fetchApi<any[]>(`/api/users${queryStr}`)
}

export async function updateUserStatus(uid: string, status: 'Active' | 'Deactivated') {
  return fetchApi<any>(`/api/users/${uid}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}

// ----------------- Auth -----------------
export async function registerStudent(data: {
  name: string
  email: string
  password: string
  department?: string
}) {
  return fetchApi<any>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getCurrentUser() {
  return fetchApi<any>('/api/auth/me')
}
