<?php

namespace App\Support;

/**
 * Numéros de téléphone sénégalais, tels que les commerçants les tapent :
 * « 77 123 45 67 », « +221 77 123 45 67 », « 00221771234567 »…
 */
final class Telephone
{
    /** Les 9 chiffres du numéro local (77 123 45 67), sans indicatif ni espaces. */
    public static function local(?string $numero): ?string
    {
        $chiffres = preg_replace('/\D/', '', (string) $numero);
        if (str_starts_with($chiffres, '00221')) {
            $chiffres = substr($chiffres, 5);
        } elseif (str_starts_with($chiffres, '221') && strlen($chiffres) === 12) {
            $chiffres = substr($chiffres, 3);
        }

        return strlen($chiffres) >= 7 ? $chiffres : null;
    }

    public static function memeNumero(?string $a, ?string $b): bool
    {
        $a = self::local($a);
        $b = self::local($b);

        return $a !== null && $b !== null && $a === $b;
    }

    /**
     * Lien WhatsApp avec message prérempli. wa.me EXIGE l'indicatif pays :
     * sans « 221 », le lien ouvre une conversation avec un numéro inconnu.
     */
    public static function lienWhatsApp(?string $numero, string $texte): ?string
    {
        $local = self::local($numero);
        if ($local === null) {
            return null;
        }
        $international = strlen($local) === 9 ? '221'.$local : $local;

        return 'https://wa.me/'.$international.'?text='.rawurlencode($texte);
    }
}
