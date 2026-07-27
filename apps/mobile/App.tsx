import { useEffect, useState } from 'react'
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { api, login, logout, fcfa } from './lib/api'

const BRAND = '#0a7d4d'

type Product = {
  id: number; name: string; base_unit: string; stock: number
  units: { id: number; name: string; sale_price: number | null }[]
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      {authed
        ? <Dashboard onLogout={() => { logout(); setAuthed(false) }} />
        : <Login onLogin={() => setAuthed(true)} />}
    </View>
  )
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('demo@samacommerce.sn')
  const [password, setPassword] = useState('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setLoading(true); setError('')
    try { await login(email, password); onLogin() }
    catch { setError('Identifiants incorrects.') }
    finally { setLoading(false) }
  }

  return (
    <View style={styles.center}>
      <Text style={styles.logo}>SamaCommerce</Text>
      <Text style={styles.subtitle}>Gestion commerciale</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" placeholder="Email" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword}
        secureTextEntry placeholder="Mot de passe" />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Se connecter</Text>}
      </TouchableOpacity>
    </View>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/stats/dashboard'), api.get('/products')])
      .then(([s, p]) => { setStats(s.data); setProducts(p.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator color={BRAND} size="large" /></View>

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SamaCommerce</Text>
          <Text style={styles.headerSub}>Tableau de bord</Text>
        </View>
        <TouchableOpacity onPress={onLogout}><Text style={styles.logout}>Quitter</Text></TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <Stat label="CA du jour" value={fcfa(stats.ca_today)} bg="#ecfdf3" fg="#15803d" />
        <Stat label="Crédits dus" value={fcfa(stats.credits_due)} bg="#fffbeb" fg="#b45309" />
      </View>

      <Text style={styles.sectionTitle}>Stock (en unité de base)</Text>
      {products.map((p) => (
        <View key={p.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.productName}>{p.name}</Text>
            <Text style={styles.stock}>{p.stock} {p.base_unit}</Text>
          </View>
          <View style={styles.chips}>
            {p.units.map((u) => (
              <Text key={u.id} style={styles.chip}>
                {u.name}{u.sale_price ? ` · ${fcfa(u.sale_price)}` : ' · achat'}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function Stat({ label, value, bg, fg }: { label: string; value: string; bg: string; fg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color: fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: fg }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f7f9' },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  scroll: { padding: 16, paddingTop: 56 },
  logo: { fontSize: 28, fontWeight: 'bold', color: BRAND, textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#6b7280', marginBottom: 24 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 },
  error: { color: '#dc2626', marginBottom: 8 },
  button: { backgroundColor: BRAND, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: BRAND },
  headerSub: { color: '#6b7280', fontSize: 13 },
  logout: { color: '#6b7280' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 12, padding: 16 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12 },
  sectionTitle: { fontWeight: '600', marginBottom: 10, fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontWeight: '600', fontSize: 15 },
  stock: { fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: '#f1f3f5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, color: '#374151' },
})
