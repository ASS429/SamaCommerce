<?php

namespace Tests\Contrat;

/**
 * ARCHIVE DE TEST — le contrat de l'API tel qu'il était AVANT la francisation
 * (noms anglais des adresses, des champs et des valeurs).
 *
 * Jusqu'au 01/10/2026, ces tables traduisaient au vol les appels des
 * téléphones restés sur l'ancienne version (couche de compatibilité, retirée à
 * l'étape 5 du glossaire). Elles ne servent plus qu'à ContratFrancaisTest, qui
 * rejoue le scénario enregistré avant la francisation sur les adresses
 * françaises : c'est la preuve durable que la traduction n'a changé aucune
 * règle métier. Les noms anglais ci-dessous SONT l'ancien contrat.
 */
final class AncienContrat
{
    /**
     * Ancienne adresse => nouvelle adresse (sans le préfixe « api/ » ni « v1/ »).
     * Une adresse identique dans les deux langues était PARTAGÉE : l'en-tête
     * X-Contrat-Api départageait alors les deux formats.
     */
    public const ADRESSES = [
        'health' => 'sante',
        'auth/register' => 'auth/inscription',
        'auth/login' => 'auth/connexion',
        'auth/forgot-password' => 'auth/mot-de-passe-oublie',
        'auth/reset-password' => 'auth/reinitialiser-mot-de-passe',
        'auth/verify-2fa' => 'auth/verifier-double-facteur',
        'members/invite/{token}' => 'membres/invitation/{jeton}',
        'client-errors' => 'erreurs-navigateur',
        'auth/me' => 'auth/moi',
        'auth/logout' => 'auth/deconnexion',
        'auth/logout-all' => 'auth/deconnexion-partout',
        'auth/profile' => 'auth/profil',
        'auth/preferences' => 'auth/preferences',
        'auth/upgrade' => 'auth/passage-premium',
        'auth/2fa' => 'auth/double-facteur',
        'boutiques' => 'boutiques',
        'boutiques/dashboard' => 'boutiques/tableau-de-bord',
        'boutiques/{id}/switch' => 'boutiques/{id}/activer',
        'boutiques/{id}/stats' => 'boutiques/{id}/statistiques',
        'boutiques/{id}' => 'boutiques/{id}',
        'activity' => 'activite',
        'ia/reappro' => 'ia/reappro',
        'ia/credit-score' => 'ia/score-credit',
        'members' => 'membres',
        'members/invite' => 'membres/inviter',
        'members/accept' => 'membres/accepter',
        'members/my-boutique' => 'membres/ma-boutique',
        'members/{id}' => 'membres/{id}',
        'products' => 'produits',
        'products/trash' => 'produits/corbeille',
        'products/{id}' => 'produits/{id}',
        'products/{id}/restore' => 'produits/{id}/restaurer',
        'categories' => 'categories',
        'categories/{id}' => 'categories/{id}',
        'sales' => 'ventes',
        'sales/trash' => 'ventes/corbeille',
        'sales/sync' => 'ventes/synchroniser',
        'sales/{id}/restore' => 'ventes/{id}/restaurer',
        'sales/{id}' => 'ventes/{id}',
        'tontines' => 'tontines',
        'clients/for-sale' => 'clients/pour-vente',
        'clients' => 'clients',
        'clients/{id}' => 'clients/{id}',
        'clients/{id}/stats' => 'clients/{id}/statistiques',
        'commandes' => 'commandes',
        'commandes/{id}' => 'commandes/{id}',
        'commandes/{id}/recevoir' => 'commandes/{id}/recevoir',
        'livraisons' => 'livraisons',
        'livraisons/{id}' => 'livraisons/{id}',
        'returns' => 'retours',
        'returns/stats' => 'retours/statistiques',
        'caisse/today' => 'caisse/aujourdhui',
        'caisse/history' => 'caisse/historique',
        'caisse/weekly' => 'caisse/semaine',
        'caisse/close' => 'caisse/cloturer',
        'fournisseurs' => 'fournisseurs',
        'fournisseurs/{id}/reappro-message' => 'fournisseurs/{id}/message-reappro',
        'fournisseurs/{id}' => 'fournisseurs/{id}',
        'stats/resume-jour' => 'statistiques/resume-jour',
        'stats/ventes-par-categorie' => 'statistiques/ventes-par-categorie',
        'stats/ventes-par-jour' => 'statistiques/ventes-par-jour',
        'stats/paiements' => 'statistiques/paiements',
        'stats/top-produits' => 'statistiques/meilleurs-produits',
        'stats/stock-faible' => 'statistiques/stock-faible',
        'stats/marge-categorie' => 'statistiques/marge-categorie',
        'stats/rotation-stock' => 'statistiques/rotation-stock',
        'stats/meilleurs-clients' => 'statistiques/meilleurs-clients',
        'stats/marchandage' => 'statistiques/marchandage',
        'auth/users' => 'admin/utilisateurs',
        'auth/users/{id}/block' => 'admin/utilisateurs/{id}/bloquer',
        'auth/users/{id}/activate' => 'admin/utilisateurs/{id}/activer',
        'auth/users/{id}' => 'admin/utilisateurs/{id}',
        'auth/users/{id}/reminder' => 'admin/utilisateurs/{id}/relancer',
        'auth/upgrade/{id}/approve' => 'admin/passages-premium/{id}/valider',
        'auth/upgrade/{id}/reject' => 'admin/passages-premium/{id}/refuser',
        'admin-stats/overview' => 'admin/statistiques/vue-ensemble',
        'admin-stats/revenus/evolution' => 'admin/statistiques/revenus/evolution',
        'admin-stats/revenus' => 'admin/statistiques/revenus',
        'admin-stats/transactions' => 'admin/statistiques/transactions',
        'admin-stats/accounts/{method}' => 'admin/statistiques/comptes/{moyen}',
        'admin-stats/accounts' => 'admin/statistiques/comptes',
        'admin-withdrawals' => 'admin/retraits',
        'admin-transfers' => 'admin/transferts',
        'admin-settings' => 'admin/parametres',
        'admin-settings/twofa' => 'admin/parametres/double-facteur',
    ];

