<?php

namespace Tests\Contrat;

/**
 * ARCHIVE DE TEST — traduit des données entre l'ancien et le nouveau contrat
 * de l'API (cf. AncienContrat), pour comparer les réponses françaises aux
 * empreintes enregistrées avant la francisation (ContratFrancaisTest).
 */
final class Traducteur
{
    /** Ancien format → nouveau : ce que l'ancien client ENVOIE. */
    public static function entree(mixed $donnees): mixed
    {
        return self::traduire($donnees, AncienContrat::CHAMPS_ENTREE, AncienContrat::VALEURS_ENTREE, false);
    }

    /**
     * Nouveau format → ancien : ce qu'on RENVOIE à l'ancien client.
     * `$adresse` (nouvelle adresse de la route) départage les deux noms qui
     * changent de sens selon l'endroit (cf. AncienContrat::SORTIE_PAR_ADRESSE).
     */
    public static function sortie(mixed $donnees, string $adresse): mixed
    {
        $champs = AncienContrat::CHAMPS_SORTIE + (AncienContrat::SORTIE_PAR_ADRESSE[$adresse] ?? []);

        return self::traduire($donnees, $champs, AncienContrat::VALEURS_SORTIE, true);
    }

    /**
     * Traduit récursivement les noms de champs, et les valeurs des champs
     * listés. Une liste est parcourue élément par élément ; un objet (stdClass)
     * reste un objet, pour que `{}` ne devienne pas `[]`.
     */
    private static function traduire(mixed $donnees, array $champs, array $valeurs, bool $sortie, ?string $parent = null): mixed
    {
        if ($donnees instanceof \stdClass) {
            $traduit = new \stdClass;
            foreach (get_object_vars($donnees) as $cle => $valeur) {
                $traduit->{self::nomDeChamp((string) $cle, $champs)} = self::traduire($valeur, $champs, $valeurs, $sortie, (string) $cle);
            }

            return $traduit;
        }

        if (is_array($donnees)) {
            if (array_is_list($donnees)) {
                return array_map(fn ($v) => self::traduire($v, $champs, $valeurs, $sortie, $parent), $donnees);
            }
            $traduit = [];
            foreach ($donnees as $cle => $valeur) {
                $traduit[self::nomDeChamp((string) $cle, $champs)] = self::traduire($valeur, $champs, $valeurs, $sortie, (string) $cle);
            }

            return $traduit;
        }

        if (is_string($donnees) && $parent !== null) {
            if (isset($valeurs[$parent][$donnees])) {
                return $valeurs[$parent][$donnees];
            }
            if ($sortie && $parent === 'lien_invitation') {
                return strtr($donnees, AncienContrat::LIEN_INVITATION);
            }
        }

        return $donnees;
    }

    /**
     * Nom d'un champ. Les messages de validation portent des chemins pointés
     * (`lignes.0.produit_id`) : chaque segment est traduit.
     */
    private static function nomDeChamp(string $cle, array $champs): string
    {
        if (isset($champs[$cle])) {
            return $champs[$cle];
        }
        if (! str_contains($cle, '.')) {
            return $cle;
        }

        return implode('.', array_map(fn ($segment) => $champs[$segment] ?? $segment, explode('.', $cle)));
    }
}
