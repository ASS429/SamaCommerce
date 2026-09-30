<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Code à 6 chiffres envoyé par e-mail : mot de passe oublié, connexion en deux
 * étapes, activation de la vérification en deux étapes.
 *
 * Une classe dédiée plutôt qu'un `Mail::html()` : il faut pouvoir prouver PAR
 * UN TEST que le message part et qu'il contient bien le code — un envoi muet
 * est exactement le défaut que cette classe a corrigé, deux fois.
 */
class CodeParEmail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Ce que le message dit selon son motif. La durée annoncée DOIT être celle
     * que le contrôleur applique : l'e-mail de réinitialisation annonçait
     * « 1 heure » pour un code qui expirait au bout de 30 minutes.
     */
    public const MOTIFS = [
        'reinitialisation' => [
            'consigne' => 'Voici votre code pour choisir un nouveau mot de passe :',
            'minutes' => 30,
            'sinon' => 'votre mot de passe actuel reste valable.',
        ],
        'connexion' => [
            'consigne' => 'Voici votre code de connexion :',
            'minutes' => 10,
            'sinon' => "quelqu'un connaît peut-être votre mot de passe : changez-le.",
        ],
        'activation' => [
            'consigne' => 'Voici votre code pour activer la vérification en 2 étapes :',
            'minutes' => 10,
            'sinon' => 'rien ne changera sur votre compte.',
        ],
    ];

    public function __construct(
        public string $code,
        public string $nom,
        public string $motif = 'reinitialisation',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Votre code SamaCommerce');
    }

    public function content(): Content
    {
        ['consigne' => $consigne, 'minutes' => $minutes, 'sinon' => $sinon] = self::MOTIFS[$this->motif];

        // Le code est ÉNORME et espacé : il doit se recopier de tête, sur un
        // téléphone d'entrée de gamme, sans zoomer.
        return new Content(htmlString: <<<HTML
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:auto;color:#1E1B4B">
              <p style="font-size:16px">{$this->nom},</p>
              <p style="font-size:15px">{$consigne}</p>
              <p style="font-size:38px;font-weight:bold;letter-spacing:8px;text-align:center;
                        background:#F3EFFE;border-radius:14px;padding:18px 0;margin:22px 0;color:#5B21B6">
                {$this->code}
              </p>
              <p style="font-size:14px;color:#6B7280">
                Ce code est valable {$minutes} minutes. Si vous n'avez rien demandé, ignorez ce
                message : {$sinon}
              </p>
              <p style="font-size:13px;color:#9B95B5;margin-top:26px">SamaCommerce</p>
            </div>
            HTML);
    }
}