    /** Champs ENVOYÉS par l'ancien client (corps et paramètres) : ancien nom => nouveau. */
    public const CHAMPS_ENTREE = [
        'username' => 'identifiant', 'password' => 'mot_de_passe', 'company_name' => 'nom_commerce',
        'phone' => 'telephone', 'device_name' => 'nom_appareil', 'enabled' => 'actif',
        'modules_off' => 'sections_masquees', 'auto_print' => 'impression_auto',
        'payment_method' => 'moyen_paiement', 'amount' => 'montant', 'name' => 'nom', 'address' => 'adresse',
        'category_id' => 'categorie_id', 'scent' => 'description', 'barcode' => 'code_barres',
        'price' => 'prix_vente', 'price_achat' => 'prix_achat', 'units' => 'conditionnements',
        'product_id' => 'produit_id', 'unit_id' => 'conditionnement_id', 'quantity' => 'quantite',
        'client_name' => 'nom_client', 'client_phone' => 'telephone_client', 'due_date' => 'date_echeance',
        'client_uuid' => 'uuid_appareil', 'sales' => 'ventes', 'paid' => 'paye', 'repayment_method' => 'moyen_reglement',
        'sale_id' => 'vente_id', 'reason' => 'motif', 'refund_method' => 'moyen_remboursement',
        'expected_date' => 'date_prevue', 'items' => 'lignes', 'status' => 'statut', 'tracking_note' => 'note_suivi',
        'delivered_at' => 'livree_le', 'invite_token' => 'jeton_invitation', 'members' => 'membres',
        'stack' => 'pile', 'kind' => 'type', 'per_page' => 'par_page', 'period' => 'periode', 'limit' => 'limite',
        'method' => 'moyen', 'from' => 'source', 'to' => 'destination', 'created_at' => 'cree_le',
        'app_name' => 'nom_application', 'contact_email' => 'email_contact', 'timezone' => 'fuseau_horaire',
        'premium_price' => 'prix_premium', 'grace_period' => 'delai_grace', 'alerts_enabled' => 'alertes_actives',
        'notify_new_subs' => 'notifier_nouveaux_abonnes', 'notify_late_payments' => 'notifier_retards_paiement',
        'notify_reports' => 'notifier_rapports', 'multi_sessions' => 'sessions_multiples',
    ];

