import { useEffect, useState } from 'react'
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  connecter, deconnecter, fcfa, messageErreur, Produits, Statistiques, stockLisible, verifierDoubleFacteur,
  type Produit, type ResumeJour,
} from './outils/api'

const MARQUE = '#0a7d4d'

export default function Application() {
  const [connecte, definirConnecte] = useState(false)
  return (
    <View style={styles.plein}>
      <StatusBar style="light" />
      {connecte
        ? <TableauDeBord surDeconnexion={async () => { await deconnecter(); definirConnecte(false) }} />
        : <Connexion surConnexion={() => definirConnecte(true)} />}
    </View>
  )
}

function Connexion({ surConnexion }: { surConnexion: () => void }) {
  // Compte de démonstration pré-rempli en développement seulement.
  const [identifiant, definirIdentifiant] = useState(__DEV__ ? 'demo@samacommerce.sn' : '')
  const [motDePasse, definirMotDePasse] = useState(__DEV__ ? 'password' : '')
  /** Renseigné quand le compte exige un code à usage unique (double facteur). */
  const [codeAttendu, definirCodeAttendu] = useState(false)
  const [code, definirCode] = useState('')
  const [chargement, definirChargement] = useState(false)
  const [erreur, definirErreur] = useState('')

  const valider = async () => {
    definirChargement(true); definirErreur('')
    try {
      if (codeAttendu) {
        await verifierDoubleFacteur(identifiant, code)
        surConnexion()
      } else {
        const resultat = await connecter(identifiant, motDePasse)
        if ('double_facteur_requis' in resultat) {
          definirCodeAttendu(true)
          // Ne jamais laisser croire qu'un code est parti quand le serveur dit le contraire.
          if (resultat.envoye === false) definirErreur(resultat.message || 'Le code n\'a pas pu être envoyé.')
        } else surConnexion()
      }
    } catch (e) {
      definirErreur(messageErreur(e, codeAttendu ? 'Code invalide.' : 'Identifiants incorrects.'))
    } finally {
      definirChargement(false)
    }
  }

  return (
    <View style={styles.centre}>
      <Text style={styles.logo}>SamaCommerce</Text>
      <Text style={styles.sousTitre}>Gestion commerciale</Text>
      {codeAttendu ? (
        <>
          <Text style={styles.consigne}>🔐 Vérification en 2 étapes — saisissez le code à 6 chiffres.</Text>
          <TextInput style={styles.champ} value={code} onChangeText={definirCode}
            keyboardType="number-pad" maxLength={6} placeholder="Code" />
        </>
      ) : (
        <>
          <TextInput style={styles.champ} value={identifiant} onChangeText={definirIdentifiant}
            autoCapitalize="none" keyboardType="email-address" placeholder="E-mail ou identifiant" />
          <TextInput style={styles.champ} value={motDePasse} onChangeText={definirMotDePasse}
            secureTextEntry placeholder="Mot de passe" />
        </>
      )}
      {!!erreur && <Text style={styles.erreur}>{erreur}</Text>}
      <TouchableOpacity style={styles.bouton} onPress={valider} disabled={chargement}>
        {chargement
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.texteBouton}>{codeAttendu ? 'Valider le code' : 'Se connecter'}</Text>}
      </TouchableOpacity>
    </View>
  )
}

function TableauDeBord({ surDeconnexion }: { surDeconnexion: () => void }) {
  const [resume, definirResume] = useState<ResumeJour | null>(null)
  const [produits, definirProduits] = useState<Produit[]>([])
  const [chargement, definirChargement] = useState(true)
  const [erreur, definirErreur] = useState('')

  useEffect(() => {
    Promise.all([Statistiques.resumeJour(), Produits.lister()])
      .then(([r, p]) => { definirResume(r); definirProduits(p) })
      // Un écran vide ne doit jamais faire croire que la boutique est vide.
      .catch((e) => definirErreur(messageErreur(e, 'Impossible de charger le tableau de bord.')))
      .finally(() => definirChargement(false))
  }, [])

  if (chargement) return <View style={styles.centre}><ActivityIndicator color={MARQUE} size="large" /></View>

  /** « — » quand l'employé n'a pas le droit de voir ce chiffre. */
  const chiffre = (n: number | null | undefined, format: (n: number) => string) => (n == null ? '—' : format(n))

  return (
    <ScrollView contentContainerStyle={styles.defilement}>
      <View style={styles.entete}>
        <View>
          <Text style={styles.titreEntete}>SamaCommerce</Text>
          <Text style={styles.sousTitreEntete}>Tableau de bord</Text>
        </View>
        <TouchableOpacity onPress={surDeconnexion}><Text style={styles.quitter}>Quitter</Text></TouchableOpacity>
      </View>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : (
        <>
          <View style={styles.rangeeChiffres}>
            <Chiffre libelle="CA du jour" valeur={chiffre(resume?.ca, fcfa)} fond="#ecfdf3" couleur="#15803d" />
            <Chiffre libelle="Articles vendus" valeur={chiffre(resume?.articles, String)} fond="#eff6ff" couleur="#1d4ed8" />
          </View>

          <Text style={styles.titreSection}>Stock</Text>
          {produits.map((p) => (
            <View key={p.id} style={styles.carte}>
              <View style={styles.ligneCarte}>
                <Text style={styles.nomProduit}>{p.nom}</Text>
                <Text style={styles.stock}>{stockLisible(p)}</Text>
              </View>
              {!!p.conditionnements?.length && (
                <View style={styles.pastilles}>
                  {p.conditionnements.map((c) => (
                    <Text key={c.id} style={styles.pastille}>{c.libelle} · {fcfa(c.prix)}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}

function Chiffre({ libelle, valeur, fond, couleur }: { libelle: string; valeur: string; fond: string; couleur: string }) {
  return (
    <View style={[styles.carteChiffre, { backgroundColor: fond }]}>
      <Text style={[styles.valeurChiffre, { color: couleur }]}>{valeur}</Text>
      <Text style={[styles.libelleChiffre, { color: couleur }]}>{libelle}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: '#f5f7f9' },
  centre: { flex: 1, justifyContent: 'center', padding: 24 },
  defilement: { padding: 16, paddingTop: 56 },
  logo: { fontSize: 28, fontWeight: 'bold', color: MARQUE, textAlign: 'center' },
  sousTitre: { textAlign: 'center', color: '#6b7280', marginBottom: 24 },
  consigne: { textAlign: 'center', color: '#374151', marginBottom: 12 },
  champ: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 },
  erreur: { color: '#dc2626', marginBottom: 8 },
  bouton: { backgroundColor: MARQUE, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  texteBouton: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titreEntete: { fontSize: 20, fontWeight: 'bold', color: MARQUE },
  sousTitreEntete: { color: '#6b7280', fontSize: 13 },
  quitter: { color: '#6b7280' },
  rangeeChiffres: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  carteChiffre: { flex: 1, borderRadius: 12, padding: 16 },
  valeurChiffre: { fontSize: 18, fontWeight: 'bold' },
  libelleChiffre: { fontSize: 12 },
  titreSection: { fontWeight: '600', marginBottom: 10, fontSize: 15 },
  carte: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  ligneCarte: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nomProduit: { fontWeight: '600', fontSize: 15 },
  stock: { fontWeight: '500' },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pastille: { backgroundColor: '#f1f3f5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, color: '#374151' },
})
