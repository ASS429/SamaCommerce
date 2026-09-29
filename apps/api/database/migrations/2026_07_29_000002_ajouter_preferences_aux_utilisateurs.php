<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Préférences d'affichage du compte, synchronisées entre appareils.
 *
 * Contient aujourd'hui les sections masquées (`sections_masquees`) et
 * l'impression automatique du reçu (`impression_auto`). Une colonne JSON
 * plutôt qu'une colonne par réglage : ce sont des options d'INTERFACE, sans
 * requête ni agrégat, et chaque nouvelle option se serait sinon payée d'une
 * migration.
 *
 * Attention : ces préférences appartiennent au compte RÉELLEMENT connecté.
 * Pour un employé, `$request->user()` désigne le propriétaire (cf. intergiciel
 * ResoudreProprietaire) — les écrire là écraserait les réglages du patron et
 * les partagerait entre tous ses vendeurs.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('utilisateurs', 'preferences')) {
            Schema::table('utilisateurs', fn (Blueprint $t) => $t->json('preferences')->nullable());
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('utilisateurs', 'preferences')) {
            Schema::table('utilisateurs', fn (Blueprint $t) => $t->dropColumn('preferences'));
        }
    }
};
