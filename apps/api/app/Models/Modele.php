<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Classe mère de nos modèles : horodatages aux noms français.
 *
 * Laravel nomme par défaut ses colonnes d'horodatage `created_at`,
 * `updated_at` et `deleted_at`. Ces trois constantes sont le mécanisme prévu
 * par le framework pour les renommer : l'enregistrement automatique des dates,
 * `latest()` et la corbeille (SoftDeletes) les suivent.
 *
 * Le nom de table est toujours déclaré explicitement dans chaque modèle : le
 * pluriel que devine Laravel est anglais (« journal » → « journals »).
 */
abstract class Modele extends Model
{
    const CREATED_AT = 'cree_le';

    const UPDATED_AT = 'modifie_le';

    const DELETED_AT = 'supprime_le';
}