    /** Valeurs ENVOYÉES par l'ancien client, par champ (ancien nom) : ancienne => nouvelle. */
    public const VALEURS_ENTREE = [
        'method' => ['cash' => 'especes'],
        'from' => ['cash' => 'especes'],
        'to' => ['cash' => 'especes'],
        'period' => ['daily' => 'jour', 'weekly' => 'semaine', 'monthly' => 'mois', 'all' => 'tout'],
        'kind' => ['error' => 'erreur', 'unhandledrejection' => 'promesse_rejetee'],
        'plan' => ['Free' => 'Gratuit'],
        'modules_off' => ['returns' => 'retours', 'menu' => 'accueil'],
    ];

    /** Champs RENVOYÉS : nouveau nom => ancien nom. */
    public const CHAMPS_SORTIE = [
        'identifiant' => 'username', 'mot_de_passe' => 'password', 'nom_commerce' => 'company_name',
        'boutique_active_id' => 'current_boutique_id', 'telephone' => 'phone', 'statut' => 'status',
        'statut_paiement' => 'payment_status', 'moyen_paiement' => 'payment_method', 'montant' => 'amount',
        'statut_demande_premium' => 'upgrade_status', 'double_facteur_actif' => 'twofa_enabled',
        'cree_le' => 'created_at', 'modifie_le' => 'updated_at', 'supprime_le' => 'deleted_at',
        'utilisateur_id' => 'user_id', 'nom' => 'name', 'categorie_id' => 'category_id', 'description' => 'scent',
        'prix_vente' => 'price', 'prix_achat' => 'price_achat', 'code_barres' => 'barcode',
        'uuid_appareil' => 'client_uuid', 'produit_id' => 'product_id', 'quantite' => 'quantity',
        'nom_client' => 'client_name', 'telephone_client' => 'client_phone', 'date_echeance' => 'due_date',
        'paye' => 'paid', 'moyen_reglement' => 'repayment_method', 'conditionnement_id' => 'unit_id',
        'libelle_conditionnement' => 'unit_libelle', 'cout_marchandises' => 'cogs', 'reconstituee' => 'backfilled',
        'membres' => 'members', 'date_creation' => 'created_date', 'jours' => 'days', 'moyen' => 'method',
        'methode' => 'method', 'compte_source' => 'from_account', 'compte_destination' => 'to_account',
        'nom_application' => 'app_name', 'email_contact' => 'contact_email', 'fuseau_horaire' => 'timezone',
        'prix_premium' => 'premium_price', 'delai_grace' => 'grace_period', 'alertes_actives' => 'alerts_enabled',
        'notifier_nouveaux_abonnes' => 'notify_new_subs', 'notifier_retards_paiement' => 'notify_late_payments',
        'notifier_rapports' => 'notify_reports', 'sessions_multiples' => 'multi_sessions',
        'vente_id' => 'sale_id', 'motif' => 'reason', 'moyen_remboursement' => 'refund_method',
        'montant_rembourse' => 'refund_amount', 'date_prevue' => 'expected_date', 'note_suivi' => 'tracking_note',
        'livree_le' => 'delivered_at', 'proprietaire_id' => 'owner_id', 'adresse' => 'address',
        'est_principale' => 'is_primary', 'boutique_rattachement_id' => 'ref_boutique_id', 'membre_id' => 'member_id',
        'jeton_invitation' => 'invite_token', 'invitation_expire_le' => 'invite_expires_at', 'acceptee_le' => 'accepted_at',
        'acteur_id' => 'actor_id', 'nom_acteur' => 'actor_name',
        'utilisateur' => 'user', 'jeton' => 'token', 'jeton_expire_le' => 'token_expires_at',
        'double_facteur_requis' => 'twofa_required', 'code_dev' => 'dev_code', 'est_employe' => 'is_employee',
        'erreur' => 'error', 'succes' => 'success', 'actif' => 'enabled', 'nom_produit' => 'product_name',
        'prix_produit' => 'product_price', 'nom_fournisseur' => 'fournisseur_name',
        'telephone_fournisseur' => 'fournisseur_phone', 'statut_commande' => 'commande_status',
        'total_commande' => 'commande_total', 'nb_lignes' => 'items_count', 'lignes' => 'items',
        'conditionnements' => 'units', 'lien_invitation' => 'invite_link', 'membre' => 'member',
        'proprietaire' => 'owner', 'url_whatsapp' => 'whatsapp_url', 'libelle_affichage' => 'display_label',
        'stock_affiche' => 'stock_display', 'moyenne_jour_affichee' => 'avg_daily_display',
        'jours_avant_rupture' => 'days_until_stockout', 'a_commander_affiche' => 'reorder_display',
        'risque' => 'risk', 'raisons' => 'reasons', 'synchronisees' => 'synced', 'doublons' => 'duplicates',
        'echecs' => 'failed', 'retour' => 'return', 'montant_credits' => 'credits_montant',
        'nom_commerce_utilisateur' => 'user_company_name', 'telephone_utilisateur' => 'user_phone',
        'cache_statistiques' => 'stats_cache', 'heure' => 'time', 'base_de_donnees' => 'database',
        'latence_ms' => 'latency_ms', 'total_utilisateurs' => 'totalUsers', 'premium_actifs' => 'activePremium',
        'revenus' => 'revenues', 'en_attente' => 'pending', 'croissance' => 'growth', 'actuel' => 'current',
        'precedent' => 'previous', 'solde' => 'balance', 'total_periode' => 'periodTotal', 'periode' => 'period',
        'comptes' => 'accounts', 'entrees' => 'entries', 'retraits' => 'withdrawals', 'retrait' => 'withdrawal',
        'transferts' => 'transfers', 'transfert' => 'transfer', 'abonnements' => 'subscriptions',
        'parametres' => 'settings', 'sections_masquees' => 'modules_off', 'impression_auto' => 'auto_print',
    ];

