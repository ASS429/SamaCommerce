<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Traduction en français du schéma d'une base créée AVANT la francisation.
 *
 * QUAND ELLE AGIT. Uniquement sur une base aux noms anglais (la production, ou
 * une ancienne sauvegarde restaurée) : les migrations précédentes, réécrites en
 * français, créent directement le schéma français sur une base neuve. Ici,
 * elle ne fait alors rien.
 *
 * CE QU'ELLE FAIT. Renommer tables, colonnes, index, contraintes et séquences,
 * puis traduire les quelques VALEURS enregistrées en anglais (rôle `user`,
 * statut `pending`…). Renommer ne déplace aucune donnée : PostgreSQL change une
 * étiquette, les lignes ne bougent pas.
 *
 * GARANTIE. PostgreSQL exécute un changement de structure dans une
 * transaction : soit tout est renommé, soit rien ne l'est. Une base à moitié
 * traduite est impossible.
 *
 * Le résultat est vérifié par comparaison avec une base neuve : même schéma à
 * l'octet près (cf. docs/GLOSSAIRE_NOMMAGE.md, étape 2).
 *
 * Les noms anglais ci-dessous SONT l'état de départ : cette migration ne peut
 * pas les éviter. Ils sont figés ici volontairement, sans dépendre d'aucune
 * autre classe : une migration déjà jouée ne doit plus jamais changer.
 */
