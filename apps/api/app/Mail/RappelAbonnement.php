<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Rappel d'échéance d'abonnement (le texte vient du modèle des réglages). */
class RappelAbonnement extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $texte,
        public string $plan,
        public string $echeance,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Votre plan {$this->plan} SamaCommerce : échéance le {$this->echeance}");
    }

    public function content(): Content
    {
        $texte = nl2br(e($this->texte));

        return new Content(htmlString: <<<HTML
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:460px;margin:auto;color:#1E1B4B">
              <p style="font-size:16px;line-height:1.5">{$texte}</p>
              <p style="font-size:15px;line-height:1.5;background:#F3EFFE;border-radius:14px;padding:14px 16px;color:#3B1F8C">
                Dans l’application : <strong>Mon plan</strong>, puis payez par Wave ou Orange Money
                et recopiez la référence du SMS de confirmation.
              </p>
              <p style="font-size:13px;color:#5C5878">Sans renouvellement, votre compte repasse au plan Gratuit :
                vos ventes, produits et clients restent à vous.</p>
            </div>
            HTML);
    }
}
