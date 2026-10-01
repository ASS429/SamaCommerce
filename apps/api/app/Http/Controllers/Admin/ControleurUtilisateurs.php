<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Mail\RappelAbonnement;
use App\Models\ReglagesAbonnement;
use App\Models\Utilisateur;
use App\Services\Abonnements;
use App\Services\RappelsAbonnement;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class ControleurUtilisateurs extends Controleur
{
    public function lister()
    {
        return Utilisateur::orderByDesc('id')->get();
    }

    /**
     * Compte créé par l'administrateur : même départ qu'une inscription
     * (boutique principale, essai offert), avec un mot de passe PROVISOIRE
     * tiré au hasard, montré une seule fois pour être transmis au commerçant.
     * (Avant : tous ces comptes recevaient le mot de passe « password ».)
     * Le plan se change ensuite depuis la fiche du commerçant.
     */
    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'identifiant' => ['required', 'string', 'max:255', 'unique:utilisateurs,identifiant'],
            'nom_commerce' => ['nullable', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
        ]);

        $motDePasse = Str::lower(Str::random(4)).'-'.random_int(1000, 9999).'-'.Str::lower(Str::random(4));
        $essai = ReglagesAbonnement::courants()->duree_essai_jours;

        $utilisateur = Utilisateur::create([
            'identifiant' => $donnees['identifiant'],
            'mot_de_passe' => Hash::make($motDePasse),
            'nom_commerce' => $donnees['nom_commerce'] ?? null,
            'telephone' => $donnees['telephone'] ?? null,
            'role' => 'commercant',
            'statut' => 'Actif',
            'plan' => 'Gratuit',
            'statut_paiement' => 'À jour',
            'statut_demande_premium' => 'validé',
            'essai_jusqu_au' => $essai > 0 ? Carbon::today()->addDays($essai) : null,
        ]);
        $boutique = $utilisateur->boutiques()->create([
            'nom' => $donnees['nom_commerce'] ?? 'Ma Boutique',
            'emoji' => '🏪', 'est_principale' => true,
        ]);
        $utilisateur->update(['boutique_active_id' => $boutique->id]);

        return response()->json($utilisateur->fresh()->toArray() + ['mot_de_passe_provisoire' => $motDePasse], 201);
    }

    public function bloquer(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        $utilisateur->update(['statut' => 'Bloqué']);
        return $utilisateur;
    }

    public function activer(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        $utilisateur->update(['statut' => 'Actif', 'statut_paiement' => 'À jour']);
        return $utilisateur;
    }

    public function supprimer(int $id)
    {
        Utilisateur::findOrFail($id)->delete();
        return response()->json(['message' => 'Utilisateur supprimé']);
    }

    /**
     * Relance : message prêt à envoyer sur WhatsApp (lien wa.me), et e-mail
     * envoyé si l'identifiant du commerçant est une adresse e-mail.
     * (Avant : la route répondait « Rappel envoyé » sans rien envoyer.)
     */
    public function relancer(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        $etat = Abonnements::etat($utilisateur);
        $texte = RappelsAbonnement::texte($utilisateur, $etat);

        $emailEnvoye = false;
        if (filter_var($utilisateur->identifiant, FILTER_VALIDATE_EMAIL)) {
            try {
                $plan = $etat->planPaye ?? $etat->planEssai ?? $etat->planExpire ?? $etat->plan;
                $echeance = $etat->finLe ?? $etat->essaiJusquAu ?? $etat->expireLe;
                Mail::to($utilisateur->identifiant)->send(new RappelAbonnement($texte, $plan->nom, $echeance ? RappelsAbonnement::dateLongue($echeance) : 'bientôt'));
                $emailEnvoye = true;
            } catch (\Throwable $e) {
                Log::warning('[relance] e-mail impossible', ['utilisateur_id' => $utilisateur->id, 'cause' => $e->getMessage()]);
            }
        }

        $lien = RappelsAbonnement::lienWhatsApp($utilisateur, $etat);

        return response()->json([
            'message' => match (true) {
                $emailEnvoye && $lien !== null => 'E-mail envoyé. Ouvrez WhatsApp pour envoyer aussi le message.',
                $emailEnvoye => 'E-mail de relance envoyé.',
                $lien !== null => 'Message prêt : ouvrez WhatsApp pour l’envoyer.',
                default => 'Aucun moyen de joindre ce commerçant : ajoutez son téléphone.',
            },
            'texte' => $texte,
            'lien_whatsapp' => $lien,
            'email_envoye' => $emailEnvoye,
        ]);
    }
}
