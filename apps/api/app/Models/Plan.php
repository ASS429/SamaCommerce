<?php

namespace App\Models;

use Illuminate\Support\Str;

/**
 * Un plan du catalogue : Gratuit, Essentiel, Pro, Entreprise.
 *
 * Les limites valent NULL quand elles sont illimitées. Les fonctionnalités
 * sont des codes (voir FONCTIONNALITES) : ce qui n'y figure pas est réservé
 * aux plans supérieurs. Le socle (vente, caisse, stock, clients et crédit,
 * mode hors ligne, reçus) n'a pas de code : il est inclus partout.
 */
class Plan extends Modele
{
    protected $table = 'plans';

    protected $fillable = [
        'code', 'nom', 'accroche', 'prix_mensuel', 'sur_devis', 'prix_a_partir_de',
        'max_boutiques', 'max_employes', 'max_produits', 'quota_ia_mensuel', 'fonctionnalites', 'ordre',
    ];

    protected $casts = [
        'prix_mensuel' => 'integer',
        'sur_devis' => 'boolean',
        'prix_a_partir_de' => 'integer',
        'max_boutiques' => 'integer',
        'max_employes' => 'integer',
        'max_produits' => 'integer',
        'quota_ia_mensuel' => 'integer',
        'fonctionnalites' => 'array',
        'ordre' => 'integer',
    ];

    /** Fonctionnalités réservables, avec leur libellé (écrans, messages). */
    public const FONCTIONNALITES = [
        'rapports_complets' => 'Rapports complets',
        'exports' => 'Exports PDF et Excel',
        'relances_whatsapp' => 'Relances de crédit par WhatsApp',
        'fournisseurs_commandes' => 'Fournisseurs et commandes',
        'inventaire_retours' => 'Inventaire et retours',
        'livraisons' => 'Livraisons',
        'journal_activite' => 'Journal d’activité',
        'tableau_boutiques' => 'Tableau commun à toutes les boutiques',
        'accompagnement' => 'Installation et formation sur place',
    ];

    /** Limites chiffrées : clé publique => colonne. */
    public const LIMITES = [
        'boutiques' => 'max_boutiques',
        'employes' => 'max_employes',
        'produits' => 'max_produits',
        'ia' => 'quota_ia_mensuel',
    ];

    /** @var array<string, self>|null Catalogue lu une fois par requête. */
    private static ?array $catalogue = null;

    /** @return array<string, self> code => plan, du moins cher au plus complet. */
    public static function catalogue(): array
    {
        return self::$catalogue ??= static::query()->orderBy('ordre')->get()->keyBy('code')->all();
    }

    /** À appeler après une modification du catalogue. */
    public static function oublierCatalogue(): void
    {
        self::$catalogue = null;
    }

    public static function parCode(string $code): self
    {
        return self::catalogue()[$code] ?? self::catalogue()['gratuit'];
    }

    /**
     * Plan désigné par son NOM (colonne `utilisateurs.plan`). « Premium »,
     * l'ancien plan unique, correspond au plan Pro (même prix, 5 000 F).
     */
    public static function depuisNom(?string $nom): self
    {
        $code = Str::lower(Str::ascii((string) $nom));

        return self::parCode($code === 'premium' ? 'pro' : $code);
    }

    public function inclut(string $fonctionnalite): bool
    {
        return in_array($fonctionnalite, $this->fonctionnalites ?? [], true);
    }

    public function limite(string $cle): ?int
    {
        return $this->{self::LIMITES[$cle]};
    }

    public function estPayant(): bool
    {
        return $this->code !== 'gratuit';
    }

    /** Prix de la période, en francs CFA : un an = 12 mois moins les mois offerts. */
    public function prix(string $periode, int $moisOfferts): int
    {
        return $periode === 'an'
            ? $this->prix_mensuel * max(1, 12 - $moisOfferts)
            : $this->prix_mensuel;
    }

    /** Premier plan (le moins cher) qui satisfait la condition. */
    public static function premierQui(callable $condition): ?self
    {
        foreach (self::catalogue() as $plan) {
            if ($condition($plan)) {
                return $plan;
            }
        }

        return null;
    }
}
