<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Tontine;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    private ?int $boutiqueId = null;

    public function run(): void
    {
        // Commerçant de démo
        $user = User::updateOrCreate(
            ['username' => 'demo@samacommerce.sn'],
            [
                'password' => Hash::make('password'),
                'company_name' => 'Ma Boutique',
                'phone' => '77 123 45 67',
                'role' => 'user',
                'plan' => 'Premium',
                'upgrade_status' => 'validé',
            ],
        );

        // Boutique principale + boutique secondaire de démo
        $boutique = $user->boutiques()->updateOrCreate(['is_primary' => true], ['name' => 'Ma Boutique', 'emoji' => '🏪']);
        $user->boutiques()->firstOrCreate(['name' => 'Boutique Marché'], ['emoji' => '🏬', 'is_primary' => false]);
        $user->update(['current_boutique_id' => $boutique->id]);
        $this->boutiqueId = $boutique->id;

        // Admin
        User::updateOrCreate(
            ['username' => 'admin@samacommerce.sn'],
            ['password' => Hash::make('password'), 'company_name' => 'Admin', 'role' => 'admin', 'plan' => 'Premium'],
        );

        // Employé de démo (vendeur/caissier) — déjà accepté, permissions vente + caisse
        $employe = User::updateOrCreate(
            ['username' => 'employe@samacommerce.sn'],
            ['password' => Hash::make('password'), 'company_name' => 'Employé démo', 'role' => 'user'],
        );
        \App\Models\BoutiqueMember::updateOrCreate(
            ['owner_id' => $user->id, 'email' => 'employe@samacommerce.sn'],
            [
                'ref_boutique_id' => $boutique->id, 'member_id' => $employe->id,
                'role' => 'employe', 'status' => 'accepted', 'accepted_at' => Carbon::now(),
                'permissions' => ['vente' => true, 'caisse' => true, 'credits' => true, 'clients' => true,
                    'stock' => false, 'categories' => false, 'rapports' => false,
                    'fournisseurs' => false, 'commandes' => false, 'livraisons' => false],
            ],
        );

        // Catégories
        $alim = Category::updateOrCreate(['user_id' => $user->id, 'name' => 'Alimentation'], ['emoji' => '🍞']);
        $boisson = Category::updateOrCreate(['user_id' => $user->id, 'name' => 'Boissons'], ['emoji' => '🥤']);

        // Produits (prix d'achat / prix de vente / stock)
        $produits = [
            $this->product($user, $alim, 'Riz parfumé (kg)', 440, 600, 80),
            $this->product($user, $alim, 'Huile (litre)', 1000, 1200, 40),
            $this->product($user, $alim, 'Sucre (kg)', 550, 700, 60),
            $this->product($user, $boisson, 'Jus en sachet', 100, 200, 120),
            $this->product($user, $boisson, 'Eau minérale', 200, 300, 90),
        ];

        // Ventes sur 30 jours (espèces / wave / orange)
        $methods = ['especes', 'wave', 'orange'];
        for ($d = 30; $d >= 1; $d--) {
            $date = Carbon::now()->subDays($d);
            foreach (range(1, random_int(1, 3)) as $i) {
                $p = $produits[array_rand($produits)];
                $qty = random_int(1, 4);
                $this->sale($user, $p, $qty, $methods[array_rand($methods)], $date);
            }
        }

        // Une vente à crédit (impayée)
        $this->sale($user, $produits[0], 5, 'credit', Carbon::now()->subDays(10), [
            'client_name' => 'Fatou Ndiaye', 'client_phone' => '77 987 65 43',
            'due_date' => Carbon::now()->addDays(5), 'paid' => false,
        ]);

        // Tontines
        Tontine::firstOrCreate(['name' => 'Tontine du marché'], ['type' => 'Hebdomadaire', 'amount' => 5000, 'members' => 12]);

        $this->command?->info('✅ Démo créée — login: demo@samacommerce.sn / password (admin@samacommerce.sn aussi).');
    }

    private function product(User $u, Category $c, string $name, float $achat, float $vente, int $stock): Product
    {
        return Product::updateOrCreate(
            ['user_id' => $u->id, 'name' => $name],
            ['boutique_id' => $this->boutiqueId, 'category_id' => $c->id, 'price_achat' => $achat, 'price' => $vente, 'stock' => $stock],
        );
    }

    private function sale(User $u, Product $p, int $qty, string $method, Carbon $date, array $extra = []): void
    {
        Sale::create(array_merge([
            'user_id' => $u->id,
            'boutique_id' => $this->boutiqueId,
            'product_id' => $p->id,
            'quantity' => $qty,
            'total' => (float) $p->price * $qty,
            'payment_method' => $method,
            'paid' => $method !== 'credit',
            'created_at' => $date,
            'updated_at' => $date,
        ], $extra));

        $p->decrement('stock', $qty);
    }
}
