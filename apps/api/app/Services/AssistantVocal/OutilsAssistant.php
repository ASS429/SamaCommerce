<?php

namespace App\Services\AssistantVocal;

use App\Models\Client;
use App\Models\Produit;
use App\Models\Utilisateur;
use App\Models\Vente;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Ce que le cerveau a le droit de faire : LIRE les données de la boutique
 * active et GUIDER vers une page. Aucun outil n'écrit ni ne supprime (V1) :
 * une vente, un crédit ou un retour se fait toujours sur la page, par le
 * commerçant lui-même.
 *
 * Les lectures passent par les modèles Eloquent, donc par le cloisonnement de
 * la boutique active. Un employé ne lit que ce que ses permissions lui ouvrent,
 * comme dans l'application.
 */
final class OutilsAssistant
{
    /**
     * Pages vers lesquelles l'assistant peut guider : l'écran de l'application,
     * le bouton entouré à l'écran (attribut `data-guide`) et son libellé exact,
     * la permission qui ouvre l'écran à un employé (même table que
     * PERMISSION_PAR_ECRAN côté web), les noms du menu (français, wolof), et ce
     * qu'on fait sur la page — dit au cerveau pour qu'il n'annonce jamais un
     * bouton entouré là où il n'y en a pas (défaut vu en production le 03/10/2026).
     */
    public const CIBLES = [
        'vente' => ['ecran' => 'vente', 'bouton' => null, 'permission' => 'vente', 'page' => 'Vendre', 'page_wolof' => 'Jaay',
            'a_faire' => 'toucher les produits vendus pour les mettre au panier, puis « 💰 ENCAISSER » ; pour une vente à crédit, choisir « Crédit » au moment de payer'],
        'stock' => ['ecran' => 'stock', 'bouton' => null, 'permission' => 'stock', 'page' => 'Stock', 'page_wolof' => 'Marsandiis',
            'a_faire' => 'pour changer le prix ou la quantité d’un produit : « ✏️ Modifier » sur sa fiche'],
        'stock-ajouter' => ['ecran' => 'stock', 'bouton' => 'stock-ajouter', 'permission' => 'stock', 'page' => 'Stock', 'page_wolof' => 'Marsandiis', 'appuyer' => '+ Ajouter',
            'a_faire' => 'appuyer sur « + Ajouter », puis remplir la fiche du nouveau produit'],
        'credits' => ['ecran' => 'credits', 'bouton' => null, 'permission' => 'vente', 'page' => 'Crédits', 'page_wolof' => 'Bor',
            'a_faire' => 'pour un remboursement : « 💰 Il a payé » sur la ligne du client ; pour un nouveau crédit : remplir le formulaire, puis « 💾 Enregistrer à crédit »'],
        'clients' => ['ecran' => 'clients', 'bouton' => null, 'permission' => 'clients', 'page' => 'Clients', 'page_wolof' => 'Kliyaan',
            'a_faire' => 'la liste des clients s’affiche ; toucher un client pour voir sa fiche'],
        'clients-ajouter' => ['ecran' => 'clients', 'bouton' => 'clients-ajouter', 'permission' => 'clients', 'page' => 'Clients', 'page_wolof' => 'Kliyaan', 'appuyer' => '+ Ajouter',
            'a_faire' => 'appuyer sur « + Ajouter », puis remplir la fiche du client'],
        'retours-nouveau' => ['ecran' => 'retours', 'bouton' => 'retours-nouveau', 'permission' => 'credits', 'page' => 'Retours', 'page_wolof' => 'Dellu', 'appuyer' => '+ Nouveau retour',
            'a_faire' => 'appuyer sur « + Nouveau retour », puis choisir la vente concernée'],
        'caisse' => ['ecran' => 'caisse', 'bouton' => 'caisse-cloturer', 'permission' => 'caisse', 'page' => 'Caisse', 'page_wolof' => 'Kees', 'appuyer' => '🔒 Clôturer la journée',
            'a_faire' => 'vérifier les montants du jour, puis appuyer sur « 🔒 Clôturer la journée »'],
        'rapports' => ['ecran' => 'rapports', 'bouton' => null, 'permission' => 'rapports', 'page' => 'Chiffres', 'page_wolof' => 'Limu',
            'a_faire' => 'les chiffres et les graphiques de la boutique s’affichent'],
        'inventaire' => ['ecran' => 'inventaire', 'bouton' => null, 'permission' => 'stock', 'page' => 'Inventaire', 'page_wolof' => 'Teew',
            'a_faire' => 'la liste des produits à compter s’affiche, avec le stock attendu'],
        'fournisseurs' => ['ecran' => 'fournisseurs', 'bouton' => null, 'permission' => 'fournisseurs', 'page' => 'Fournisseurs', 'page_wolof' => 'Jaaykat',
            'a_faire' => 'la liste des fournisseurs s’affiche'],
        'fournisseurs-ajouter' => ['ecran' => 'fournisseurs', 'bouton' => 'fournisseurs-ajouter', 'permission' => 'fournisseurs', 'page' => 'Fournisseurs', 'page_wolof' => 'Jaaykat', 'appuyer' => '+ Ajouter',
            'a_faire' => 'appuyer sur « + Ajouter », puis remplir la fiche du fournisseur'],
        'commandes' => ['ecran' => 'commandes', 'bouton' => null, 'permission' => 'commandes', 'page' => 'Commandes', 'page_wolof' => 'Komaand',
            'a_faire' => 'la liste des commandes aux fournisseurs s’affiche'],
        'commandes-nouvelle' => ['ecran' => 'commandes', 'bouton' => 'commandes-nouvelle', 'permission' => 'commandes', 'page' => 'Commandes', 'page_wolof' => 'Komaand', 'appuyer' => '+ Nouvelle',
            'a_faire' => 'appuyer sur « + Nouvelle » pour commander de la marchandise à un fournisseur'],
    ];

