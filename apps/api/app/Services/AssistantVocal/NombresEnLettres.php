<?php

namespace App\Services\AssistantVocal;

/**
 * Ce que la voix doit lire.
 *
 * Oolel-Voices lit « 2 000 » comme « deux zéro » et « 1 300 » comme « un trois
 * cents » : l'espace des milliers coupe le nombre en deux (constaté par le
 * commerçant lors de la campagne du 02/10/2026). On écrit donc les nombres en
 * toutes lettres, en français, y compris dans une phrase en wolof : c'est ainsi
 * qu'on dit souvent les prix, et « deux mille francs » ne peut pas se confondre
 * avec des dërëm.
 */
final class NombresEnLettres
{
    private const UNITES = [
        'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
        'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    ];

    private const DIZAINES = [2 => 'vingt', 3 => 'trente', 4 => 'quarante', 5 => 'cinquante', 6 => 'soixante'];

    public static function enLettres(int $nombre): string
    {
        if ($nombre < 0) {
            return 'moins '.self::enLettres(-$nombre);
        }
        if ($nombre === 0) {
            return 'zéro';
        }
        if ($nombre >= 1_000_000_000) {
            return (string) $nombre; // aucun montant d'une boutique n'atteint le milliard
        }

        $millions = intdiv($nombre, 1_000_000);
        $milliers = intdiv($nombre % 1_000_000, 1000);
        $unites = $nombre % 1000;

        $morceaux = [];
        if ($millions) {
            $morceaux[] = $millions === 1 ? 'un million' : self::moinsDeMille($millions).' millions';
        }
        if ($milliers) {
            // « mille » est invariable, et « deux cent mille » perd son s.
            $morceaux[] = $milliers === 1 ? 'mille' : self::moinsDeMille($milliers, false).' mille';
        }
        if ($unites) {
            $morceaux[] = self::moinsDeMille($unites);
        }

        return implode(' ', $morceaux);
    }

    /** Le texte de la réponse, prêt à être lu : nombres en lettres, unités en mots, sans mise en forme. */
    public static function textePourLaVoix(string $texte): string
    {
        $texte = str_replace(['*', '_', '#'], '', $texte);
        $texte = preg_replace_callback(
            '/(\d+),(\d+)/u',
            fn (array $m) => self::enLettres((int) $m[1]).' virgule '.self::enLettres((int) $m[2]),
            $texte,
        );
        // Un nombre écrit avec des espaces de milliers (normale, insécable ou fine) est UN nombre.
        $texte = preg_replace_callback(
            '/\d{1,3}(?:[ \x{00A0}\x{202F}]\d{3})+(?!\d)|\d+/u',
            fn (array $m) => self::enLettres((int) preg_replace('/\D/u', '', $m[0])),
            $texte,
        );
        $texte = preg_replace('/\bkg\b/u', 'kilos', $texte);
        $texte = preg_replace('/\bFCFA\b|\bF(?:\s?CFA)?\b/u', 'francs', $texte);

        return trim((string) preg_replace('/\s+/u', ' ', $texte));
    }

    private static function moinsDeCent(int $nombre): string
    {
        if ($nombre <= 16) {
            return self::UNITES[$nombre];
        }
        if ($nombre < 20) {
            return 'dix-'.self::UNITES[$nombre - 10];
        }
        $dizaine = intdiv($nombre, 10);
        $unite = $nombre % 10;

        return match (true) {
            $dizaine === 7 => $unite === 1 ? 'soixante et onze' : 'soixante-'.self::moinsDeCent(10 + $unite),
            $dizaine === 8 => $unite === 0 ? 'quatre-vingts' : 'quatre-vingt-'.self::UNITES[$unite],
            $dizaine === 9 => 'quatre-vingt-'.self::moinsDeCent(10 + $unite),
            $unite === 0 => self::DIZAINES[$dizaine],
            $unite === 1 => self::DIZAINES[$dizaine].' et un',
            default => self::DIZAINES[$dizaine].'-'.self::UNITES[$unite],
        };
    }

    /** @param bool $enFin le groupe termine le nombre (« deux cents ») ou précède « mille » (« deux cent mille ») */
    private static function moinsDeMille(int $nombre, bool $enFin = true): string
    {
        $centaines = intdiv($nombre, 100);
        $reste = $nombre % 100;
        $morceaux = [];
        if ($centaines) {
            $morceaux[] = $centaines === 1 ? 'cent' : self::UNITES[$centaines].' cent'.($reste === 0 && $enFin ? 's' : '');
        }
        if ($reste) {
            $texte = self::moinsDeCent($reste);
            $morceaux[] = $texte === 'quatre-vingts' && ! $enFin ? 'quatre-vingt' : $texte;
        }

        return implode(' ', $morceaux);
    }
}
