<?php

namespace App\Http\Controllers;

use App\Models\BoutiqueMember;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class MemberController extends Controller
{
    private function realUser(Request $request)
    {
        return $request->attributes->get('real_user') ?? $request->user();
    }

    public function index(Request $request)
    {
        $query = BoutiqueMember::where('owner_id', $request->user()->id)
            ->leftJoin('users', 'users.id', '=', 'boutique_members.member_id')
            ->orderByDesc('boutique_members.created_at');

        if ($request->filled('boutique_id')) {
            $query->where('boutique_members.ref_boutique_id', $request->integer('boutique_id'));
        }

        // Les colonnes du membre priment : `boutique_members.name/phone` sont la
        // fiche saisie par le patron, `users.*` ne sont qu'un repli quand
        // l'employé a déjà un compte. Sans alias, la jointure les écraserait.
        return $query->get(['boutique_members.*', 'users.company_name as user_company_name', 'users.phone as user_phone']);
    }

    public function invite(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'role' => ['nullable', 'in:employe,gerant'],
            'permissions' => ['nullable', 'array'],
            'boutique_id' => ['nullable', 'integer'],
            // Fiche employé : un patron reconnaît un visage et un prénom, pas une
            // adresse email. Ces champs sont facultatifs mais fortement conseillés.
            'name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'photo' => self::PHOTO_RULES,
        ]);

        $owner = $request->user();
        $role = $data['role'] ?? 'employe';
        $refBoutiqueId = $data['boutique_id'] ?? $owner->current_boutique_id ?? $owner->primaryBoutique()?->id;

        $dup = BoutiqueMember::where('owner_id', $owner->id)
            ->where('ref_boutique_id', $refBoutiqueId)
            ->where('email', $data['email'])->where('status', '!=', 'rejected')->exists();
        if ($dup) {
            return response()->json(['error' => 'Cet email est déjà invité dans cette boutique'], 400);
        }

        $token = Str::random(48);
        $member = BoutiqueMember::create([
            'owner_id' => $owner->id,
            'ref_boutique_id' => $refBoutiqueId,
            'email' => $data['email'],
            'role' => $role,
            'status' => 'pending',
            'permissions' => $data['permissions'] ?? BoutiqueMember::defaultPermissions($role),
            'name' => $data['name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'photo' => $data['photo'] ?? null,
            'invite_token' => $token,
            'invite_expires_at' => Carbon::now()->addHours(72),
        ]);

        \App\Models\ActivityLog::record($request, 'equipe.invitation', $data['email'].' ('.$role.')');

        return response()->json([
            'message' => 'Invitation créée',
            'member' => $member,
            'invite_token' => $token,
            'invite_link' => $this->inviteLink($request, $token),
        ], 201);
    }

    /**
     * Adresse complète à envoyer par WhatsApp.
     *
     * Elle était déduite du seul en-tête `Origin`. Quand cet en-tête manque —
     * une application native (le client mobile), un script, un webhook — le lien
     * dégénérait en `/?invite=…` : une adresse relative, donc rien de cliquable
     * dans WhatsApp, et l'employé restait à la porte. On part donc d'une origine
     * CONFIGURÉE, et l'en-tête ne sert plus que de repli commode en développement.
     */
    private function inviteLink(Request $request, string $token): string
    {
        $candidats = [
            config('app.frontend_url'),
            collect(config('cors.allowed_origins'))->first(fn ($o) => $o !== '*'),
            $request->headers->get('origin'),
            config('app.url'),
        ];

        foreach ($candidats as $base) {
            $base = rtrim((string) $base, '/');
            if ($base !== '' && str_starts_with($base, 'http')) {
                return "{$base}/?invite={$token}";
            }
        }

        return "/?invite={$token}";
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
    public function preview(string $token)
    {
        $invite = BoutiqueMember::where('invite_token', $token)->where('status', 'pending')->first();
        if (! $invite) {
            return response()->json(['error' => 'Invitation invalide ou déjà utilisée'], 404);
        }
        if ($invite->invite_expires_at && $invite->invite_expires_at->isPast()) {
            return response()->json(['error' => 'Cette invitation a expiré.'], 410);
        }

        return response()->json([
            'boutique' => $invite->owner()->first(['company_name'])?->company_name,
            'role' => $invite->role,
            'email' => $invite->email,
            'name' => $invite->name,
        ]);
    }

    public function accept(Request $request)
    {
        $data = $request->validate(['invite_token' => ['required', 'string']]);
        $realUser = $this->realUser($request);

        $invite = BoutiqueMember::where('invite_token', $data['invite_token'])->where('status', 'pending')->first();
        if (! $invite) {
            return response()->json(['error' => 'Invitation invalide ou expirée'], 404);
        }
        if ($invite->invite_expires_at && $invite->invite_expires_at->isPast()) {
            $invite->update(['status' => 'rejected']);
            return response()->json(['error' => 'Cette invitation a expiré.'], 410);
        }

        $invite->update([
            'status' => 'accepted', 'member_id' => $realUser->id,
            'accepted_at' => Carbon::now(), 'invite_token' => null,
        ]);

        return response()->json([
            'message' => 'Invitation acceptée',
            'role' => $invite->role,
            'permissions' => $invite->permissions,
            'boutique' => $invite->owner()->first(['id', 'company_name']),
        ]);
    }

    /** Infos boutique + permissions pour l'employé connecté. */
    public function myBoutique(Request $request)
    {
        $realUser = $this->realUser($request);
        $membership = BoutiqueMember::where('member_id', $realUser->id)->where('status', 'accepted')->first();
        if (! $membership) {
            return response()->json(null);
        }

        return response()->json([
            'role' => $membership->role,
            'permissions' => $membership->permissions,
            'owner' => $membership->owner()->first(['id', 'company_name']),
            'ref_boutique_id' => $membership->ref_boutique_id,
        ]);
    }

    public function update(Request $request, int $id)
    {
        $member = BoutiqueMember::where('owner_id', $request->user()->id)->findOrFail($id);
        $member->update($request->validate([
            'permissions' => ['nullable', 'array'],
            'role' => ['nullable', 'in:employe,gerant'],
            'name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'photo' => self::PHOTO_RULES,
        ]));

        return $member;
    }

    public function destroy(Request $request, int $id)
    {
        $member = BoutiqueMember::where('owner_id', $request->user()->id)->findOrFail($id);
        \App\Models\ActivityLog::record($request, 'equipe.retrait', $member->email);
        $member->delete();

        return response()->json(['message' => 'Membre retiré']);
    }
}
