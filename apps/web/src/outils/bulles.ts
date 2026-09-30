/* Bulles de notification + confirmation et saisie stylées (fondées sur le DOM,
 * utilisables partout).
 *
 * SÉCURITÉ (S1) : aucun message n'est jamais injecté via innerHTML. Tout texte
 * fourni (potentiellement un nom de produit ou de client renvoyé par l'API)
 * passe par `textContent`, ce qui neutralise toute charge XSS
 * (`<img src=x onerror=…>`). La structure DOM est bâtie par createElement ;
 * seul le contenu statique (icônes, mise en page) est écrit par nos soins. */

function conteneur(): HTMLElement {
  let c = document.querySelector<HTMLElement>('.bulles-conteneur')
  if (!c) {
    c = document.createElement('div')
    c.className = 'bulles-conteneur'
    // Accessibilité : les bulles sont annoncées aux lecteurs d'écran.
    c.setAttribute('role', 'status')
    c.setAttribute('aria-live', 'polite')
    c.setAttribute('aria-atomic', 'false')
    document.body.appendChild(c)
  }
  return c
}

/* La valeur sert aussi de classe CSS (`.bulle.succes`). */
type TypeBulle = 'succes' | 'erreur' | 'info'
type OptionsBulle = {
  duree?: number
  /** Action « Annuler » : bouton affiché à droite de la bulle. */
  action?: { libelle: string; surClic: () => void }
}

export function bulle(message: string, type: TypeBulle = 'succes', options: OptionsBulle = {}) {
  const duree = options.duree ?? (type === 'erreur' ? 3800 : 2600)
  const element = document.createElement('div')
  element.className = `bulle ${type}`

  // Icône (statique — sûr).
  const icone = document.createElement('span')
  icone.className = 'bulle-icone'
  icone.textContent = type === 'succes' ? '✅' : type === 'erreur' ? '⛔' : 'ℹ️'
  icone.setAttribute('aria-hidden', 'true')

  // Message (données utilisateur — TOUJOURS via textContent).
  const texte = document.createElement('span')
  texte.className = 'bulle-message'
  texte.textContent = message

  element.appendChild(icone)
  element.appendChild(texte)

  let minuterie: ReturnType<typeof setTimeout> | undefined
  const fermer = () => {
    if (minuterie) clearTimeout(minuterie)
    element.classList.add('sortie')
    setTimeout(() => element.remove(), 250)
  }

  // Action « Annuler » facultative (annulation d'une suppression, cf. 3.6).
  if (options.action) {
    const bouton = document.createElement('button')
    bouton.className = 'bulle-action'
    bouton.type = 'button'
    bouton.textContent = options.action.libelle
    bouton.addEventListener('click', () => {
      options.action!.surClic()
      fermer()
    })
    element.appendChild(bouton)
  }

  // Barre de progression de la fermeture automatique.
  const barre = document.createElement('div')
  barre.className = 'bulle-progression'
  barre.style.animationDuration = `${duree}ms`
  element.appendChild(barre)

  conteneur().appendChild(element)
  minuterie = setTimeout(fermer, duree)
  return fermer
}

/** Confirmation stylée — renvoie une Promise<boolean>. */
export function demanderConfirmation(message: string, libelleValider = 'Confirmer'): Promise<boolean> {
  return new Promise((resoudre) => {
    const calque = document.createElement('div')
    calque.className = 'fenetre-calque'

    const boite = document.createElement('div')
    boite.className = 'fenetre-boite'
    boite.style.maxWidth = '360px'
    boite.setAttribute('role', 'alertdialog')
    boite.setAttribute('aria-modal', 'true')

    const titre = document.createElement('div')
    titre.className = 'fenetre-titre'
    titre.textContent = 'Confirmer'

    const p = document.createElement('p')
    p.style.cssText = 'text-align:center;color:var(--attenue);font-size:14px;margin-bottom:4px'
    p.textContent = message // ← données utilisateur, jamais innerHTML

    const actions = document.createElement('div')
    actions.className = 'fenetre-actions'
    const boutonNon = document.createElement('button')
    boutonNon.className = 'bouton-annuler'
    boutonNon.type = 'button'
    boutonNon.textContent = 'Annuler'
    const boutonOui = document.createElement('button')
    boutonOui.className = 'bouton-valider'
    boutonOui.type = 'button'
    boutonOui.textContent = libelleValider
    actions.append(boutonNon, boutonOui)

    boite.append(titre, p, actions)
    calque.appendChild(boite)

    const fermer = (reponse: boolean) => { calque.remove(); document.removeEventListener('keydown', surTouche); resoudre(reponse) }
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(false) }
    calque.addEventListener('click', (e) => { if (e.target === calque) fermer(false) })
    boutonNon.addEventListener('click', () => fermer(false))
    boutonOui.addEventListener('click', () => fermer(true))
    document.addEventListener('keydown', surTouche)
    document.body.appendChild(calque)
    setTimeout(() => boutonOui.focus(), 50)
  })
}

/**
 * Saisie stylée — renvoie une Promise<string|null>. `numerique` affiche le
 * pavé de chiffres du téléphone (codes reçus par e-mail).
 */
export function demanderSaisie(message: string, indication = '', initial = '', numerique = false): Promise<string | null> {
  return new Promise((resoudre) => {
    const calque = document.createElement('div')
    calque.className = 'fenetre-calque'

    const boite = document.createElement('div')
    boite.className = 'fenetre-boite'
    boite.style.maxWidth = '360px'
    boite.setAttribute('role', 'dialog')
    boite.setAttribute('aria-modal', 'true')

    const titre = document.createElement('div')
    titre.className = 'fenetre-titre'
    titre.textContent = message // ← données utilisateur, jamais innerHTML

    const groupe = document.createElement('div')
    groupe.className = 'groupe-champ'
    const champ = document.createElement('input')
    champ.placeholder = indication // les attributs du DOM ne sont pas exécutables
    champ.value = initial
    if (numerique) { champ.inputMode = 'numeric'; champ.autocomplete = 'one-time-code' }
    groupe.appendChild(champ)

    const actions = document.createElement('div')
    actions.className = 'fenetre-actions'
    const boutonNon = document.createElement('button')
    boutonNon.className = 'bouton-annuler'
    boutonNon.type = 'button'
    boutonNon.textContent = 'Annuler'
    const boutonOui = document.createElement('button')
    boutonOui.className = 'bouton-valider'
    boutonOui.type = 'button'
    boutonOui.textContent = 'Valider'
    actions.append(boutonNon, boutonOui)

    boite.append(titre, groupe, actions)
    calque.appendChild(boite)

    const fermer = (reponse: string | null) => { calque.remove(); document.removeEventListener('keydown', surTouche); resoudre(reponse) }
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer(null)
      if (e.key === 'Enter') fermer(champ.value)
    }
    calque.addEventListener('click', (e) => { if (e.target === calque) fermer(null) })
    boutonNon.addEventListener('click', () => fermer(null))
    boutonOui.addEventListener('click', () => fermer(champ.value))
    document.addEventListener('keydown', surTouche)
    document.body.appendChild(calque)
    setTimeout(() => champ.focus(), 50)
  })
}
