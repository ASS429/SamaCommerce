<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Photo de profil du commerçant.
 *
 * Même format que les autres photos de fiches (data-URL réduite à 256 px côté
 * téléphone, cf. apps/web/src/outils/photo.ts) : elle s'affiche dans l'en-tête
 * de l'application, où l'avatar ne montrait jusqu'ici que deux initiales.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('utilisateurs', 'photo')) {
            Schema::table('utilisateurs', fn (Blueprint $t) => $t->text('photo')->nullable());
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('utilisateurs', 'photo')) {
            Schema::table('utilisateurs', fn (Blueprint $t) => $t->dropColumn('photo'));
        }
    }
};
