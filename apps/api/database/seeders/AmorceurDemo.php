<?php

namespace Database\Seeders;

use App\Models\Categorie;
use App\Models\Produit;
use App\Models\Tontine;
use App\Models\Utilisateur;
use App\Models\Vente;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * Données de démonstration : un commerçant, son employé, un administrateur.
 *
 * Découpé en trois parties parce que la remise à zéro quotidienne du compte de
 * démonstration (App\Services\Demonstration) n'en rejoue que deux : rejouer
 * aussi l'administrateur lui donnerait un mot de passe aléatoire chaque matin.
 */
class AmorceurDemo extends Seeder
{
    private ?int $boutiqueId = null;

    public function run(): void
    {
        $this->administrateur();
        $this->remplir($this->commercant());

        $this->command?->info('✅ Démo créée — connexion : demo@samacommerce.sn / password (admin@samacommerce.sn aussi).');
    }

    /**
     * Le commerçant de démonstration dans son état d'origine : mot de passe
     * connu, profil d'usine, et toujours en essai pour que chaque visiteur
     * puisse tout essayer.
     */
    public function commercant(): Utilisateur
    {
        return Utilisateur::updateOrCreate(
            ['identifiant' => config('app.compte_demo')],
            [
                'mot_de_passe' => Hash::make('password'),
                'nom_commerce' => 'Ma Boutique',
                'telephone' => '77 123 45 67',
                'role' => 'commercant',
                'statut' => 'Actif',
                'plan' => 'Gratuit',
                'statut_demande_premium' => 'validé',
                'essai_jusqu_au' => Carbon::today()->addDays(30),
                'double_facteur_actif' => false,
                'photo' => null,
                'preferences' => null,
            ],
        );
    }

    /**
     * Administrateur — mot de passe ALÉATOIRE, jamais une valeur en dur.
     * La commande `admin:securiser` (lancée au démarrage) y applique ensuite
     * ADMIN_PASSWORD. Un identifiant écrit ici finirait dans un dépôt public,
     * comme ce fut le cas avec « password ».
     */
    private function administrateur(): void
    {
        Utilisateur::updateOrCreate(
            ['identifiant' => 'admin@samacommerce.sn'],
            ['mot_de_passe' => Hash::make(\Illuminate\Support\Str::random(48)), 'nom_commerce' => 'Admin', 'role' => 'admin'],
        );
    }

    /** Boutiques, employé, catalogue et un mois de ventes du commerçant de démonstration. */
    public function remplir(Utilisateur $commercant): void
    {
        // Boutique principale + boutique secondaire de démonstration
        $boutique = $commercant->boutiques()->updateOrCreate(['est_principale' => true], ['nom' => 'Ma Boutique', 'emoji' => '🏪']);
        $commercant->boutiques()->firstOrCreate(['nom' => 'Boutique Marché'], ['emoji' => '🏬', 'est_principale' => false]);
        $commercant->update(['boutique_active_id' => $boutique->id]);
        $this->boutiqueId = $boutique->id;

        // Employé de démonstration (vendeur/caissier) — déjà accepté, permissions vente + caisse
        $employe = Utilisateur::updateOrCreate(
            ['identifiant' => 'employe@samacommerce.sn'],
            ['mot_de_passe' => Hash::make('password'), 'nom_commerce' => 'Employé démo', 'role' => 'commercant'],
        );
        \App\Models\MembreBoutique::updateOrCreate(
            ['proprietaire_id' => $commercant->id, 'email' => 'employe@samacommerce.sn'],
            [
                'boutique_rattachement_id' => $boutique->id, 'membre_id' => $employe->id,
                'role' => 'employe', 'statut' => 'acceptee', 'acceptee_le' => Carbon::now(),
                'permissions' => ['vente' => true, 'caisse' => true, 'credits' => true, 'clients' => true,
                    'stock' => false, 'categories' => false, 'rapports' => false,
                    'fournisseurs' => false, 'commandes' => false, 'livraisons' => false],
            ],
        );

        // Catégories
        $alimentation = Categorie::updateOrCreate(['utilisateur_id' => $commercant->id, 'nom' => 'Alimentation'], ['emoji' => '🍞']);
        $boissons = Categorie::updateOrCreate(['utilisateur_id' => $commercant->id, 'nom' => 'Boissons'], ['emoji' => '🥤']);

        // Produits (prix d'achat / prix de vente / stock)
        $produits = [
            $this->produit($commercant, $alimentation, 'Riz parfumé (kg)', 440, 600, 80),
            $this->produit($commercant, $alimentation, 'Huile (litre)', 1000, 1200, 40),
            $this->produit($commercant, $alimentation, 'Sucre (kg)', 550, 700, 60),
            $this->produit($commercant, $boissons, 'Jus en sachet', 100, 200, 120),
            $this->produit($commercant, $boissons, 'Eau minérale', 200, 300, 90),
        ];

        // Ventes sur 30 jours (espèces / wave / orange)
        $moyens = ['especes', 'wave', 'orange'];
        for ($j = 30; $j >= 1; $j--) {
            $date = Carbon::now()->subDays($j);
            foreach (range(1, random_int(1, 3)) as $i) {
                $p = $produits[array_rand($produits)];
                $quantite = random_int(1, 4);
                $this->vente($commercant, $p, $quantite, $moyens[array_rand($moyens)], $date);
            }
        }

        // Une vente à crédit (impayée)
        $this->vente($commercant, $produits[0], 5, 'credit', Carbon::now()->subDays(10), [
            'nom_client' => 'Fatou Ndiaye', 'telephone_client' => '77 987 65 43',
            'date_echeance' => Carbon::now()->addDays(5), 'paye' => false,
        ]);

        // Tontines
        Tontine::firstOrCreate(['nom' => 'Tontine du marché'], ['type' => 'Hebdomadaire', 'montant' => 5000, 'membres' => 12]);
    }

    private function produit(Utilisateur $u, Categorie $c, string $nom, float $achat, float $vente, int $stock): Produit
    {
        return Produit::updateOrCreate(
            ['utilisateur_id' => $u->id, 'nom' => $nom],
            ['boutique_id' => $this->boutiqueId, 'categorie_id' => $c->id, 'prix_achat' => $achat, 'prix_vente' => $vente, 'stock' => $stock],
        );
    }

    private function vente(Utilisateur $u, Produit $p, int $quantite, string $moyen, Carbon $date, array $complement = []): void
    {
        // `forceCreate` : `cree_le` et `modifie_le` ne sont pas remplissables
        // (une vente reçue d'un navigateur ne choisit pas sa date) ; `create`
        // les ignorait, et tout le mois tombait le jour de l'amorçage.
        Vente::forceCreate(array_merge([
            'utilisateur_id' => $u->id,
            'boutique_id' => $this->boutiqueId,
            'produit_id' => $p->id,
            'quantite' => $quantite,
            'total' => (float) $p->prix_vente * $quantite,
            'moyen_paiement' => $moyen,
            'paye' => $moyen !== 'credit',
            'cree_le' => $date,
            'modifie_le' => $date,
        ], $complement));

        $p->decrement('stock', $quantite);
    }
}
