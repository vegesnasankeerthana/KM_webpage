import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL + '/api'
    : 'https://km-webpage-backend.onrender.com/api',
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('API error:', err?.response?.data || err.message)
    return Promise.reject(err)
  }
)

export default api
