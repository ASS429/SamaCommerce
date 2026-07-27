<?php

/**
 * Messages de validation en français (locale APP_LOCALE=fr).
 * Couvre les règles réellement utilisées par l'API SamaCommerce.
 */

return [
    'required' => 'Le champ :attribute est obligatoire.',
    'string' => 'Le champ :attribute doit être une chaîne de caractères.',
    'integer' => 'Le champ :attribute doit être un entier.',
    'numeric' => 'Le champ :attribute doit être un nombre.',
    'boolean' => 'Le champ :attribute doit être vrai ou faux.',
    'array' => 'Le champ :attribute doit être une liste.',
    'date' => 'Le champ :attribute n\'est pas une date valide.',
    'email' => 'Le champ :attribute doit être une adresse e-mail valide.',
    'unique' => 'Cette valeur de :attribute est déjà utilisée.',
    'exists' => 'La valeur sélectionnée pour :attribute est invalide.',
    'in' => 'La valeur sélectionnée pour :attribute est invalide.',
    'confirmed' => 'La confirmation de :attribute ne correspond pas.',
    'required_with' => 'Le champ :attribute est obligatoire lorsque :values est présent.',

    'min' => [
        'string' => 'Le champ :attribute doit contenir au moins :min caractères.',
        'numeric' => 'Le champ :attribute doit être au moins égal à :min.',
        'array' => 'Le champ :attribute doit contenir au moins :min éléments.',
    ],
    'max' => [
        'string' => 'Le champ :attribute ne doit pas dépasser :max caractères.',
        'numeric' => 'Le champ :attribute ne doit pas dépasser :max.',
        'array' => 'Le champ :attribute ne doit pas contenir plus de :max éléments.',
    ],

    // Règle Password::min()->letters()->numbers()->uncompromised()
    'password' => [
        'letters' => 'Le mot de passe doit contenir au moins une lettre.',
        'mixed' => 'Le mot de passe doit contenir des majuscules et des minuscules.',
        'numbers' => 'Le mot de passe doit contenir au moins un chiffre.',
        'symbols' => 'Le mot de passe doit contenir au moins un symbole.',
        'uncompromised' => 'Ce mot de passe est apparu dans une fuite de données. Choisissez-en un autre.',
    ],

    'attributes' => [
        'username' => 'identifiant',
        'password' => 'mot de passe',
        'company_name' => 'nom de la boutique',
        'phone' => 'téléphone',
        'name' => 'nom',
        'price' => 'prix',
        'price_achat' => 'prix d\'achat',
        'stock' => 'stock',
        'category_id' => 'catégorie',
        'fournisseur_id' => 'fournisseur',
        'client_id' => 'client',
        'quantity' => 'quantité',
        'amount' => 'montant',
        'code' => 'code',
    ],
];
