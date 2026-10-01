<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Compte : commerçant, employé ou administrateur.
 *
 * Hérite de la classe d'authentification de Laravel (et non de Modele) : les
 * horodatages sont donc redéclarés ici, comme les deux colonnes que Laravel lit
 * lui-même (mot de passe, jeton « se souvenir de moi »).
 */
class Utilisateur extends Authenticatable
{
    use HasApiTokens, Notifiable;

    const CREATED_AT = 'cree_le';

    const UPDATED_AT = 'modifie_le';

    protected $table = 'utilisateurs';

    protected $authPasswordName = 'mot_de_passe';

    protected $rememberTokenName = 'jeton_souvenir';

    protected $fillable = [
        'identifiant', 'mot_de_passe', 'nom_commerce', 'boutique_active_id', 'telephone', 'role', 'statut',
        'plan', 'statut_paiement', 'moyen_paiement', 'expiration', 'montant', 'statut_demande_premium', 'double_facteur_actif',
        'photo', 'preferences', 'essai_jusqu_au',
    ];

    /**
     * `essai_jusqu_au` ne voyage pas avec le compte : l'état d'abonnement
     * complet (essai, échéance, délai de grâce, limites) est servi par
     * /abonnement, calculé à partir des paiements validés.
     */
    protected $hidden = ['mot_de_passe', 'jeton_souvenir', 'essai_jusqu_au'];

    protected function casts(): array
    {
        return [
            'mot_de_passe' => 'hashed',
            'expiration' => 'date',
            'essai_jusqu_au' => 'date',
            'montant' => 'decimal:2',
            'double_facteur_actif' => 'boolean',
            'preferences' => 'array',
        ];
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Categorie::class);
    }

    public function produits(): HasMany
    {
        return $this->hasMany(Produit::class);
    }

    public function ventes(): HasMany
    {
        return $this->hasMany(Vente::class);
    }

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    public function fournisseurs(): HasMany
    {
        return $this->hasMany(Fournisseur::class);
    }

    public function commandes(): HasMany
    {
        return $this->hasMany(Commande::class);
    }

    public function boutiques(): HasMany
    {
        return $this->hasMany(Boutique::class, 'proprietaire_id');
    }

    /** Boutique principale (créée à l'inscription). */
    public function boutiquePrincipale()
    {
        return $this->boutiques()->where('est_principale', true)->first();
    }
}