return new class extends Migration
{
    /** Ancienne table => [nouvelle table, [ancienne colonne => nouvelle colonne]]. */
    public const SCHEMA = [
        'users' => ['utilisateurs', [
            'username' => 'identifiant', 'password' => 'mot_de_passe', 'company_name' => 'nom_commerce',
            'current_boutique_id' => 'boutique_active_id', 'phone' => 'telephone', 'status' => 'statut',
            'payment_status' => 'statut_paiement', 'payment_method' => 'moyen_paiement', 'amount' => 'montant',
            'upgrade_status' => 'statut_demande_premium', 'twofa_enabled' => 'double_facteur_actif',
            'remember_token' => 'jeton_souvenir', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'password_reset_tokens' => ['codes_reinitialisation', [
            'email' => 'identifiant', 'token' => 'code_hache', 'created_at' => 'cree_le',
        ]],
        'categories' => ['categories', [
            'user_id' => 'utilisateur_id', 'name' => 'nom', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'products' => ['produits', [
            'user_id' => 'utilisateur_id', 'category_id' => 'categorie_id', 'name' => 'nom', 'scent' => 'description',
            'price' => 'prix_vente', 'price_achat' => 'prix_achat', 'barcode' => 'code_barres',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le', 'deleted_at' => 'supprime_le',
        ]],
        'sales' => ['ventes', [
            'client_uuid' => 'uuid_appareil', 'user_id' => 'utilisateur_id', 'product_id' => 'produit_id',
            'quantity' => 'quantite', 'payment_method' => 'moyen_paiement', 'client_name' => 'nom_client',
            'client_phone' => 'telephone_client', 'due_date' => 'date_echeance', 'paid' => 'paye',
            'repayment_method' => 'moyen_reglement', 'unit_id' => 'conditionnement_id',
            'unit_libelle' => 'libelle_conditionnement', 'cogs' => 'cout_marchandises', 'backfilled' => 'reconstituee',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le', 'deleted_at' => 'supprime_le',
        ]],
        'tontines' => ['tontines', [
            'name' => 'nom', 'amount' => 'montant', 'members' => 'membres', 'created_date' => 'date_creation',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'alerts' => ['alertes', [
            'user_id' => 'utilisateur_id', 'days' => 'jours', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'withdrawals' => ['retraits', [
            'amount' => 'montant', 'method' => 'moyen', 'status' => 'statut',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'admin_transfers' => ['transferts_admin', [
            'from_account' => 'compte_source', 'to_account' => 'compte_destination', 'amount' => 'montant',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'admin_settings' => ['parametres_admin', [
            'app_name' => 'nom_application', 'contact_email' => 'email_contact', 'timezone' => 'fuseau_horaire',
            'premium_price' => 'prix_premium', 'grace_period' => 'delai_grace', 'alerts_enabled' => 'alertes_actives',
            'notify_new_subs' => 'notifier_nouveaux_abonnes', 'notify_late_payments' => 'notifier_retards_paiement',
            'notify_reports' => 'notifier_rapports', 'multi_sessions' => 'sessions_multiples',
            'twofa_enabled' => 'double_facteur_actif', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'twofa_codes' => ['codes_double_facteur', [
            'user_id' => 'utilisateur_id', 'code' => 'code_hache', 'expires_at' => 'expire_le', 'used' => 'utilise',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'clients' => ['clients', [
            'user_id' => 'utilisateur_id', 'name' => 'nom', 'phone' => 'telephone', 'address' => 'adresse',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le', 'deleted_at' => 'supprime_le',
        ]],
        'fournisseurs' => ['fournisseurs', [
            'user_id' => 'utilisateur_id', 'name' => 'nom', 'phone' => 'telephone', 'address' => 'adresse',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'caisse_closings' => ['clotures_caisse', [
            'user_id' => 'utilisateur_id', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'returns' => ['retours', [
            'sale_id' => 'vente_id', 'product_id' => 'produit_id', 'user_id' => 'utilisateur_id', 'quantity' => 'quantite',
            'reason' => 'motif', 'refund_method' => 'moyen_remboursement', 'refund_amount' => 'montant_rembourse',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'restock_orders' => ['commandes', [
            'user_id' => 'utilisateur_id', 'expected_date' => 'date_prevue', 'status' => 'statut',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'commande_items' => ['lignes_commande', [
            'product_id' => 'produit_id', 'quantity' => 'quantite', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'restock_deliveries' => ['livraisons', [
            'user_id' => 'utilisateur_id', 'tracking_note' => 'note_suivi', 'status' => 'statut', 'delivered_at' => 'livree_le',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'boutiques' => ['boutiques', [
            'owner_id' => 'proprietaire_id', 'name' => 'nom', 'phone' => 'telephone', 'address' => 'adresse',
            'is_primary' => 'est_principale', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'boutique_members' => ['membres_boutique', [
            'owner_id' => 'proprietaire_id', 'ref_boutique_id' => 'boutique_rattachement_id', 'member_id' => 'membre_id',
            'status' => 'statut', 'invite_token' => 'jeton_invitation', 'invite_expires_at' => 'invitation_expire_le',
            'accepted_at' => 'acceptee_le', 'name' => 'nom', 'phone' => 'telephone',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'activity_logs' => ['journal_activite', [
            'owner_id' => 'proprietaire_id', 'actor_id' => 'acteur_id', 'actor_name' => 'nom_acteur',
            'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
        'product_units' => ['conditionnements', [
            'product_id' => 'produit_id', 'created_at' => 'cree_le', 'updated_at' => 'modifie_le',
        ]],
    ];

    /**
     * Index, contraintes et séquences : ancien nom => nouveau nom.
     *
     * Obtenu en comparant, définition par définition, le schéma produit par les
     * anciennes migrations et celui produit par les nouvelles, tous deux sur
     * PostgreSQL 17. Renommer une table ne renomme PAS ses index : sans cette
     * liste, la base de production garderait des noms anglais, et une future
     * migration qui supprime un index par son nom conventionnel échouerait.
     */
    public const OBJETS = [
        'activity_logs_id_seq' => 'journal_activite_id_seq',
        'activity_logs_owner_id_index' => 'journal_activite_proprietaire_id_index',
        'activity_logs_pkey' => 'journal_activite_pkey',
        'admin_settings_admin_id_foreign' => 'parametres_admin_admin_id_foreign',
        'admin_settings_id_seq' => 'parametres_admin_id_seq',
        'admin_settings_pkey' => 'parametres_admin_pkey',
        'admin_transfers_admin_id_foreign' => 'transferts_admin_admin_id_foreign',
        'admin_transfers_id_seq' => 'transferts_admin_id_seq',
        'admin_transfers_pkey' => 'transferts_admin_pkey',
        'alerts_id_seq' => 'alertes_id_seq',
        'alerts_pkey' => 'alertes_pkey',
        'alerts_user_id_foreign' => 'alertes_utilisateur_id_foreign',
        'boutique_members_id_seq' => 'membres_boutique_id_seq',
        'boutique_members_invite_token_index' => 'membres_boutique_jeton_invitation_index',
        'boutique_members_member_id_foreign' => 'membres_boutique_membre_id_foreign',
        'boutique_members_member_id_index' => 'membres_boutique_membre_id_index',
        'boutique_members_owner_id_email_index' => 'membres_boutique_proprietaire_id_email_index',
        'boutique_members_owner_id_foreign' => 'membres_boutique_proprietaire_id_foreign',
        'boutique_members_pkey' => 'membres_boutique_pkey',
        'boutiques_owner_id_foreign' => 'boutiques_proprietaire_id_foreign',
        'boutiques_owner_id_index' => 'boutiques_proprietaire_id_index',
        'caisse_closings_id_seq' => 'clotures_caisse_id_seq',
        'caisse_closings_pkey' => 'clotures_caisse_pkey',
        'caisse_closings_user_boutique_date_unique' => 'clotures_caisse_utilisateur_boutique_date_unique',
        'caisse_closings_user_id_foreign' => 'clotures_caisse_utilisateur_id_foreign',
        'categories_user_id_foreign' => 'categories_utilisateur_id_foreign',
        'clients_user_id_foreign' => 'clients_utilisateur_id_foreign',
        'clients_user_id_name_index' => 'clients_utilisateur_id_nom_index',
        'commande_items_commande_id_foreign' => 'lignes_commande_commande_id_foreign',
        'commande_items_id_seq' => 'lignes_commande_id_seq',
        'commande_items_pkey' => 'lignes_commande_pkey',
        'commande_items_product_id_foreign' => 'lignes_commande_produit_id_foreign',
        'fournisseurs_user_id_foreign' => 'fournisseurs_utilisateur_id_foreign',
        'fournisseurs_user_id_name_index' => 'fournisseurs_utilisateur_id_nom_index',
        'password_reset_tokens_pkey' => 'codes_reinitialisation_pkey',
        'product_units_id_seq' => 'conditionnements_id_seq',
        'product_units_pkey' => 'conditionnements_pkey',
        'product_units_product_id_foreign' => 'conditionnements_produit_id_foreign',
        'products_barcode_index' => 'produits_code_barres_index',
        'products_category_id_foreign' => 'produits_categorie_id_foreign',
        'products_id_seq' => 'produits_id_seq',
        'products_pkey' => 'produits_pkey',
        'products_user_boutique_idx' => 'produits_utilisateur_boutique_idx',
        'products_user_id_foreign' => 'produits_utilisateur_id_foreign',
        'restock_deliveries_commande_id_foreign' => 'livraisons_commande_id_foreign',
        'restock_deliveries_id_seq' => 'livraisons_id_seq',
        'restock_deliveries_pkey' => 'livraisons_pkey',
        'restock_deliveries_user_id_created_at_index' => 'livraisons_utilisateur_id_cree_le_index',
        'restock_deliveries_user_id_foreign' => 'livraisons_utilisateur_id_foreign',
        'restock_orders_fournisseur_id_foreign' => 'commandes_fournisseur_id_foreign',
        'restock_orders_id_seq' => 'commandes_id_seq',
        'restock_orders_pkey' => 'commandes_pkey',
        'restock_orders_user_id_created_at_index' => 'commandes_utilisateur_id_cree_le_index',
        'restock_orders_user_id_foreign' => 'commandes_utilisateur_id_foreign',
        'returns_id_seq' => 'retours_id_seq',
        'returns_pkey' => 'retours_pkey',
        'returns_product_id_foreign' => 'retours_produit_id_foreign',
        'returns_sale_id_foreign' => 'retours_vente_id_foreign',
        'returns_user_id_created_at_index' => 'retours_utilisateur_id_cree_le_index',
        'returns_user_id_foreign' => 'retours_utilisateur_id_foreign',
        'sales_client_id_foreign' => 'ventes_client_id_foreign',
        'sales_client_uuid_unique' => 'ventes_uuid_appareil_unique',
        'sales_id_seq' => 'ventes_id_seq',
        'sales_pkey' => 'ventes_pkey',
        'sales_product_id_foreign' => 'ventes_produit_id_foreign',
        'sales_user_created_idx' => 'ventes_utilisateur_cree_idx',
        'sales_user_id_foreign' => 'ventes_utilisateur_id_foreign',
        'twofa_codes_id_seq' => 'codes_double_facteur_id_seq',
        'twofa_codes_pkey' => 'codes_double_facteur_pkey',
        'twofa_codes_user_id_foreign' => 'codes_double_facteur_utilisateur_id_foreign',
        'users_id_seq' => 'utilisateurs_id_seq',
        'users_pkey' => 'utilisateurs_pkey',
        'users_username_unique' => 'utilisateurs_identifiant_unique',
        'withdrawals_admin_id_foreign' => 'retraits_admin_id_foreign',
        'withdrawals_id_seq' => 'retraits_id_seq',
        'withdrawals_pkey' => 'retraits_pkey',
    ];

    /** Valeurs enregistrées en anglais : [table, colonne, ancienne, nouvelle]. */
    public const VALEURS = [
        ['utilisateurs', 'role', 'user', 'commercant'],
        ['utilisateurs', 'plan', 'Free', 'Gratuit'],
        ['utilisateurs', 'moyen_paiement', 'cash', 'especes'],
        ['membres_boutique', 'statut', 'pending', 'invitee'],
        ['membres_boutique', 'statut', 'accepted', 'acceptee'],
        ['membres_boutique', 'statut', 'rejected', 'refusee'],
        ['alertes', 'type', 'late', 'retard'],
        ['alertes', 'type', 'upcoming', 'a_venir'],
        ['retraits', 'moyen', 'cash', 'especes'],
        ['transferts_admin', 'compte_source', 'cash', 'especes'],
        ['transferts_admin', 'compte_destination', 'cash', 'especes'],
    ];

    /** Valeurs par défaut des colonnes : [table, colonne, ancienne, nouvelle]. */
    public const DEFAUTS = [
        ['utilisateurs', 'role', 'user', 'commercant'],
        ['utilisateurs', 'plan', 'Free', 'Gratuit'],
        ['membres_boutique', 'statut', 'pending', 'invitee'],
    ];

    /** Réglages d'écran (JSON) : clés et identifiants de section. */
    public const PREFERENCES = [
        'cles' => ['modules_off' => 'sections_masquees', 'auto_print' => 'impression_auto'],
        'sections' => ['returns' => 'retours', 'menu' => 'accueil'],
    ];

    public function up(): void
    {
        // Base neuve : les migrations précédentes l'ont créée en français.
        if (! Schema::hasTable('users')) {
            return;
        }

        $this->renommer(self::SCHEMA, self::OBJETS, sens: 'vers_francais');

        foreach (self::VALEURS as [$table, $colonne, $ancienne, $nouvelle]) {
            DB::table($table)->where($colonne, $ancienne)->update([$colonne => $nouvelle]);
        }
        foreach (self::DEFAUTS as [$table, $colonne, , $nouvelle]) {
            $this->changerDefaut($table, $colonne, $nouvelle);
        }
        $this->traduirePreferences(self::PREFERENCES['cles'], self::PREFERENCES['sections']);
    }

    /**
     * Retour à l'état anglais, pour le cas où le nouveau code devrait être
     * retiré. Testé sur PostgreSQL : après `down()`, l'ancien code fonctionne.
     */
    public function down(): void
    {
        if (! Schema::hasTable('utilisateurs') || Schema::hasTable('users')) {
            return;
        }

        $this->traduirePreferences(
            array_flip(self::PREFERENCES['cles']),
            array_flip(self::PREFERENCES['sections']),
        );
        foreach (self::DEFAUTS as [$table, $colonne, $ancienne]) {
            $this->changerDefaut($table, $colonne, $ancienne);
        }
        // Ordre inverse : `cash` a deux traductions possibles d'origine selon
        // la colonne, et chaque ligne ne concerne qu'une colonne.
        foreach (array_reverse(self::VALEURS) as [$table, $colonne, $ancienne, $nouvelle]) {
            DB::table($table)->where($colonne, $nouvelle)->update([$colonne => $ancienne]);
        }

        $this->renommer(self::SCHEMA, self::OBJETS, sens: 'vers_anglais');
    }

    /** Renomme colonnes, tables, puis index, contraintes et séquences. */
    private function renommer(array $schema, array $objets, string $sens): void
    {
        $versFrancais = $sens === 'vers_francais';

        foreach ($schema as $ancienneTable => [$nouvelleTable, $colonnes]) {
            $table = $versFrancais ? $ancienneTable : $nouvelleTable;
            foreach ($colonnes as $ancienne => $nouvelle) {
                [$de, $vers] = $versFrancais ? [$ancienne, $nouvelle] : [$nouvelle, $ancienne];
                DB::statement(sprintf('ALTER TABLE %s RENAME COLUMN %s TO %s', $this->nom($table), $this->nom($de), $this->nom($vers)));
            }
        }

        foreach ($schema as $ancienneTable => [$nouvelleTable]) {
            if ($ancienneTable === $nouvelleTable) {
                continue;
            }
            [$de, $vers] = $versFrancais ? [$ancienneTable, $nouvelleTable] : [$nouvelleTable, $ancienneTable];
            DB::statement(sprintf('ALTER TABLE %s RENAME TO %s', $this->nom($de), $this->nom($vers)));
        }

        // Un nom d'index, de contrainte ou de séquence est unique dans le
        // schéma : on retrouve l'objet par son nom seul, quel que soit son type.
        foreach ($objets as $ancien => $nouveau) {
            [$de, $vers] = $versFrancais ? [$ancien, $nouveau] : [$nouveau, $ancien];
            $this->renommerObjet($de, $vers);
        }
    }

    private function renommerObjet(string $de, string $vers): void
    {
        $contrainte = DB::selectOne(
            'SELECT c.conrelid::regclass::text AS table_ FROM pg_constraint c
             JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = current_schema() AND c.conname = ?',
            [$de],
        );
        if ($contrainte) {
            // Renommer une contrainte renomme aussi l'index qui la porte.
            DB::statement(sprintf('ALTER TABLE %s RENAME CONSTRAINT %s TO %s', $contrainte->table_, $this->nom($de), $this->nom($vers)));

            return;
        }

        $objet = DB::selectOne(
            'SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = current_schema() AND c.relname = ?',
            [$de],
        );
        if (! $objet) {
            throw new \RuntimeException("Objet introuvable dans la base : {$de}");
        }
        $genre = match ($objet->relkind) {
            'i' => 'INDEX',
            'S' => 'SEQUENCE',
            default => throw new \RuntimeException("Type d'objet inattendu pour {$de} : {$objet->relkind}"),
        };
        DB::statement(sprintf('ALTER %s %s RENAME TO %s', $genre, $this->nom($de), $this->nom($vers)));
    }

    private function changerDefaut(string $table, string $colonne, string $valeur): void
    {
        DB::statement(sprintf(
            'ALTER TABLE %s ALTER COLUMN %s SET DEFAULT %s',
            $this->nom($table), $this->nom($colonne), DB::getPdo()->quote($valeur),
        ));
    }

    /** Traduit les clés et identifiants de section des réglages d'écran. */
    private function traduirePreferences(array $cles, array $sections): void
    {
        $colonne = Schema::hasColumn('utilisateurs', 'preferences') ? 'preferences' : null;
        $table = Schema::hasTable('utilisateurs') ? 'utilisateurs' : 'users';
        if ($colonne === null) {
            return;
        }

        foreach (DB::table($table)->whereNotNull($colonne)->get(['id', $colonne]) as $ligne) {
            $reglages = json_decode($ligne->{$colonne}, true);
            if (! is_array($reglages)) {
                continue;
            }
            $traduits = [];
            foreach ($reglages as $cle => $valeur) {
                if (is_array($valeur)) {
                    $valeur = array_map(fn ($v) => is_string($v) ? ($sections[$v] ?? $v) : $v, $valeur);
                }
                $traduits[$cles[$cle] ?? $cle] = $valeur;
            }
            DB::table($table)->where('id', $ligne->id)->update([$colonne => json_encode($traduits, JSON_UNESCAPED_UNICODE)]);
        }
    }

    /** Identifiant SQL entre guillemets (noms fixes, mais on ne concatène jamais à nu). */
    private function nom(string $identifiant): string
    {
        return '"'.str_replace('"', '""', $identifiant).'"';
    }
};