    /** Stock « bientôt fini » : 5 unités d'affichage ou moins (5 pièces, 5 kg, 5 L). */
    private const SEUIL_STOCK_FAIBLE = 5;

    private const REFUS = ['erreur' => 'Cette information n\'est pas accessible avec votre compte employé.'];

    /** Page à ouvrir après la réponse, si le cerveau a guidé. */
    public ?array $action = null;

    /** Chiffre à montrer en grand sous la réponse (« 47 350 F »). */
    public ?array $carte = null;

    /** @var string[] outils appelés, pour le journal */
    public array $utilises = [];

    public function __construct(
        private Utilisateur $proprietaire,
        private bool $estEmploye = false,
        private array $permissions = [],
    ) {}

    /** Un autre modèle reprend la question : ce que le précédent a fait ne compte plus. */
    public function oublierResultats(): void
    {
        $this->action = null;
        $this->carte = null;
        $this->utilises = [];
    }

    /** Les outils, au format attendu par Gemini (« function_declarations »). */
    public function declarations(): array
    {
        return [
            [
                'name' => 'consulter_ventes_du_jour',
                'description' => 'Nombre de ventes d\'aujourd\'hui, montant encaissé et montant vendu à crédit.',
            ],
            [
                'name' => 'consulter_stock',
                'description' => 'Quantité restante et prix d\'un produit de la boutique.',
                'parameters' => [
                    'type' => 'object',
                    'required' => ['produit'],
                    'properties' => [
                        'produit' => ['type' => 'string', 'description' => 'Nom du produit tel qu\'il figure dans le catalogue de la boutique.'],
                    ],
                ],
            ],
            [
                'name' => 'consulter_stock_faible',
                'description' => 'Produits bientôt épuisés (cinq unités ou moins).',
            ],
            [
                'name' => 'consulter_dette',
                'description' => 'Montant qu\'un client doit encore (ventes à crédit non remboursées).',
                'parameters' => [
                    'type' => 'object',
                    'required' => ['client'],
                    'properties' => [
                        'client' => ['type' => 'string', 'description' => 'Nom du client.'],
                    ],
                ],
            ],
            [
                'name' => 'guider',
                'description' => 'Ouvre une page de l\'application et fait clignoter le bouton sur lequel le commerçant doit appuyer.',
                'parameters' => [
                    'type' => 'object',
                    'required' => ['cible'],
                    'properties' => [
                        'cible' => [
                            'type' => 'string',
                            'enum' => array_keys(self::CIBLES),
                            'description' => 'vente : un client achète, encaisser une vente (comptant ou à crédit) ; stock-ajouter : créer un produit ; '
                                .'stock : voir ou corriger le stock, changer un prix ; credits : dettes et remboursements ; '
                                .'clients-ajouter : créer un client ; retours-nouveau : annuler une vente ou reprendre une marchandise ; '
                                .'caisse : clôturer la journée ; rapports : chiffres et graphiques ; '
                                .'commandes-nouvelle : le commerçant veut ACHETER ou commander de la marchandise à un fournisseur (se réapprovisionner) ; '
                                .'fournisseurs-ajouter : créer un fournisseur.',
                        ],
                    ],
                ],
            ],
        ];
    }

