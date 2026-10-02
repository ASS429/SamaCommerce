<?php

namespace App\Models;

/**
 * Règles d'abonnement (une seule ligne) : essai offert, délai de grâce,
 * remise annuelle, numéros où payer, rappels d'échéance.
 */
class ReglagesAbonnement extends Modele
{
    protected $table = 'reglages_abonnement';

    protected $fillable = [
        'duree_essai_jours', 'plan_essai', 'delai_grace_jours', 'mois_offerts_annuel',
        'numero_wave', 'numero_orange', 'nom_beneficiaire', 'numero_contact', 'reference_obligatoire',
        'capture_autorisee', 'rappels', 'message_relance',
    ];

    protected $casts = [
        'duree_essai_jours' => 'integer',
        'delai_grace_jours' => 'integer',
        'mois_offerts_annuel' => 'integer',
        'reference_obligatoire' => 'boolean',
        'capture_autorisee' => 'boolean',
        'rappels' => 'array',
    ];

    public const RAPPELS = ['j-7' => '7 jours avant', 'j-1' => 'La veille', 'j0' => 'Le jour de l’échéance', 'grace' => 'Pendant le délai de grâce'];

    /** Réglages lus une fois par REQUÊTE (conteneur, et non propriété statique). */
    private const CLE = 'abonnements.reglages';

    /** Les réglages en vigueur, lus une fois par requête. */
    public static function courants(): self
    {
        if (! app()->bound(self::CLE)) {
            app()->instance(self::CLE, static::query()->firstOrCreate(['id' => 1], [
                'rappels' => array_keys(self::RAPPELS),
            ]));
        }

        return app(self::CLE);
    }

    public static function oublier(): void
    {
        app()->forgetInstance(self::CLE);
    }

    /** Numéro où payer selon le moyen, ou null s'il n'est pas encore renseigné. */
    public function numeroPour(string $moyen): ?string
    {
        return match ($moyen) {
            'wave' => $this->numero_wave,
            'orange' => $this->numero_orange,
            default => null,
        };
    }
}
