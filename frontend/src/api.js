
import axios from 'axios'

const api = axios.create({
 baseURL: import.meta.env.VITE_API_URL || 'https://dataguard-dlp.onrender.com/api'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dataguard_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api
