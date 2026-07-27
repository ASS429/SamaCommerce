<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'username', 'password', 'company_name', 'current_boutique_id', 'phone', 'role', 'status',
        'plan', 'payment_status', 'payment_method', 'expiration', 'amount', 'upgrade_status', 'twofa_enabled',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'expiration' => 'date',
            'amount' => 'decimal:2',
            'twofa_enabled' => 'boolean',
        ];
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    public function fournisseurs(): HasMany
    {
        return $this->hasMany(Fournisseur::class);
    }

    public function restockOrders(): HasMany
    {
        return $this->hasMany(RestockOrder::class);
    }

    public function boutiques(): HasMany
    {
        return $this->hasMany(Boutique::class, 'owner_id');
    }

    /** Boutique principale (créée à l'inscription). */
    public function primaryBoutique()
    {
        return $this->boutiques()->where('is_primary', true)->first();
    }
}
