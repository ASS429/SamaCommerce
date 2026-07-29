<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Photos des fiches (produit, client, fournisseur, boutique, employé).
 *
 * La photo est stockée en data-URL (image WebP/JPEG réduite à 256 px côté
 * téléphone, ~4 à 10 Ko). Choix assumé : pas de stockage objet à déployer, la
 * photo suit l'entité — donc aussi les sauvegardes et le cache hors-ligne.
 * Un garde-fou de 60 Ko est appliqué à la validation (cf. Controller::PHOTO_RULES).
 *
 * On en profite pour compléter la FICHE EMPLOYÉ : jusqu'ici un membre n'était
 * qu'une adresse email, impossible à reconnaître pour un patron qui ne lit pas.
 */
return new class extends Migration
{
    /** Tables recevant une simple colonne photo. */
    private const TABLES = ['products', 'clients', 'fournisseurs', 'boutiques'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'photo')) {
                Schema::table($table, fn (Blueprint $t) => $t->text('photo')->nullable());
            }
        }

        if (Schema::hasTable('boutique_members')) {
            Schema::table('boutique_members', function (Blueprint $t) {
                if (! Schema::hasColumn('boutique_members', 'photo')) {
                    $t->text('photo')->nullable();
                }
                if (! Schema::hasColumn('boutique_members', 'name')) {
                    $t->string('name')->nullable();
                }
                if (! Schema::hasColumn('boutique_members', 'phone')) {
                    $t->string('phone', 32)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'photo')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropColumn('photo'));
            }
        }

        if (Schema::hasTable('boutique_members')) {
            Schema::table('boutique_members', function (Blueprint $t) {
                $t->dropColumn(['photo', 'name', 'phone']);
            });
        }
    }
};
