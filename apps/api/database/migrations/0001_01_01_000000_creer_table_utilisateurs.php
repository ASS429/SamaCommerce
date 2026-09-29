<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Applique la migration.
     */
    public function up(): void
    {
        // Garde-fou : une base créée avant la francisation contient `users`. Si
        // cette migration s'exécute malgré tout, c'est que ses migrations déjà
        // jouées n'ont pas été reconnues sous leur nom français — continuer
        // créerait des tables françaises VIDES à côté des vraies.
        if (Schema::hasTable('users')) {
            throw new \RuntimeException(
                'Base anglaise détectée : lancez `php artisan base:harmoniser-migrations` puis relancez la migration.'
            );
        }

        // Schéma fidèle à l'app d'origine (l'« identifiant » est l'adresse e-mail).
        Schema::create('utilisateurs', function (Blueprint $table) {
            $table->id();
            $table->string('identifiant')->unique();
            $table->string('mot_de_passe');
            $table->string('nom_commerce')->nullable();
            $table->string('telephone')->nullable();
            $table->string('role')->default('commercant');           // commercant | admin
            $table->string('statut')->default('Actif');              // Actif | Bloqué
            $table->string('plan')->default('Gratuit');              // Gratuit | Premium
            $table->string('statut_paiement')->default('À jour');
            $table->string('moyen_paiement')->nullable();
            $table->date('expiration')->nullable();
            $table->decimal('montant', 12, 2)->default(0);
            $table->string('statut_demande_premium')->default('validé'); // validé | en attente | rejeté
            $table->string('jeton_souvenir', 100)->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
        });

        // Codes de « mot de passe oublié ». Seul notre code s'en sert : le
        // mécanisme de réinitialisation de Laravel n'est pas employé.
        Schema::create('codes_reinitialisation', function (Blueprint $table) {
            $table->string('identifiant')->primary();
            $table->string('code_hache');
            $table->timestamp('cree_le')->nullable();
        });

        // Table du framework (pilote de sessions « database ») : structure imposée.
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Annule la migration.
     */
    public function down(): void
    {
        Schema::dropIfExists('utilisateurs');
        Schema::dropIfExists('codes_reinitialisation');
        Schema::dropIfExists('sessions');
    }
};
