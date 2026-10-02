<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Abonnements refondus (octobre 2026) : quatre plans, paiement manuel VÉRIFIÉ.
 *
 * Avant : la demande « Premium » rendait le compte Premium À L'INSTANT, avec le
 * montant et l'échéance envoyés par le navigateur (donc falsifiables), et
 * l'échéance n'était jamais appliquée. Désormais :
 *  - `plans` : le catalogue (prix, limites, fonctionnalités), modifiable par
 *    l'administrateur sans mise à jour de l'application ;
 *  - `paiements_abonnement` : chaque paiement déclaré par un commerçant, avec
 *    sa référence de transaction ; seul un paiement VALIDÉ par
 *    l'administrateur ouvre une période payée ;
 *  - `reglages_abonnement` : essai, délai de grâce, remise annuelle, numéros
 *    où payer (une seule ligne) ;
 *  - `consommations_ia` : conseils IA consommés par mois (quota du plan) ;
 *  - `rappels_abonnement` : rappels d'échéance déjà envoyés (jamais deux fois).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('nom', 64);
            $table->string('accroche', 160)->nullable();
            // Francs CFA, entiers. Le prix annuel se déduit des mois offerts.
            $table->unsignedInteger('prix_mensuel')->default(0);
            $table->boolean('sur_devis')->default(false);
            $table->unsignedInteger('prix_a_partir_de')->nullable();
            // NULL = illimité.
            $table->unsignedInteger('max_boutiques')->nullable();
            $table->unsignedInteger('max_employes')->nullable();
            $table->unsignedInteger('max_produits')->nullable();
            $table->unsignedInteger('quota_ia_mensuel')->nullable();
            $table->json('fonctionnalites');
            $table->unsignedSmallInteger('ordre')->default(0);
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
        });

        Schema::create('reglages_abonnement', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('duree_essai_jours')->default(30);
            $table->string('plan_essai', 32)->default('pro');
            $table->unsignedSmallInteger('delai_grace_jours')->default(7);
            $table->unsignedTinyInteger('mois_offerts_annuel')->default(2);
            $table->string('numero_wave', 32)->nullable();
            $table->string('numero_orange', 32)->nullable();
            $table->string('nom_beneficiaire', 120)->nullable();
            // WhatsApp de l'administrateur : devis Entreprise, questions sur un paiement.
            $table->string('numero_contact', 32)->nullable();
            $table->boolean('reference_obligatoire')->default(true);
            $table->boolean('capture_autorisee')->default(true);
            $table->json('rappels')->nullable();
            $table->text('message_relance')->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
        });

        Schema::create('paiements_abonnement', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->string('plan_code', 32);
            $table->string('periode', 8); // mois | an
            $table->unsignedInteger('montant_attendu');
            $table->unsignedInteger('montant_declare');
            $table->string('moyen', 16); // wave | orange | especes | offert
            $table->string('numero_payeur', 32)->nullable();
            // Référence de la transaction telle que saisie (en majuscules), et
            // sa CLÉ (lettres et chiffres seuls) : « TX 8F3K-Q2LM » et
            // « tx8f3kq2lm » désignent la même transaction.
            $table->string('reference', 64)->nullable();
            $table->string('reference_cle', 64)->nullable();
            // Photo du SMS de confirmation (data URL compressée), facultative.
            $table->text('capture')->nullable();
            $table->string('statut', 16)->default('en_attente'); // en_attente | valide | refuse
            $table->string('motif_refus', 120)->nullable();
            // Origine : déclaration du commerçant, geste de l'administrateur,
            // ou reprise d'un ancien abonnement Premium.
            $table->string('origine', 16)->default('declaration');
            $table->date('debut_le')->nullable();
            $table->date('fin_le')->nullable();
            $table->string('numero_recu', 16)->nullable()->unique();
            $table->foreignId('decide_par')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamp('decide_le')->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();

            $table->index(['statut', 'cree_le']);
            $table->index(['utilisateur_id', 'statut']);
        });

        // Une même transaction ne peut servir deux fois (sauf déclaration
        // refusée : le commerçant doit pouvoir corriger une faute de frappe).
        // Index partiel : PostgreSQL et SQLite le comprennent tous deux.
        DB::statement("CREATE UNIQUE INDEX paiements_abonnement_reference_unique
            ON paiements_abonnement (moyen, reference_cle)
            WHERE reference_cle IS NOT NULL AND statut <> 'refuse'");

        Schema::create('consommations_ia', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->string('mois', 7); // 2026-10
            $table->unsignedInteger('nombre')->default(0);
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
            $table->unique(['utilisateur_id', 'mois']);
        });

        Schema::create('rappels_abonnement', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->string('type', 16); // j-7 | j-1 | j0 | grace
            $table->date('echeance');
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
            $table->unique(['utilisateur_id', 'type', 'echeance']);
        });

        Schema::table('utilisateurs', function (Blueprint $table) {
            $table->date('essai_jusqu_au')->nullable()->after('expiration');
        });

        $this->remplirLeCatalogue();
        $this->reprendreLesComptesExistants();
    }

    private function remplirLeCatalogue(): void
    {
        $maintenant = Carbon::now();
        $plans = [
            ['gratuit', 'Gratuit', 'Pour démarrer', 0, false, null, 1, 0, 100, 5, [], 1],
            ['essentiel', 'Essentiel', 'Pour la boutique qui tourne', 2500, false, null, 1, 2, null, 30,
                ['rapports_complets', 'exports', 'relances_whatsapp', 'fournisseurs_commandes', 'inventaire_retours'], 2],
            ['pro', 'Pro', 'Pour grandir', 5000, false, null, 3, null, null, null,
                ['rapports_complets', 'exports', 'relances_whatsapp', 'fournisseurs_commandes', 'inventaire_retours',
                    'livraisons', 'journal_activite', 'tableau_boutiques'], 3],
            ['entreprise', 'Entreprise', 'Pour les réseaux de boutiques', 0, true, 15000, null, null, null, null,
                ['rapports_complets', 'exports', 'relances_whatsapp', 'fournisseurs_commandes', 'inventaire_retours',
                    'livraisons', 'journal_activite', 'tableau_boutiques', 'accompagnement'], 4],
        ];
        foreach ($plans as [$code, $nom, $accroche, $prix, $devis, $aPartirDe, $boutiques, $employes, $produits, $ia, $fonctions, $ordre]) {
            DB::table('plans')->insert([
                'code' => $code, 'nom' => $nom, 'accroche' => $accroche,
                'prix_mensuel' => $prix, 'sur_devis' => $devis, 'prix_a_partir_de' => $aPartirDe,
                'max_boutiques' => $boutiques, 'max_employes' => $employes, 'max_produits' => $produits,
                'quota_ia_mensuel' => $ia, 'fonctionnalites' => json_encode($fonctions), 'ordre' => $ordre,
                'cree_le' => $maintenant, 'modifie_le' => $maintenant,
            ]);
        }

        DB::table('reglages_abonnement')->insert([
            'id' => 1,
            'rappels' => json_encode(['j-7', 'j-1', 'j0', 'grace']),
            'message_relance' => 'Bonjour {nom}, votre plan {plan} SamaCommerce expire le {date}. '
                .'Pour continuer sans interruption, renouvelez-le depuis l’application, menu Mon plan ({montant}). '
                .'Merci de votre confiance !',
            'cree_le' => $maintenant, 'modifie_le' => $maintenant,
        ]);
    }

    /**
     * Les comptes existants ne doivent rien perdre au changement :
     *  - chaque commerçant reçoit l'essai du plan Pro (30 jours) ;
     *  - un Premium VALIDÉ et encore en cours devient une période Pro payée,
     *    jusqu'à son échéance ;
     *  - une demande Premium jamais validée n'était pas un paiement : le compte
     *    repasse au plan Gratuit (l'essai couvre la transition).
     */
    private function reprendreLesComptesExistants(): void
    {
        $aujourdhui = Carbon::today();
        $finEssai = $aujourdhui->copy()->addDays(30);

        DB::table('utilisateurs')->where('role', '!=', 'admin')->update(['essai_jusqu_au' => $finEssai]);

        $premiums = DB::table('utilisateurs')->where('plan', 'Premium')->where('role', '!=', 'admin')->get();
        foreach ($premiums as $compte) {
            $echeance = $compte->expiration ? Carbon::parse($compte->expiration) : null;
            $enCours = $compte->statut_demande_premium === 'validé' && $echeance && $echeance->gte($aujourdhui);

            if ($enCours) {
                DB::table('paiements_abonnement')->insert([
                    'utilisateur_id' => $compte->id,
                    'plan_code' => 'pro',
                    'periode' => 'mois',
                    'montant_attendu' => (int) $compte->montant,
                    'montant_declare' => (int) $compte->montant,
                    'moyen' => in_array($compte->moyen_paiement, ['wave', 'orange', 'especes'], true) ? $compte->moyen_paiement : 'wave',
                    'statut' => 'valide',
                    'origine' => 'reprise',
                    'debut_le' => $echeance->copy()->subMonthNoOverflow()->addDay()->toDateString(),
                    'fin_le' => $echeance->toDateString(),
                    'decide_le' => Carbon::now(),
                    'cree_le' => Carbon::now(), 'modifie_le' => Carbon::now(),
                ]);
            }

            DB::table('utilisateurs')->where('id', $compte->id)->update([
                'plan' => $enCours ? 'Pro' : 'Gratuit',
                'expiration' => $enCours ? $echeance->toDateString() : null,
                'statut_demande_premium' => 'validé',
            ]);
        }

        // L'administrateur n'est soumis à aucun plan ; « Premium » n'existe plus.
        DB::table('utilisateurs')->where('plan', 'Premium')->update(['plan' => 'Pro']);
    }

    public function down(): void
    {
        Schema::table('utilisateurs', fn (Blueprint $table) => $table->dropColumn('essai_jusqu_au'));
        DB::table('utilisateurs')->where('plan', 'Pro')->update(['plan' => 'Premium']);
        DB::table('utilisateurs')->whereIn('plan', ['Essentiel', 'Entreprise'])->update(['plan' => 'Premium']);
        Schema::dropIfExists('rappels_abonnement');
        Schema::dropIfExists('consommations_ia');
        Schema::dropIfExists('paiements_abonnement');
        Schema::dropIfExists('reglages_abonnement');
        Schema::dropIfExists('plans');
    }
};
