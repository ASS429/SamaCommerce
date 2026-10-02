<?php

namespace Tests\Unit;

use App\Services\AssistantVocal\NombresEnLettres;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * La voix lisait « 2 000 » « deux zéro » et « 1 300 » « un trois cents »
 * (campagne du 02/10/2026) : les nombres lui sont donnés en toutes lettres.
 */
class NombresEnLettresTest extends TestCase
{
    public static function nombres(): array
    {
        return [
            [0, 'zéro'],
            [1, 'un'],
            [17, 'dix-sept'],
            [21, 'vingt et un'],
            [71, 'soixante et onze'],
            [77, 'soixante-dix-sept'],
            [80, 'quatre-vingts'],
            [81, 'quatre-vingt-un'],
            [91, 'quatre-vingt-onze'],
            [100, 'cent'],
            [200, 'deux cents'],
            [250, 'deux cent cinquante'],
            [1000, 'mille'],
            [1300, 'mille trois cents'],
            [2000, 'deux mille'],
            [21000, 'vingt et un mille'],
            [47350, 'quarante-sept mille trois cent cinquante'],
            [80000, 'quatre-vingt mille'],
            [200000, 'deux cent mille'],
            [1000000, 'un million'],
            [2500000, 'deux millions cinq cent mille'],
            [-500, 'moins cinq cents'],
        ];
    }

    #[DataProvider('nombres')]
    public function test_un_nombre_s_ecrit_en_toutes_lettres(int $nombre, string $attendu): void
    {
        $this->assertSame($attendu, NombresEnLettres::enLettres($nombre));
    }

    public function test_la_reponse_est_preparee_pour_la_voix(): void
    {
        $this->assertSame(
            'Vous avez encaissé quarante-sept mille trois cent cinquante francs aujourd’hui.',
            NombresEnLettres::textePourLaVoix('Vous avez encaissé **47 350 F** aujourd’hui.'),
        );
        // Espace insécable et espace fine (U+202F) des nombres formatés en français.
        $this->assertSame('deux mille francs', NombresEnLettres::textePourLaVoix("2\u{00A0}000\u{202F}FCFA"));
        $this->assertSame('mille trois cents francs', NombresEnLettres::textePourLaVoix("1\u{202F}300 F"));
        $this->assertSame('Il reste un virgule cinq kilos de sucre.', NombresEnLettres::textePourLaVoix('Il reste 1,5 kg de sucre.'));
        // Un mot qui commence par F n'est pas « francs ».
        $this->assertSame('Fatou doit cinq cents francs.', NombresEnLettres::textePourLaVoix('Fatou doit 500 F.'));
    }
}
