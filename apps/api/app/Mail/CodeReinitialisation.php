<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Code de reinitialisation du mot de passe.
 *
 * Une classe dediee plutot qu'un `Mail::html()` : c'est le seul message que
 * l'application envoie, et il faut pouvoir prouver PAR UN TEST qu'il part et
 * qu'il contient bien le code — un envoi muet est exactement le defaut qu'on
 * corrige ici.
 */
class CodeReinitialisation extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $code,
        public string $nom,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Votre code SamaCommerce');
    }

    public function content(): Content
    {
        // Le code est ENORME et espace : il doit se recopier de tete, sur un
        // telephone d'entree de gamme, sans zoomer.
        return new Content(htmlString: <<<HTML
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:auto;color:#1E1B4B">
              <p style="font-size:16px">{$this->nom},</p>
              <p style="font-size:15px">Voici votre code pour choisir un nouveau mot de passe :</p>
              <p style="font-size:38px;font-weight:bold;letter-spacing:8px;text-align:center;
                        background:#F3EFFE;border-radius:14px;padding:18px 0;margin:22px 0;color:#5B21B6">
                {$this->code}
              </p>
              <p style="font-size:14px;color:#6B7280">
                Ce code est valable 1 heure. Si vous n'avez rien demande, ignorez ce
                message : votre mot de passe actuel reste valable.
              </p>
              <p style="font-size:13px;color:#9B95B5;margin-top:26px">SamaCommerce</p>
            </div>
            HTML);
    }
}
