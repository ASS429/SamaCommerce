<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Désactive le double facteur de tous les comptes qui l'avaient activé AVANT
 * le 30/09/2026.
 *
 * POURQUOI. Jusque-là, l'option s'activait d'un clic, et le code de connexion
 * n'était envoyé NULLE PART. Aucune de ces activations n'a donc jamais
 * fonctionné : elles ne protégeaient rien, et enfermaient dehors le commerçant
 * qui se connectait depuis un nouvel appareil. Désormais, l'option ne s'active
 * qu'après la saisie d'un code reçu par e-mail : chacun peut la réactiver ainsi.
 *
 * Sans retour arrière : rien ne permettrait de distinguer ensuite ces comptes,
 * et les réactiver les enfermerait de nouveau.
 */
return new class extends Migration
{
    public function up(): void
    {
        $nombre = DB::table('utilisateurs')->where('double_facteur_actif', true)
            ->update(['double_facteur_actif' => false]);

        Log::warning("[double-facteur] {$nombre} activation(s) jamais vérifiée(s) désactivée(s)");
    }

    public function down(): void
    {
        // Volontairement vide (cf. ci-dessus).
    }
};
