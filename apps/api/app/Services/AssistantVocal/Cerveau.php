<?php

namespace App\Services\AssistantVocal;

/**
 * Le cerveau : Gemini lit la question (en wolof, directement — la traduction
 * en français faisait perdre les dërëm), appelle les outils dont il a besoin,
 * puis rédige la réponse.
 */
final class Cerveau
{
    /** Allers-retours avec les outils avant d'abandonner (aucune question d'essai n'en a demandé plus de deux). */
    private const TOURS_MAX = 4;

    /**
     * Temps accordé au cerveau, tous modèles confondus. Au-delà, le commerçant
     * a déjà décroché : mieux vaut lui dire de réessayer que le faire attendre
     * (essai du 02/10/2026 sur l'offre gratuite : jusqu'à 45 s, puis aucune réponse).
     */
    private const BUDGET_SECONDES = 40;

    public function __construct(private ClientGemini $gemini) {}

    /**
     * @return array{0: string, 1: string} la réponse, et le modèle qui l'a donnée
     */
    public function repondre(string $question, string $consignes, OutilsAssistant $outils): array
    {
        $limite = microtime(true) + self::BUDGET_SECONDES;
        $derniere = '';
        foreach ($this->gemini->modeles() as $modele) {
            try {
                return [$this->dialoguer($modele, $question, $consignes, $outils, $limite), $modele];
            } catch (ModeleIndisponible $e) {
                // Les outils ne font que lire : le modèle suivant peut tout reprendre.
                $outils->oublierResultats();
                $derniere = $e->getMessage();
            }
        }
        throw new AssistantIndisponible('cerveau', $derniere);
    }

    private function dialoguer(string $modele, string $question, string $consignes, OutilsAssistant $outils, float $limite): string
    {
        $contenus = [['role' => 'user', 'parts' => [['text' => $question]]]];

        for ($tour = 0; $tour < self::TOURS_MAX; $tour++) {
            $restant = $limite - microtime(true);
            if ($restant < 2) {
                throw new AssistantIndisponible('cerveau', 'temps dépassé ('.self::BUDGET_SECONDES.' s)');
            }
            $contenu = $this->gemini->generer($modele, $consignes, $contenus, $outils->declarations(), $restant);
            // Renvoyé tel quel au tour suivant : il porte les « signatures de
            // pensée » sans lesquelles Gemini refuse la suite de l'échange.
            $contenus[] = $contenu;

            $appels = array_values(array_filter(
                array_map(fn (array $partie) => $partie['functionCall'] ?? null, $contenu['parts'] ?? []),
            ));
            if ($appels === []) {
                $texte = ClientGemini::texte($contenu);
                if ($texte === '') {
                    throw new ModeleIndisponible("{$modele} : réponse sans texte");
                }

                return $texte;
            }

            $retours = [];
            foreach ($appels as $appel) {
                $arguments = (array) ($appel['args'] ?? []);
                $retour = ['name' => $appel['name'], 'response' => $outils->executer((string) $appel['name'], $arguments)];
                if (isset($appel['id'])) {
                    $retour['id'] = $appel['id'];
                }
                $retours[] = ['functionResponse' => $retour];
            }
            $contenus[] = ['role' => 'user', 'parts' => $retours];
        }

        throw new ModeleIndisponible("{$modele} : pas de réponse après ".self::TOURS_MAX.' tours');
    }
}
