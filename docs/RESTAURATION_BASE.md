# Restaurer la base de données

À lire **avant** d'en avoir besoin. Le jour d'un incident, on n'a ni le temps
ni le calme d'improviser.

## Ce qui est sauvegardé

Le workflow [`.github/workflows/sauvegarde-base.yml`](../.github/workflows/sauvegarde-base.yml)
produit chaque nuit (02h17 UTC) un export complet de la base de production,
**chiffré en AES256**, publié comme artefact GitHub et conservé **90 jours**.

Le dépôt étant public, l'archive est chiffrée : sans la phrase secrète
`BACKUP_PASSPHRASE`, elle est inexploitable — **y compris par vous**.

> ⚠️ Conservez `BACKUP_PASSPHRASE` ailleurs que dans GitHub (gestionnaire de
> mots de passe, papier en lieu sûr). Si vous la perdez, les 90 jours de
> sauvegardes deviennent définitivement illisibles.

Chaque sauvegarde n'est publiée qu'après trois contrôles : taille minimale,
présence des tables métier (`utilisateurs`, `produits`, `ventes`, `clients`,
`boutiques`), et **déchiffrement de contrôle**. Un export vide ou corrompu fait
échouer le job au lieu d'être publié — on ne découvre pas le problème le jour
du sinistre.

## Récupérer une sauvegarde

1. Onglet **Actions** du dépôt → workflow **« Sauvegarde base »**.
2. Ouvrir l'exécution de la date voulue.
3. Section **Artifacts** → télécharger `base-AAAA-MM-JJ_HHhMM`.
4. Dézipper : vous obtenez `samacommerce_AAAA-MM-JJ_HHhMM.sql.gpg`.

> **Sauvegarde d'avant octobre 2026 ?** Le fichier du workflow s'appelait alors
> `backup.yml`. GitHub range ses exécutions sous cet ancien nom : elles
> n'apparaissent plus sous « Sauvegarde base », mais restent dans
> **All workflows** (toutes les exécutions), jusqu'à expiration des 90 jours.

## Déchiffrer

```bash
gpg --batch --decrypt \
  --passphrase 'VOTRE_PHRASE_SECRETE' \
  --output base.sql \
  samacommerce_2026-08-27_02h17.sql.gpg
```

Vérifiez avant d'aller plus loin :

```bash
grep -c 'CREATE TABLE' base.sql   # doit renvoyer une vingtaine de tables
# pg_dump écrit les lignes en bloc (COPY … FROM stdin), pas en INSERT :
# on compte les lignes entre l'en-tête du bloc et sa fin « \. ».
awk '/^COPY public\.ventes /{dedans=1; next} /^\\\.$/{dedans=0} dedans' base.sql | wc -l   # vos ventes sont là
```

## Restaurer

> ⛔ **Ne restaurez JAMAIS directement par-dessus la production** sans avoir
> d'abord fait un export de l'état actuel — même abîmé. Une restauration écrase :
> si le diagnostic était faux, vous perdez ce qui restait.

### 1. Sauvegarder l'état actuel, quel qu'il soit

Lancez manuellement le workflow (**Actions → Sauvegarde base → Run workflow**)
avant toute manipulation.

### 2. Restaurer dans une base NEUVE

Créez un nouveau projet Supabase (ou une base vide), puis :

```bash
psql "postgresql://…nouvelle-base…" -v ON_ERROR_STOP=1 -f base.sql
```

`ON_ERROR_STOP=1` est important : sans lui, `psql` continue après une erreur et
vous laisse une base à moitié restaurée en croyant que tout s'est bien passé.

### 3. Vérifier avant de basculer

```sql
SELECT count(*) FROM ventes;      -- comparez à ce que vous attendez
SELECT count(*) FROM produits;
SELECT max(cree_le) FROM ventes;  -- jusqu'où va la sauvegarde ?
```

> **Sauvegarde antérieure au 29 septembre 2026 ?** Elle porte les anciens noms
> anglais (`sales`, `products`, `created_at`…) : remplacez-les dans les
> requêtes ci-dessus. Pas d'autre précaution — au premier démarrage sur cette
> base, l'API reconnaît ses migrations et la traduit elle-même en français
> (migration `franciser_le_schema`, testée dans les deux sens).

### 4. Basculer l'application

Dans Render → service API → variable `DB_URL` → chaîne de la nouvelle base
(**Session pooler**, pas Direct connection : voir `DEPLOIEMENT.md`). Le service
redémarre et applique les migrations automatiquement.

## Ce que la sauvegarde ne couvre PAS

- **Les ventes faites entre le dernier export et l'incident.** Au pire 24 h de
  perte. Les ventes encore en file hors-ligne sur les téléphones remonteront
  d'elles-mêmes au retour du réseau.
- **Les schémas internes de Supabase** (`auth`, `storage`, `supabase_*`), exclus
  volontairement : ils appartiennent à la plateforme et se recréent seuls.

## Tester la procédure

Une sauvegarde jamais restaurée n'est pas une sauvegarde. **Une fois par
trimestre**, déroulez les étapes 1 à 3 sur une base jetable. Le test doit
répondre à une seule question : *combien de temps me faut-il pour repartir ?*