    /** Valeurs RENVOYÉES, par champ (nouveau nom) : nouvelle => ancienne. */
    public const VALEURS_SORTIE = [
        'statut' => ['invitee' => 'pending', 'acceptee' => 'accepted', 'refusee' => 'rejected',
            'degrade' => 'degraded', 'hors_service' => 'down'],
        'role' => ['commercant' => 'user'],
        'plan' => ['Gratuit' => 'Free'],
        'risque' => ['vert' => 'green', 'orange' => 'amber', 'rouge' => 'red'],
        'methode' => ['modele' => 'model', 'heuristique' => 'heuristic'],
        'periode' => ['jour' => 'daily', 'semaine' => 'weekly', 'mois' => 'monthly', 'tout' => 'all'],
        'sections_masquees' => ['retours' => 'returns', 'accueil' => 'menu'],
        'code' => ['LIMITE_BOUTIQUES_ATTEINTE' => 'BOUTIQUE_LIMIT_REACHED'],
        'moyen' => ['especes' => 'cash'],
        'compte_source' => ['especes' => 'cash'],
        'compte_destination' => ['especes' => 'cash'],
    ];

    /**
     * Les deux seuls noms français qui correspondent à DEUX anciens noms selon
     * l'endroit : on les traduit route par route (nouvelle adresse => champs).
     *  - `produit` : « produit » dans les statistiques, mais « product » dans le
     *    détail d'une commande (produit de chaque ligne) ;
     *  - `especes` : « especes » dans la caisse, mais « cash » dans les comptes
     *    de l'administration.
     */
    public const SORTIE_PAR_ADRESSE = [
        'commandes/{id}' => ['produit' => 'product'],
        'admin/statistiques/comptes' => ['especes' => 'cash'],
    ];

    /** Paramètre d'adresse dont la VALEUR change : [ancien nom du paramètre => [ancienne => nouvelle]]. */
    public const PARAMETRES_ENTREE = [
        'method' => ['cash' => 'especes'],
    ];

    /** Le lien d'invitation : ancien paramètre, reconnu par l'ancienne application. */
    public const LIEN_INVITATION = ['?invitation=' => '?invite='];
}
