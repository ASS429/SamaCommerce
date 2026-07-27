import axios from 'axios'

// ⚠️ Sur un vrai téléphone (Expo Go), "localhost" pointe vers le téléphone, pas vers ton PC.
// Mets ici l'IP LAN de ta machine de dev (ex. http://192.168.1.10:8000/api).
//  - Émulateur Android : http://10.0.2.2:8000/api
//  - Web / iOS simulateur : http://localhost:8000/api
export const API_URL = 'http://192.168.1.10:8000/api'

let token: string | null = null

export const api = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function login(email: string, password: string) {
  const { data } = await api.post('/login', { email, password })
  token = data.token
  return data.user
}

export function logout() {
  token = null
}

export function isAuthed() {
  return token !== null
}

export const fcfa = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
