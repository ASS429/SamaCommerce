<?php

namespace App\Http\Controllers;

use App\Models\MembreBoutique;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class ControleurMembre extends Controleur
{
    private function utilisateurReel(Request $requete)
    {
        return $requete->attributes->get('utilisateur_reel') ?? $requete->user();
    }

    public function lister(Request $requete)
    {
        $selection = MembreBoutique::where('proprietaire_id', $requete->user()->id)
            ->leftJoin('utilisateurs', 'utilisateurs.id', '=', 'membres_boutique.membre_id')
            ->orderByDesc('membres_boutique.cree_le');

        if ($requete->filled('boutique_id')) {
            $selection->where('membres_boutique.boutique_rattachement_id', $requete->integer('boutique_id'));
        }

        // Les colonnes du membre priment : `membres_boutique.nom/telephone` sont
        // la fiche saisie par le patron, `utilisateurs.*` ne sont qu'un repli
        // quand l'employé a déjà un compte. Sans alias, la jointure les écraserait.
        return $selection->get(['membres_boutique.*', 'utilisateurs.nom_commerce as nom_commerce_utilisateur', 'utilisateurs.telephone as telephone_utilisateur']);
    }

    public function inviter(Request $requete)
    {
        $donnees = $requete->validate([
            'email' => ['required', 'email'],
            'role' => ['nullable', 'in:employe,gerant'],
            'permissions' => ['nullable', 'array'],
            'boutique_id' => ['nullable', 'integer'],
            // Fiche employé : un patron reconnaît un visage et un prénom, pas une
            // adresse e-mail. Ces champs sont facultatifs mais fortement conseillés.
            'nom' => ['nullable', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'photo' => self::REGLES_PHOTO,
        ]);

        $proprietaire = $requete->user();
        $role = $donnees['role'] ?? 'employe';
        $boutiqueId = $donnees['boutique_id'] ?? $proprietaire->boutique_active_id ?? $proprietaire->boutiquePrincipale()?->id;

        $doublon = MembreBoutique::where('proprietaire_id', $proprietaire->id)
            ->where('boutique_rattachement_id', $boutiqueId)
            ->where('email', $donnees['email'])->where('statut', '!=', 'refusee')->exists();
        if ($doublon) {
            return response()->json(['erreur' => 'Cet email est déjà invité dans cette boutique'], 400);
        }

        $jeton = Str::random(48);
        $membre = MembreBoutique::create([
            'proprietaire_id' => $proprietaire->id,
            'boutique_rattachement_id' => $boutiqueId,
            'email' => $donnees['email'],
            'role' => $role,
            'statut' => 'invitee',
            'permissions' => $donnees['permissions'] ?? MembreBoutique::permissionsParDefaut($role),
            'nom' => $donnees['nom'] ?? null,
            'telephone' => $donnees['telephone'] ?? null,
            'photo' => $donnees['photo'] ?? null,
            'jeton_invitation' => $jeton,
            'invitation_expire_le' => Carbon::now()->addHours(72),
        ]);

        \App\Models\JournalActivite::consigner($requete, 'equipe.invitation', $donnees['email'].' ('.$role.')');

        return response()->json([
            'message' => 'Invitation créée',
            'membre' => $membre,
            'jeton_invitation' => $jeton,
            'lien_invitation' => $this->lienInvitation($requete, $jeton),
        ], 201);
    }

    /**
     * Adresse complète à envoyer par WhatsApp.
     *
     * Elle était déduite du seul en-tête `Origin`. Quand cet en-tête manque —
     * une application native (le client mobile), un script, un webhook — le lien
     * dégénérait en `/?invitation=…` : une adresse relative, donc rien de
     * cliquable dans WhatsApp, et l'employé restait à la porte. On part donc
     * d'une origine CONFIGURÉE, et l'en-tête ne sert plus que de repli commode
     * en développement.
     */
    private function lienInvitation(Request $requete, string $jeton): string
    {
        $candidates = [
            config('app.url_site_web'),
            collect(config('cors.allowed_origins'))->first(fn ($o) => $o !== '*'),
            $requete->headers->get('origin'),
            config('app.url'),
        ];

        foreach ($candidates as $base) {
            $base = rtrim((string) $base, '/');
            if ($base !== '' && str_starts_with($base, 'http')) {
                return "{$base}/?invitation={$jeton}";
            }
        }

        return "/?invitation={$jeton}";
    }

    /**
     * Aperçu PUBLIC d'une invitation.
     *
     * L'invité n'a pas encore de compte : il ne peut donc rien lire derrière
     * `auth:sanctum`. Sans cet aperçu, l'écran de connexion ne pouvait afficher
     * qu'un lien opaque — or nos utilisateurs lisent peu : voir le nom de la
     * boutique qui les invite est ce qui rend l'invitation compréhensible.
     * Le jeton (48 caractères aléatoires) EST le secret ; on n'expose rien
     * d'autre que ce que l'invitation contient déjà.
     */
    public function apercu(string $jeton)
    {
        $invitation = MembreBoutique::where('jeton_invitation', $jeton)->where('statut', 'invitee')->first();
        if (! $invitation) {
            return response()->json(['erreur' => 'Invitation invalide ou déjà utilisée'], 404);
        }
        if ($invitation->invitation_expire_le && $invitation->invitation_expire_le->isPast()) {
            return response()->json(['erreur' => 'Cette invitation a expiré.'], 410);
        }

        return response()->json([
            'boutique' => $invitation->proprietaire()->first(['nom_commerce'])?->nom_commerce,
            'role' => $invitation->role,
            'email' => $invitation->email,
            'nom' => $invitation->nom,
        ]);
    }

    public function accepter(Request $requete)
    {
        $donnees = $requete->validate(['jeton_invitation' => ['required', 'string']]);
        $utilisateurReel = $this->utilisateurReel($requete);

        $invitation = MembreBoutique::where('jeton_invitation', $donnees['jeton_invitation'])->where('statut', 'invitee')->first();
        if (! $invitation) {
            return response()->json(['erreur' => 'Invitation invalide ou expirée'], 404);
        }
        if ($invitation->invitation_expire_le && $invitation->invitation_expire_le->isPast()) {
            $invitation->update(['statut' => 'refusee']);
            return response()->json(['erreur' => 'Cette invitation a expiré.'], 410);
        }

        $invitation->update([
            'statut' => 'acceptee', 'membre_id' => $utilisateurReel->id,
            'acceptee_le' => Carbon::now(), 'jeton_invitation' => null,
        ]);

        return response()->json([
            'message' => 'Invitation acceptée',
            'role' => $invitation->role,
            'permissions' => $invitation->permissions,
            'boutique' => $invitation->proprietaire()->first(['id', 'nom_commerce']),
        ]);
    }

    /** Boutique et permissions de l'employé connecté. */
    public function maBoutique(Request $requete)
    {
        $utilisateurReel = $this->utilisateurReel($requete);
        $adhesion = MembreBoutique::where('membre_id', $utilisateurReel->id)->where('statut', 'acceptee')->first();
        if (! $adhesion) {
            return response()->json(null);
        }

        return response()->json([
            'role' => $adhesion->role,
            'permissions' => $adhesion->permissions,
            'proprietaire' => $adhesion->proprietaire()->first(['id', 'nom_commerce']),
            'boutique_rattachement_id' => $adhesion->boutique_rattachement_id,
        ]);
    }

    public function modifier(Request $requete, int $id)
    {
        $membre = MembreBoutique::where('proprietaire_id', $requete->user()->id)->findOrFail($id);
        $membre->update($requete->validate([
            'permissions' => ['nullable', 'array'],
            'role' => ['nullable', 'in:employe,gerant'],
            'nom' => ['nullable', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'photo' => self::REGLES_PHOTO,
        ]));

        return $membre;
    }

    public function supprimer(Request $requete, int $id)
    {
        $membre = MembreBoutique::where('proprietaire_id', $requete->user()->id)->findOrFail($id);
        \App\Models\JournalActivite::consigner($requete, 'equipe.retrait', $membre->email);
        $membre->delete();

        return response()->json(['message' => 'Membre retiré']);
    }
}
