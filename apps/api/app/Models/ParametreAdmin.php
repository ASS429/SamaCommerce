<?php

namespace App\Models;

class ParametreAdmin extends Modele
{
    protected $table = 'parametres_admin';

    protected $fillable = [
        'admin_id', 'nom_application', 'email_contact', 'fuseau_horaire', 'prix_premium',
        'delai_grace', 'alertes_actives', 'notifier_nouveaux_abonnes', 'notifier_retards_paiement',
        'notifier_rapports', 'sessions_multiples', 'double_facteur_actif',
    ];

    protected $casts = [
        'prix_premium' => 'decimal:2',
        'delai_grace' => 'integer',
        'alertes_actives' => 'boolean',
        'notifier_nouveaux_abonnes' => 'boolean',
        'notifier_retards_paiement' => 'boolean',
        'notifier_rapports' => 'boolean',
        'sessions_multiples' => 'boolean',
        'double_facteur_actif' => 'boolean',
    ];
}
