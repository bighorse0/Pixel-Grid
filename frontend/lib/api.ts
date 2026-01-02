import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// API functions
export const gridAPI = {
  checkAvailability: async (data: {
    x_start: number
    y_start: number
    width: number
    height: number
  }) => {
    const response = await api.post('/blocks/check-availability', data)
    return response.data
  },

  reserveBlock: async (data: {
    x_start: number
    y_start: number
    width: number
    height: number
    buyer_email?: string
    link_url: string
  }) => {
    const response = await api.post('/blocks/reserve', data)
    return response.data
  },

  uploadImage: async (
    blockId: string,
    editToken: string,
    imageFile: File,
    data: {
      link_url: string
      hover_title?: string
      hover_description?: string
      hover_cta?: string
    }
  ) => {
    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('edit_token', editToken)
    formData.append('link_url', data.link_url)
    if (data.hover_title) formData.append('hover_title', data.hover_title)
    if (data.hover_description) formData.append('hover_description', data.hover_description)
    if (data.hover_cta) formData.append('hover_cta', data.hover_cta)

    const response = await api.post(`/blocks/${blockId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  getGridState: async () => {
    const response = await api.get('/blocks/grid')
    return response.data
  },

  getBlock: async (blockId: string) => {
    const response = await api.get(`/blocks/${blockId}`)
    return response.data
  },
}

export const paymentsAPI = {
  createCheckoutSession: async (blockId: string) => {
    const response = await api.post(`/payments/${blockId}/checkout`)
    return response.data
  },

  completeTestPayment: async (blockId: string) => {
    const response = await api.post(`/payments/${blockId}/test-complete`)
    return response.data
  },

  getPaymentStatus: async (blockId: string) => {
    const response = await api.get(`/payments/${blockId}/status`)
    return response.data
  },
}

export const adminAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/admin/login', { email, password })
    return response.data
  },

  getMe: async () => {
    const response = await api.get('/admin/me')
    return response.data
  },
}

export const moderationAPI = {
  getPendingBlocks: async (skip = 0, limit = 20) => {
    const response = await api.get('/moderation/pending', {
      params: { skip, limit },
    })
    return response.data
  },

  decideBlock: async (blockId: string, decision: 'approve' | 'reject', reason?: string) => {
    const response = await api.post(`/moderation/${blockId}/decide`, {
      decision,
      reason,
    })
    return response.data
  },

  removeBlock: async (blockId: string, reason: string) => {
    const response = await api.post(`/moderation/${blockId}/remove`, null, {
      params: { reason },
    })
    return response.data
  },

  banDomain: async (domain: string, reason: string) => {
    const response = await api.post('/moderation/ban/domain', null, {
      params: { domain, reason },
    })
    return response.data
  },

  banImageHash: async (imageHash: string, reason: string) => {
    const response = await api.post('/moderation/ban/image-hash', null, {
      params: { image_hash: imageHash, reason },
    })
    return response.data
  },

  getBannedContent: async () => {
    const response = await api.get('/moderation/banned')
    return response.data
  },
}
