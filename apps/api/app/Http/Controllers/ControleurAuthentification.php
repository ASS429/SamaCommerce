<?php

namespace App\Http\Controllers;

use App\Models\Utilisateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class ControleurAuthentification extends Controleur
{
    /**
     * S3 — Politique de mot de passe forte : 8 caractères minimum, avec lettres
     * et chiffres. (En production on active ->uncompromised() pour vérifier
     * HaveIBeenPwned ; désactivé en dev/test pour ne pas dépendre du réseau.)
     */
    private function reglesMotDePasse(): array
    {
        $regle = Password::min(8)->letters()->numbers();
        if (app()->environment('production')) {
            $regle = $regle->uncompromised();
        }

        return ['required', 'string', $regle];
    }

    /**
     * Émet un jeton pour CET appareil.
     *
     * S2 — On révoque l'ancien jeton portant le même nom (pas de jeton orphelin
     * après une reconnexion). Le client envoie donc un `nom_appareil` distinct
     * par appareil : sans lui, tous s'appelaient « app » et se connecter sur le
     * téléphone déconnectait le PC dans la seconde. Le jeton hérite de
     * l'expiration globale (config sanctum.expiration).
     */
    private function emettreJeton(Utilisateur $utilisateur, Request $requete): string
    {
        $appareil = (string) ($requete->input('nom_appareil') ?: 'app');
        $utilisateur->tokens()->where('name', $appareil)->delete();

        return $utilisateur->createToken($appareil)->plainTextToken;
    }

    /**
     * Date d'expiration du jeton (config sanctum.expiration, en minutes).
     * Renvoyée au client pour qu'une session qui tombe soit diagnosticable
     * sans accès au serveur — et non plus attribuée au hasard.
     */
    private function expirationJeton(): ?string
    {
        $minutes = (int) config('sanctum.expiration', 0);

        return $minutes > 0 ? now()->addMinutes($minutes)->toIso8601String() : null;
    }

    /**
     * Utilisateur enrichi pour la réponse de connexion : l'interface a besoin
     * de est_employe/permissions IMMÉDIATEMENT pour filtrer la navigation
     * (sans attendre le /auth/moi asynchrone).
     */
    private function donneesUtilisateur(Utilisateur $utilisateur): array
    {
        $adhesion = \App\Models\MembreBoutique::where('membre_id', $utilisateur->id)
            ->where('statut', 'acceptee')->first();

        return array_merge($utilisateur->toArray(), [
            'est_employe' => (bool) $adhesion,
            'permissions' => $adhesion?->permissions,
        ]);
    }

    public function inscrire(Request $requete)
    {
        $donnees = $requete->validate([
            'identifiant' => ['required', 'string', 'max:255', 'unique:utilisateurs,identifiant'],
            'mot_de_passe' => $this->reglesMotDePasse(),
            'nom_commerce' => ['nullable', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
        ]);

        // Essai offert : le plan d'essai (Pro par défaut) s'applique pendant la
        // durée réglée par l'administrateur. Le plan PAYÉ reste « Gratuit ».
        $dureeEssai = \App\Models\ReglagesAbonnement::courants()->duree_essai_jours;

        $utilisateur = Utilisateur::create([
            'identifiant' => $donnees['identifiant'],
            'mot_de_passe' => Hash::make($donnees['mot_de_passe']),
            'nom_commerce' => $donnees['nom_commerce'] ?? null,
            'telephone' => $donnees['telephone'] ?? null,
            'role' => 'commercant',
            'statut' => 'Actif',
            'plan' => 'Gratuit',
            'statut_paiement' => 'À jour',
            'statut_demande_premium' => 'validé',
            'essai_jusqu_au' => $dureeEssai > 0 ? Carbon::today()->addDays($dureeEssai) : null,
        ]);

        // Boutique principale automatique
        $boutique = $utilisateur->boutiques()->create([
            'nom' => $donnees['nom_commerce'] ?? 'Ma Boutique',
            'emoji' => '🏪', 'est_principale' => true,
        ]);
        $utilisateur->update(['boutique_active_id' => $boutique->id]);

        return response()->json([
            'message' => 'Compte créé avec succès',
            'utilisateur' => $utilisateur->fresh(),
            'jeton' => $this->emettreJeton($utilisateur->fresh(), $requete),
            'jeton_expire_le' => $this->expirationJeton(),
        ], 201);
    }

    public function connecter(Request $requete)
    {
        $donnees = $requete->validate([
            'identifiant' => ['required', 'string'],
            'mot_de_passe' => ['required', 'string'],
        ]);

        // S3 — Verrouillage progressif contre le forçage (en plus de la limite
        // de débit de la route) : 5 échecs par identifiant+IP → blocage 60 s.
        $cleLimite = 'connexion:'.mb_strtolower($donnees['identifiant']).'|'.$requete->ip();
        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($cleLimite, 5)) {
            $secondes = \Illuminate\Support\Facades\RateLimiter::availableIn($cleLimite);
            throw ValidationException::withMessages([
                'identifiant' => ["Trop de tentatives. Réessayez dans {$secondes} secondes."],
            ])->status(429);
        }

        $utilisateur = Utilisateur::where('identifiant', $donnees['identifiant'])->first();

        // S3 — Message GÉNÉRIQUE (pas d'énumération de comptes : on ne révèle pas
        // si c'est l'identifiant ou le mot de passe qui est faux).
        if (! $utilisateur || ! Hash::check($donnees['mot_de_passe'], $utilisateur->mot_de_passe)) {
            \Illuminate\Support\Facades\RateLimiter::hit($cleLimite, 60);
            $this->journaliserConnexion($requete, $donnees['identifiant'], false);
            throw ValidationException::withMessages(['identifiant' => ['Identifiants incorrects.']]);
        }

        if ($utilisateur->statut === 'Bloqué') {
            return response()->json(['erreur' => 'Votre compte est bloqué. Veuillez contacter l’administrateur.'], 403);
        }

        \Illuminate\Support\Facades\RateLimiter::clear($cleLimite);

        /* Double facteur activé : on n'émet PAS de jeton ; le code part par
           e-mail. Jusqu'au 30/09/2026 il était créé… et envoyé nulle part : le
           compte ne pouvait plus se connecter depuis un nouvel appareil. */
        if ($utilisateur->double_facteur_actif) {
            $code = $this->creerCodeDoubleFacteur($utilisateur, 'connexion');
            $envoye = $this->envoyerCodeParEmail($utilisateur, $code, 'connexion');

            return response()->json([
                'double_facteur_requis' => true,
                'identifiant' => $utilisateur->identifiant,
                'envoye' => $envoye,
                'message' => $envoye
                    ? 'Code envoyé par e-mail. Pensez à regarder vos courriers indésirables.'
                    : "Le code n'a pas pu être envoyé par e-mail. Contactez l'administrateur.",
                'code_dev' => $this->codeDeDeveloppement($code),
            ]);
        }

        $this->journaliserConnexion($requete, $utilisateur->identifiant, true);

        return response()->json([
            'utilisateur' => $this->donneesUtilisateur($utilisateur),
            'jeton' => $this->emettreJeton($utilisateur, $requete),
            'jeton_expire_le' => $this->expirationJeton(),
        ]);
    }

    /** Vérifie le code du double facteur et émet le jeton (valable 10 min). */
    public function verifierDoubleFacteur(Request $requete)
    {
        $donnees = $requete->validate([
            'identifiant' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        $utilisateur = Utilisateur::where('identifiant', $donnees['identifiant'])->first();
        if (! $utilisateur) {
            throw ValidationException::withMessages(['identifiant' => ['Utilisateur introuvable']]);
        }

        $this->consommerCodeDoubleFacteur($utilisateur, 'connexion', $donnees['code'], 'Code expiré, reconnectez-vous');

        $this->journaliserConnexion($requete, $utilisateur->identifiant, true);

        return response()->json([
            'utilisateur' => $this->donneesUtilisateur($utilisateur),
            'jeton' => $this->emettreJeton($utilisateur, $requete),
            'jeton_expire_le' => $this->expirationJeton(),
        ]);
    }

    /**
     * S3 — Journal des connexions (réussites et échecs) : journal structuré JSON
     * avec IP et navigateur. Sert au diagnostic et à la détection d'intrusion.
     */
    private function journaliserConnexion(Request $requete, string $identifiant, bool $reussite): void
    {
        Log::channel('stack')->info('auth.connexion', [
            'identifiant' => $identifiant,
            'reussite' => $reussite,
            'ip' => $requete->ip(),
            'navigateur' => (string) $requete->userAgent(),
            'le' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * Active ou désactive le double facteur du compte réellement connecté.
     *
     * Désactiver ne demande rien de plus : le compte est déjà connecté. Activer,
     * si : on envoie d'abord un code, et l'option ne s'active qu'une fois ce
     * code saisi (confirmerDoubleFacteur). Jusqu'au 30/09/2026, elle s'activait
     * d'un clic alors qu'aucun code n'était jamais envoyé — le compte se
     * retrouvait enfermé dehors à la connexion suivante sur un autre appareil.
     */
    public function basculerDoubleFacteur(Request $requete)
    {
        $donnees = $requete->validate(['actif' => ['required', 'boolean']]);
        $utilisateur = $requete->attributes->get('utilisateur_reel') ?? $requete->user();

        if (! $donnees['actif'] || $utilisateur->double_facteur_actif) {
            $utilisateur->update(['double_facteur_actif' => $donnees['actif']]);

            return response()->json(['double_facteur_actif' => $utilisateur->double_facteur_actif]);
        }

        if ($this->adresseDesCodes($utilisateur) === null) {
            return response()->json([
                'erreur' => $utilisateur->role === 'admin'
                    ? "La vérification en 2 étapes envoie un code par e-mail : renseignez l'adresse de l'administrateur (EMAIL_ADMIN) dans Render."
                    : "La vérification en 2 étapes envoie un code par e-mail : votre identifiant n'est pas une adresse e-mail.",
            ], 422);
        }

        $code = $this->creerCodeDoubleFacteur($utilisateur, 'activation');
        if (! $this->envoyerCodeParEmail($utilisateur, $code, 'activation')) {
            return response()->json([
                'erreur' => "L'e-mail n'a pas pu partir : la vérification en 2 étapes ne peut pas être activée pour le moment.",
            ], 422);
        }

        return response()->json([
            'double_facteur_actif' => false,
            'code_envoye' => true,
            'message' => 'Code envoyé par e-mail. Saisissez-le pour activer la vérification en 2 étapes.',
            'code_dev' => $this->codeDeDeveloppement($code),
        ]);
    }

    /** Second temps de l'activation : le code reçu prouve que l'e-mail arrive. */
    public function confirmerDoubleFacteur(Request $requete)
    {
        $donnees = $requete->validate(['code' => ['required', 'string']]);
        $utilisateur = $requete->attributes->get('utilisateur_reel') ?? $requete->user();

        $this->consommerCodeDoubleFacteur($utilisateur, 'activation', $donnees['code'], 'Code expiré, redemandez-en un');
        $utilisateur->update(['double_facteur_actif' => true]);

        return response()->json(['double_facteur_actif' => true]);
    }

    /**
     * Crée un code à 6 chiffres, valable 10 minutes. Le motif sépare les codes
     * d'activation de ceux de connexion : un code reçu pour activer l'option ne
     * doit jamais ouvrir une session.
     */
    private function creerCodeDoubleFacteur(Utilisateur $utilisateur, string $motif): string
    {
        $code = (string) random_int(100000, 999999);
        DB::table('codes_double_facteur')->insert([
            'utilisateur_id' => $utilisateur->id,
            'motif' => $motif,
            'code_hache' => Hash::make($code),
            'expire_le' => Carbon::now()->addMinutes(10),
            'utilise' => false,
            'cree_le' => Carbon::now(),
            'modifie_le' => Carbon::now(),
        ]);

        return $code;
    }

    /** Vérifie le dernier code non utilisé de ce motif, puis le marque utilisé. */
    private function consommerCodeDoubleFacteur(Utilisateur $utilisateur, string $motif, string $code, string $siExpire): void
    {
        $ligne = DB::table('codes_double_facteur')
            ->where('utilisateur_id', $utilisateur->id)->where('motif', $motif)->where('utilise', false)
            ->orderByDesc('id')->first();
        if (! $ligne || ! Hash::check($code, $ligne->code_hache)) {
            throw ValidationException::withMessages(['code' => ['Code invalide']]);
        }
        if (Carbon::parse($ligne->expire_le)->isPast()) {
            throw ValidationException::withMessages(['code' => [$siExpire]]);
        }

        DB::table('codes_double_facteur')->where('id', $ligne->id)->update(['utilise' => true, 'modifie_le' => Carbon::now()]);
    }

    /**
     * Où partent les codes d'un compte, ou `null` s'ils ne peuvent aller nulle
     * part. D'ordinaire, l'identifiant lui-même. Le compte administrateur fait
     * exception : son identifiant n'est pas une vraie boîte, ses codes partent
     * à l'adresse réglée dans Render (config `app.email_admin`).
     */
    private function adresseDesCodes(Utilisateur $utilisateur): ?string
    {
        $adresse = $utilisateur->role === 'admin'
            ? trim((string) config('app.email_admin'))
            : (string) $utilisateur->identifiant;

        return filter_var($adresse, FILTER_VALIDATE_EMAIL) ? $adresse : null;
    }

    /**
     * S7 — Le code n'est exposé QUE en local avec débogage (logique inversée :
     * un .env de production mal réglé ne fait pas fuiter de codes).
     */
    private function codeDeDeveloppement(string $code): ?string
    {
        return (app()->environment('local') && config('app.debug')) ? $code : null;
    }

    public function moi(Request $requete)
    {
        $utilisateur = $requete->user();

        return response()->json(array_merge($utilisateur->toArray(), [
            'est_employe' => $requete->attributes->get('est_employe', false),
            'permissions' => $requete->attributes->get('permissions'),
            'boutiques' => $utilisateur->boutiques()->orderByDesc('est_principale')->get(),
            // Écrase la valeur venue de toArray() : pour un employé, $utilisateur
            // est le PROPRIÉTAIRE, et chacun doit retrouver SES propres réglages.
            'preferences' => $this->titulairePreferences($requete)->preferences ?? new \stdClass,
        ]));
    }

    /**
     * Compte porteur des préférences d'affichage : le compte réellement
     * connecté, jamais le propriétaire résolu par ResoudreProprietaire.
     */
    private function titulairePreferences(Request $requete): Utilisateur
    {
        return $requete->attributes->get('utilisateur_reel') ?? $requete->user();
    }

    /**
     * Réglages d'interface synchronisés entre les appareils du même compte
     * (sections masquées, impression automatique du reçu).
     *
     * Fusion et non remplacement : un appareil qui ne connaît pas encore une
     * option future ne doit pas l'effacer en enregistrant les siennes.
     */
    public function modifierPreferences(Request $requete)
    {
        $donnees = $requete->validate([
            'sections_masquees' => ['nullable', 'array', 'max:40'],
            'sections_masquees.*' => ['string', 'max:32'],
            'impression_auto' => ['nullable', 'boolean'],
        ]);

        $utilisateur = $this->titulairePreferences($requete);
        $fusion = array_merge($utilisateur->preferences ?? [], $donnees);

        // `sections_masquees` est une LISTE : on la dédoublonne et on la
        // réindexe, sinon le JSON stocké devient un objet {"0":…,"2":…}.
        if (isset($fusion['sections_masquees'])) {
            $fusion['sections_masquees'] = array_values(array_unique($fusion['sections_masquees']));
        }

        $utilisateur->update(['preferences' => $fusion]);

        return response()->json(['preferences' => $fusion]);
    }

    public function deconnecter(Request $requete)
    {
        // utilisateur_reel = compte réellement authentifié (l'employé, le cas
        // échéant) : c'est lui qui porte le jeton courant, pas le propriétaire.
        $reel = $requete->attributes->get('utilisateur_reel') ?? $requete->user();
        $jeton = $reel->currentAccessToken();
        if ($jeton) {
            $jeton->delete();
        }

        return response()->json(['message' => 'Déconnecté.']);
    }

    /** S2 — « Déconnecter tous les appareils » : révoque TOUS les jetons du compte. */
    public function deconnecterPartout(Request $requete)
    {
        $reel = $requete->attributes->get('utilisateur_reel') ?? $requete->user();
        $reel->tokens()->delete();

        return response()->json(['message' => 'Déconnecté de tous les appareils.']);
    }

    /**
     * Les appareils connectés au compte : un par jeton. Le nom du jeton est
     * l'identifiant d'appareil du client (« ordi-… » ou « mobile-… ») ; seul
     * son préfixe est montré, l'identifiant lui-même ne dit rien à personne.
     */
    public function appareils(Request $requete)
    {
        $reel = $requete->attributes->get('utilisateur_reel') ?? $requete->user();
        $actuel = $reel->currentAccessToken()?->id;

        // Un jeton expiré ne connecte plus personne : il n'est pas un appareil
        // connecté (Sanctum ne supprime pas ces lignes de lui-même).
        $expiration = (int) config('sanctum.expiration', 0);
        $valide = fn ($jeton) => (! $jeton->expires_at || $jeton->expires_at->isFuture())
            && (! $expiration || $jeton->created_at?->gt(now()->subMinutes($expiration)));

        // Tri en PHP : PostgreSQL place les jetons jamais utilisés (NULL) en
        // tête d'un ORDER BY … DESC, SQLite en queue.
        return response()->json($reel->tokens()->get()
            ->filter($valide)
            ->sortByDesc(fn ($jeton) => [$jeton->last_used_at?->getTimestamp() ?? 0, $jeton->id])
            ->map(fn ($jeton) => [
                'id' => $jeton->id,
                'type' => str_starts_with($jeton->name, 'mobile-') ? 'telephone' : (str_starts_with($jeton->name, 'ordi-') ? 'ordinateur' : 'autre'),
                'derniere_utilisation' => $jeton->last_used_at?->toIso8601String(),
                'connecte_le' => $jeton->created_at?->toIso8601String(),
                'actuel' => $jeton->id === $actuel,
            ])->values());
    }

    /** Révoque les jetons des AUTRES appareils ; celui-ci reste connecté. */
    public function deconnecterAutres(Request $requete)
    {
        $reel = $requete->attributes->get('utilisateur_reel') ?? $requete->user();
        $actuel = $reel->currentAccessToken()?->id;
        $nombre = $reel->tokens()->when($actuel, fn ($q) => $q->where('id', '<>', $actuel))->delete();

        return response()->json([
            'message' => $nombre ? ($nombre > 1 ? "{$nombre} appareils déconnectés." : '1 appareil déconnecté.') : 'Aucun autre appareil n’était connecté.',
            'deconnectes' => $nombre,
        ]);
    }

    /** Mise à jour du profil / de la boutique principale. */
    public function modifierProfil(Request $requete)
    {
        $donnees = $requete->validate([
            'nom_commerce' => ['nullable', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'photo' => self::REGLES_PHOTO,
        ]);

        $utilisateur = $requete->user();
        // array_filter écarte les valeurs vides : on ne veut pas effacer le nom
        // de la boutique parce que le champ n'était pas dans la requête. La photo
        // fait exception — `null` y signifie « retirer la photo », un geste
        // explicite de l'utilisateur.
        $utilisateur->update(array_filter($donnees, fn ($v) => $v !== null && $v !== ''));
        if ($requete->exists('photo')) {
            $utilisateur->update(['photo' => $donnees['photo'] ?? null]);
        }

        if (! empty($donnees['nom_commerce'])) {
            $utilisateur->boutiques()->where('est_principale', true)->update(['nom' => $donnees['nom_commerce']]);
        }

        return response()->json($utilisateur->fresh());
    }

    /** Génère un code de réinitialisation (6 chiffres), envoyé par e-mail. */
    public function motDePasseOublie(Request $requete)
    {
        $donnees = $requete->validate(['identifiant' => ['required', 'string']]);
        $utilisateur = Utilisateur::where('identifiant', $donnees['identifiant'])->first();

        // Message générique : ne révèle pas si le compte existe.
        if (! $utilisateur) {
            return response()->json(['message' => 'Si ce compte existe, un code a été envoyé.']);
        }

        $code = (string) random_int(100000, 999999);
        DB::table('codes_reinitialisation')->updateOrInsert(
            ['identifiant' => $utilisateur->identifiant],
            ['code_hache' => Hash::make($code), 'cree_le' => Carbon::now()],
        );

        $envoye = $this->envoyerCodeParEmail($utilisateur, $code, 'reinitialisation');

        return response()->json([
            'message' => $envoye
                ? 'Code envoyé par e-mail. Pensez à regarder vos courriers indésirables.'
                : "Code généré, mais l'e-mail n'a pas pu partir. Contactez la boutique.",
            'envoye' => $envoye,
            'code_dev' => $this->codeDeDeveloppement($code),
        ]);
    }

    /**
     * Envoie un code à 6 chiffres par e-mail (motifs : CodeParEmail::MOTIFS).
     *
     * Le code de réinitialisation a longtemps été généré… et envoyé NULLE PART :
     * aucun expéditeur n'était configuré. L'utilisateur lisait « un code a été
     * envoyé », ne recevait rien, et se retrouvait enfermé dehors avec son stock
     * et ses ventes à l'intérieur. Le code de connexion en deux étapes a connu
     * le même sort jusqu'au 30/09/2026.
     *
     * L'échec d'envoi est renvoyé à l'appelant, qui décide : la réinitialisation
     * continue (le code EXISTE en base, le propriétaire peut encore dépanner),
     * l'activation du double facteur est refusée. Dans tous les cas on le
     * journalise, car un envoi muet est exactement le défaut qu'on a corrigé.
     */
    private function envoyerCodeParEmail(Utilisateur $utilisateur, string $code, string $motif): bool
    {
        // Pas d'adresse (identifiant qui n'en est pas une, compte créé à la
        // main) : rien à envoyer, inutile de faire semblant.
        $adresse = $this->adresseDesCodes($utilisateur);
        if ($adresse === null) {
            Log::warning("[code-{$motif}] aucune adresse de réception, envoi impossible");

            return false;
        }

        $nom = $utilisateur->nom_commerce ?: 'Bonjour';

        try {
            Mail::to($adresse)->send(new \App\Mail\CodeParEmail($code, $nom, $motif));

            return true;
        } catch (\Throwable $e) {
            // On ne renvoie JAMAIS le détail au client : il indiquerait si le
            // compte existe, et exposerait la configuration du serveur.
            Log::error("[code-{$motif}] envoi impossible : ".$e->getMessage());

            return false;
        }
    }

    /** Réinitialise le mot de passe avec le code reçu (valable 30 min). */
    public function reinitialiserMotDePasse(Request $requete)
    {
        $donnees = $requete->validate([
            'identifiant' => ['required', 'string'],
            'code' => ['required', 'string'],
            'mot_de_passe' => $this->reglesMotDePasse(),
        ]);

        $ligne = DB::table('codes_reinitialisation')->where('identifiant', $donnees['identifiant'])->first();
        if (! $ligne || ! Hash::check($donnees['code'], $ligne->code_hache)) {
            throw ValidationException::withMessages(['code' => ['Code invalide']]);
        }
        if (Carbon::parse($ligne->cree_le)->addMinutes(30)->isPast()) {
            DB::table('codes_reinitialisation')->where('identifiant', $donnees['identifiant'])->delete();
            throw ValidationException::withMessages(['code' => ['Code expiré, redemandez-en un']]);
        }

        $utilisateur = Utilisateur::where('identifiant', $donnees['identifiant'])->firstOrFail();
        $utilisateur->update(['mot_de_passe' => Hash::make($donnees['mot_de_passe'])]);
        DB::table('codes_reinitialisation')->where('identifiant', $donnees['identifiant'])->delete();

        return response()->json(['message' => 'Mot de passe réinitialisé. Connectez-vous.']);
    }
}