    /** Exécute un outil demandé par le cerveau ; la réponse est toujours un objet non vide. */
    public function executer(string $nom, array $arguments): array
    {
        $this->utilises[] = $nom;

        return match ($nom) {
            'consulter_ventes_du_jour' => $this->ventesDuJour(),
            'consulter_stock' => $this->stock((string) ($arguments['produit'] ?? '')),
            'consulter_stock_faible' => $this->stockFaible(),
            'consulter_dette' => $this->dette((string) ($arguments['client'] ?? '')),
            'guider' => $this->guider((string) ($arguments['cible'] ?? '')),
            default => ['erreur' => "Outil inconnu : {$nom}."],
        };
    }

    private function ventesDuJour(): array
    {
        if (! $this->autorise('vente')) {
            return self::REFUS;
        }
        $ligne = Vente::query()
            ->where('utilisateur_id', $this->proprietaire->id)
            // Même découpage de la journée que le chiffre de l'accueil (resume-jour).
            ->whereDate('cree_le', Carbon::today()->toDateString())
            ->selectRaw('COUNT(*) as nombre')
            ->selectRaw('COALESCE(SUM(CASE WHEN paye THEN total ELSE 0 END), 0) as encaisse')
            ->selectRaw('COALESCE(SUM(CASE WHEN paye THEN 0 ELSE total END), 0) as a_credit')
            ->first();

        $nombre = (int) $ligne->nombre;
        $encaisse = (int) $ligne->encaisse;
        $this->carte = [
            'valeur' => self::francs($encaisse),
            'libelle' => $nombre === 1 ? '1 vente aujourd\'hui' : "{$nombre} ventes aujourd'hui",
        ];

        return [
            'nombre_de_ventes' => $nombre,
            'encaisse_fcfa' => $encaisse,
            'vendu_a_credit_fcfa' => (int) $ligne->a_credit,
        ];
    }

    private function stock(string $recherche): array
    {
        if (! $this->autorise('stock', 'vente')) {
            return self::REFUS;
        }
        $trouves = $this->produitsCorrespondants($recherche);
        if ($trouves === []) {
            $noms = Produit::query()->where('utilisateur_id', $this->proprietaire->id)->pluck('nom')->all();

            return [
                'erreur' => "Aucun produit ne correspond à « {$recherche} » dans cette boutique.",
                'noms_proches' => self::nomsProches($recherche, $noms),
            ];
        }

        $produits = array_map(fn (Produit $p) => [
            'produit' => $p->nom,
            'stock' => self::quantite($p),
            'prix' => self::francs((int) $p->prix_vente).' le '.$p->libelleAffichage(),
        ], array_slice($trouves, 0, 5));

        if (count($produits) === 1) {
            $this->carte = ['valeur' => $produits[0]['stock'], 'libelle' => $produits[0]['produit'].' en stock'];
        }

        return ['produits' => $produits];
    }

    private function stockFaible(): array
    {
        if (! $this->autorise('stock', 'vente')) {
            return self::REFUS;
        }
        $faibles = Produit::query()
            ->where('utilisateur_id', $this->proprietaire->id)
            ->get(['id', 'nom', 'stock', 'unite_base'])
            ->filter(fn (Produit $p) => $p->stock / $p->facteurAffichage() <= self::SEUIL_STOCK_FAIBLE)
            ->sortBy(fn (Produit $p) => $p->stock / $p->facteurAffichage())
            ->take(8)
            ->map(fn (Produit $p) => ['produit' => $p->nom, 'stock' => self::quantite($p)])
            ->values()
            ->all();

        if ($faibles === []) {
            return ['message' => 'Aucun produit n\'est bientôt épuisé.'];
        }
        $this->carte = [
            'valeur' => count($faibles) === 1 ? '1 produit' : count($faibles).' produits',
            'libelle' => 'bientôt épuisés',
        ];

        return ['produits_bientot_epuises' => $faibles];
    }

    private function dette(string $recherche): array
    {
        if (! $this->autorise('vente', 'clients')) {
            return self::REFUS;
        }
        $cle = self::normaliser($recherche);
        if ($cle === '') {
            return ['erreur' => 'Quel client ?'];
        }

        // Un crédit est une vente non payée, rattachée à une fiche client ou
        // seulement à un nom tapé à la vente (`nom_client`).
        $ventes = Vente::query()
            ->where('utilisateur_id', $this->proprietaire->id)
            ->where('paye', false)
            ->get(['client_id', 'nom_client', 'total']);
        $noms = Client::query()->where('utilisateur_id', $this->proprietaire->id)->pluck('nom', 'id');

        $dettes = [];
        foreach ($ventes as $vente) {
            $nom = $vente->client_id && isset($noms[$vente->client_id]) ? $noms[$vente->client_id] : (string) $vente->nom_client;
            if ($nom === '' || ! self::correspond($cle, $nom)) {
                continue;
            }
            $dettes[$nom] = ($dettes[$nom] ?? 0) + (int) $vente->total;
        }

        if ($dettes === []) {
            $connu = $noms->first(fn ($nom) => self::correspond($cle, $nom));
            if ($connu !== null) {
                return ['client' => $connu, 'dette_fcfa' => 0, 'message' => 'Ce client ne doit rien.'];
            }
            // Un nom mal entendu (« Awa Sar ») : on propose les plus proches,
            // le cerveau demande lequel — il n'en choisit jamais un seul.
            $tousLesNoms = $noms->values()->merge($ventes->pluck('nom_client')->filter())->unique()->all();

            return [
                'erreur' => "Aucun client « {$recherche} » dans cette boutique.",
                'noms_proches' => self::nomsProches($recherche, $tousLesNoms),
            ];
        }
        arsort($dettes);
        $nom = array_key_first($dettes);
        $this->carte = ['valeur' => self::francs($dettes[$nom]), 'libelle' => "{$nom} vous doit"];

        return ['client' => $nom, 'dette_fcfa' => $dettes[$nom], 'autres_clients_semblables' => array_slice(array_keys($dettes), 1, 3)];
    }

    private function guider(string $cible): array
    {
        $page = self::CIBLES[$cible] ?? null;
        if (! $page) {
            return ['erreur' => "Page inconnue : {$cible}."];
        }
        if (! $this->autorise($page['permission'])) {
            return self::REFUS;
        }
        $this->action = ['type' => 'guider', 'ecran' => $page['ecran'], 'bouton' => $page['bouton']];

        $retour = [
            'statut' => 'page ouverte',
            'page' => $page['page'],
            'page_en_wolof' => $page['page_wolof'],
            'a_faire' => $page['a_faire'],
        ];
        if (isset($page['appuyer'])) {
            $retour['bouton_entoure'] = $page['appuyer'];
        } else {
            $retour['remarque'] = 'Aucun bouton n’est entouré sur cette page : dis seulement quoi y faire.';
        }

        return $retour;
    }

    /** @return Produit[] les produits dont le nom contient la recherche, le plus court d'abord */
    private function produitsCorrespondants(string $recherche): array
    {
        $cle = self::normaliser($recherche);
        if ($cle === '') {
            return [];
        }

        return Produit::query()
            ->where('utilisateur_id', $this->proprietaire->id)
            ->get(['id', 'nom', 'stock', 'prix_vente', 'unite_base'])
            ->filter(fn (Produit $p) => self::correspond($cle, $p->nom))
            ->sortBy(fn (Produit $p) => mb_strlen($p->nom))
            ->values()
            ->all();
    }

    /** Le propriétaire a tout ; l'employé, au moins une des permissions données. */
    private function autorise(string ...$permissions): bool
    {
        if (! $this->estEmploye) {
            return true;
        }
        foreach ($permissions as $permission) {
            if (! empty($this->permissions[$permission])) {
                return true;
            }
        }

        return false;
    }

    /** Chaque mot recherché figure dans le nom (sans accents ni majuscules). */
    private static function correspond(string $cleRecherche, string $nom): bool
    {
        $nom = self::normaliser($nom);
        foreach (explode(' ', $cleRecherche) as $mot) {
            if ($mot !== '' && ! str_contains($nom, $mot)) {
                return false;
            }
        }

        return true;
    }

    /** @return string[] au plus trois noms qui ressemblent à la recherche */
    private static function nomsProches(string $recherche, array $noms): array
    {
        $cle = self::normaliser($recherche);
        $scores = [];
        foreach ($noms as $nom) {
            similar_text($cle, self::normaliser((string) $nom), $pourcentage);
            if ($pourcentage >= 60) {
                $scores[(string) $nom] = $pourcentage;
            }
        }
        arsort($scores);

        return array_slice(array_keys($scores), 0, 3);
    }

    private static function normaliser(string $texte): string
    {
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', Str::lower(Str::ascii($texte))));
    }

    private static function quantite(Produit $produit): string
    {
        $valeur = round($produit->stock / $produit->facteurAffichage(), 2);
        $unite = $produit->libelleAffichage();
        $nombre = rtrim(rtrim(number_format($valeur, 2, ',', ' '), '0'), ',');
        if ($unite === 'pièce') {
            $unite = $valeur > 1 ? 'pièces' : 'pièce';
        }

        return "{$nombre} {$unite}";
    }

    private static function francs(int $montant): string
    {
        return number_format($montant, 0, ',', ' ').' F';
    }
}
