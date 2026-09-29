<?php

/*
 * Scénario de référence du contrat d'API TEL QU'IL ÉTAIT avant la francisation
 * (cf. docs/GLOSSAIRE_NOMMAGE.md, étape 0).
 *
 * Chaque étape appelle une route avec des données fixes. Rejoué par
 * ContratHistoriqueTest sur une horloge figée, il produit des réponses
 * reproductibles à l'octet près : ce sont les « empreintes » que les anciennes
 * routes doivent continuer de renvoyer tant qu'un téléphone peut les appeler.
 *
 * Format d'une étape :
 *   nom      libellé affiché en cas d'écart
 *   role     jeton utilisé : null (aucun) ou le nom d'une variable garde
 *   methode  verbe HTTP
 *   uri      adresse ; `{variable}` est remplacé par sa valeur
 *   corps    charge JSON ; une valeur '{variable}' est remplacée (type conservé)
 *   garder   [variable => chemin pointé dans la réponse]
 *   masquer  variables dont la valeur est aléatoire (effacée des empreintes)
 *   attendre secondes écoulées avant l'étape (1 par défaut)
 */

$png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

$e = fn (string $nom, ?string $role, string $methode, string $uri, array $corps = [], array $garder = [], array $masquer = [], int $attendre = 1) => compact('nom', 'role', 'methode', 'uri', 'corps', 'garder', 'masquer', 'attendre');

$permissionsEmploye = [
    'vente' => true, 'stock' => false, 'categories' => false, 'rapports' => false, 'caisse' => true,
    'credits' => true, 'clients' => true, 'fournisseurs' => false, 'commandes' => false, 'livraisons' => false,
];

return [
    // ─── Public et authentification ───────────────────────────────────────
    $e('santé', null, 'GET', '/api/health'),
    $e('inscription propriétaire', null, 'POST', '/api/auth/register', [
        'username' => 'awa@boutique.sn', 'password' => 'Password123', 'company_name' => 'Boutique Awa',
        'phone' => '77 111 22 33', 'device_name' => 'ordi-awa',
    ], ['jeton_proprio' => 'token', 'id_proprio' => 'user.id', 'boutique1' => 'user.current_boutique_id']),
    $e('inscription refusée (mot de passe faible)', null, 'POST', '/api/auth/register', ['username' => 'x@y.sn', 'password' => 'abc']),
    $e('connexion refusée', null, 'POST', '/api/auth/login', ['username' => 'awa@boutique.sn', 'password' => 'Mauvais123']),
    $e('connexion second appareil', null, 'POST', '/api/auth/login', [
        'username' => 'awa@boutique.sn', 'password' => 'Password123', 'device_name' => 'mobile-awa',
    ], ['jeton_proprio2' => 'token']),
    $e('non connecté', null, 'GET', '/api/products'),
    $e('moi', 'jeton_proprio', 'GET', '/api/auth/me'),
    $e('profil', 'jeton_proprio', 'PUT', '/api/auth/profile', ['company_name' => 'Boutique Awa Ndiaye', 'phone' => '77 111 22 44', 'photo' => $png]),
    $e('préférences', 'jeton_proprio', 'PUT', '/api/auth/preferences', ['modules_off' => ['returns', 'ia', 'returns'], 'auto_print' => true]),
    $e('préférences fusionnées', 'jeton_proprio', 'PUT', '/api/auth/preferences', ['auto_print' => false]),
    $e('passage premium', 'jeton_proprio', 'PUT', '/api/auth/upgrade', [
        'phone' => '77 111 22 44', 'payment_method' => 'wave', 'amount' => 5000, 'expiration' => '2026-10-15',
    ]),
    $e('double facteur activé', 'jeton_proprio', 'PUT', '/api/auth/2fa', ['enabled' => true]),
    $e('connexion avec double facteur', null, 'POST', '/api/auth/login', ['username' => 'awa@boutique.sn', 'password' => 'Password123']),
    $e('code double facteur refusé', null, 'POST', '/api/auth/verify-2fa', ['username' => 'awa@boutique.sn', 'code' => '000000']),
    $e('double facteur désactivé', 'jeton_proprio', 'PUT', '/api/auth/2fa', ['enabled' => false]),
    // Laravel compte ensemble les appels anonymes limités d'une même adresse IP
    // (inscription, connexion, mot de passe oublié) : on laisse passer la minute.
    $e('mot de passe oublié (inconnu)', null, 'POST', '/api/auth/forgot-password', ['username' => 'inconnu@x.sn'], attendre: 61),
    $e('mot de passe oublié', null, 'POST', '/api/auth/forgot-password', ['username' => 'awa@boutique.sn']),
    $e('réinitialisation refusée', null, 'POST', '/api/auth/reset-password', ['username' => 'awa@boutique.sn', 'code' => '000000', 'password' => 'NouveauMdp2026']),
    $e('erreur navigateur', null, 'POST', '/api/client-errors', [
        'message' => 'TypeError: x is undefined', 'stack' => 'at Vente (Vente.tsx:12)', 'source' => 'index.js', 'url' => '/', 'kind' => 'react',
    ]),

    // ─── Catalogue ────────────────────────────────────────────────────────
    $e('catégorie 1', 'jeton_proprio', 'POST', '/api/categories', ['name' => 'Alimentation', 'emoji' => '🍞', 'couleur' => '#F59E0B'], ['cat1' => 'id']),
    $e('catégorie 2', 'jeton_proprio', 'POST', '/api/categories', ['name' => 'Boissons', 'emoji' => '🥤', 'negociable' => true], ['cat2' => 'id']),
    $e('catégorie 3', 'jeton_proprio', 'POST', '/api/categories', ['name' => 'Vide'], ['cat3' => 'id']),
    $e('catégories', 'jeton_proprio', 'GET', '/api/categories'),
    $e('catégorie modifiée', 'jeton_proprio', 'PATCH', '/api/categories/{cat2}', ['couleur' => '#10B981']),
    $e('produit au poids avec conditionnement', 'jeton_proprio', 'POST', '/api/products', [
        'name' => 'Riz parfumé', 'category_id' => '{cat1}', 'scent' => 'Riz brisé', 'barcode' => '6001234567890',
        'price' => 600, 'price_achat' => 450, 'stock' => 100000, 'unite_base' => 'g', 'prix_min' => 550,
        'units' => [['libelle' => 'Sac 50 kg', 'facteur' => 50000, 'prix' => 27500]], 'photo' => $png,
    ], ['prod1' => 'id', 'cond1' => 'units.0.id']),
    $e('produit 2', 'jeton_proprio', 'POST', '/api/products', ['name' => 'Jus bissap', 'category_id' => '{cat2}', 'price' => 200, 'price_achat' => 100, 'stock' => 50], ['prod2' => 'id']),
    $e('produit 3', 'jeton_proprio', 'POST', '/api/products', ['name' => 'Savon', 'price' => 350, 'price_achat' => 250, 'stock' => 3, 'negociable' => false], ['prod3' => 'id']),
    $e('produit 4', 'jeton_proprio', 'POST', '/api/products', ['name' => 'Jetable', 'price' => 100, 'stock' => 1], ['prod4' => 'id']),
    $e('produit refusé', 'jeton_proprio', 'POST', '/api/products', ['name' => '', 'price' => -1]),
    $e('produits', 'jeton_proprio', 'GET', '/api/products'),
    $e('produits paginés', 'jeton_proprio', 'GET', '/api/products?page=1&per_page=2'),
    $e('produit', 'jeton_proprio', 'GET', '/api/products/{prod1}'),
    $e('produit modifié (PUT)', 'jeton_proprio', 'PUT', '/api/products/{prod2}', ['price' => 250, 'stock' => 60]),
    $e('produit supprimé', 'jeton_proprio', 'DELETE', '/api/products/{prod4}'),
    $e('corbeille produits', 'jeton_proprio', 'GET', '/api/products/trash'),
    $e('produit restauré', 'jeton_proprio', 'POST', '/api/products/{prod4}/restore'),
    $e('catégorie non vide', 'jeton_proprio', 'DELETE', '/api/categories/{cat1}'),
    $e('catégorie vide supprimée', 'jeton_proprio', 'DELETE', '/api/categories/{cat3}'),
    $e('produits v1', 'jeton_proprio', 'GET', '/api/v1/products'),

    // ─── Clients et fournisseurs ──────────────────────────────────────────
    $e('client', 'jeton_proprio', 'POST', '/api/clients', [
        'name' => 'Fatou Diop', 'phone' => '77 222 33 44', 'email' => 'fatou@x.sn', 'address' => 'Médina', 'notes' => 'Fidèle',
    ], ['client1' => 'id']),
    $e('client en double', 'jeton_proprio', 'POST', '/api/clients', ['name' => 'fatou diop']),
    $e('clients pour la vente', 'jeton_proprio', 'GET', '/api/clients/for-sale'),
    $e('fournisseur', 'jeton_proprio', 'POST', '/api/fournisseurs', [
        'name' => 'Grossiste Sandaga', 'phone' => '77 333 44 55', 'address' => 'Sandaga', 'notes' => 'Livre le mardi',
    ], ['four1' => 'id']),
    $e('fournisseurs', 'jeton_proprio', 'GET', '/api/fournisseurs'),
    $e('fournisseur modifié', 'jeton_proprio', 'PATCH', '/api/fournisseurs/{four1}', ['email' => 'sandaga@x.sn']),

    // ─── Ventes ───────────────────────────────────────────────────────────
    $e('vente espèces', 'jeton_proprio', 'POST', '/api/sales', [
        'product_id' => '{prod2}', 'quantity' => 2, 'payment_method' => 'especes', 'client_uuid' => '11111111-1111-4111-8111-111111111111',
    ], ['vente1' => 'id']),
    $e('vente au poids marchandée', 'jeton_proprio', 'POST', '/api/sales', ['product_id' => '{prod1}', 'quantite_base' => 2500, 'prix_reel' => 580, 'payment_method' => 'wave'], ['vente2' => 'id']),
    $e('vente en gros', 'jeton_proprio', 'POST', '/api/sales', ['product_id' => '{prod1}', 'unit_id' => '{cond1}', 'quantity' => 1, 'payment_method' => 'orange', 'client_id' => '{client1}'], ['vente3' => 'id']),
    $e('vente à crédit', 'jeton_proprio', 'POST', '/api/sales', [
        'product_id' => '{prod2}', 'quantity' => 3, 'payment_method' => 'credit', 'client_name' => 'Moussa Fall',
        'client_phone' => '77 444 55 66', 'due_date' => '2026-09-25',
    ], ['vente4' => 'id']),
    $e('stock insuffisant', 'jeton_proprio', 'POST', '/api/sales', ['product_id' => '{prod3}', 'quantity' => 10, 'payment_method' => 'especes']),
    $e('vente déjà reçue', 'jeton_proprio', 'POST', '/api/sales', [
        'product_id' => '{prod2}', 'quantity' => 2, 'payment_method' => 'especes', 'client_uuid' => '11111111-1111-4111-8111-111111111111',
    ]),
    $e('synchronisation hors ligne', 'jeton_proprio', 'POST', '/api/sales/sync', ['sales' => [
        ['client_uuid' => '22222222-2222-4222-8222-222222222222', 'product_id' => '{prod2}', 'quantity' => 1, 'payment_method' => 'especes', 'created_at' => '2026-09-15T09:00:00Z', 'label' => '1× Jus'],
        ['client_uuid' => '11111111-1111-4111-8111-111111111111', 'product_id' => '{prod2}', 'quantity' => 2, 'payment_method' => 'especes'],
        ['client_uuid' => '33333333-3333-4333-8333-333333333333', 'product_id' => 999, 'quantity' => 1, 'payment_method' => 'especes'],
        ['client_uuid' => '44444444-4444-4444-8444-444444444444', 'payment_method' => 'especes'],
    ]]),
    $e('ventes', 'jeton_proprio', 'GET', '/api/sales'),
    $e('ventes paginées', 'jeton_proprio', 'GET', '/api/sales?page=1&per_page=2'),
    $e('score crédit (client connu)', 'jeton_proprio', 'POST', '/api/ia/credit-score', ['amount' => 5000, 'client_name' => 'Moussa Fall', 'due_date' => '2026-10-30']),
    $e('score crédit (nouveau client)', 'jeton_proprio', 'POST', '/api/ia/credit-score', ['amount' => 40000]),
    $e('crédit réglé', 'jeton_proprio', 'PATCH', '/api/sales/{vente4}', ['paid' => true, 'repayment_method' => 'wave']),
    $e('quantité modifiée', 'jeton_proprio', 'PUT', '/api/sales/{vente1}', ['quantity' => 3]),
    $e('retour', 'jeton_proprio', 'POST', '/api/returns', ['sale_id' => '{vente1}', 'quantity' => 1, 'reason' => 'Abîmé', 'refund_method' => 'especes']),
    $e('retour excessif', 'jeton_proprio', 'POST', '/api/returns', ['sale_id' => '{vente1}', 'quantity' => 10]),
    $e('retours', 'jeton_proprio', 'GET', '/api/returns'),
    $e('statistiques retours', 'jeton_proprio', 'GET', '/api/returns/stats'),
    $e('vente annulée', 'jeton_proprio', 'DELETE', '/api/sales/{vente2}'),
    $e('corbeille ventes', 'jeton_proprio', 'GET', '/api/sales/trash'),
    $e('vente restaurée', 'jeton_proprio', 'POST', '/api/sales/{vente2}/restore'),
    $e('vente v1', 'jeton_proprio', 'POST', '/api/v1/sales', ['product_id' => '{prod2}', 'quantity' => 1, 'payment_method' => 'orange']),

    // ─── Fichier clients ──────────────────────────────────────────────────
    $e('clients', 'jeton_proprio', 'GET', '/api/clients'),
    $e('clients paginés', 'jeton_proprio', 'GET', '/api/clients?page=1&per_page=1'),
    $e('fiche client', 'jeton_proprio', 'GET', '/api/clients/{client1}'),
    $e('statistiques client', 'jeton_proprio', 'GET', '/api/clients/{client1}/stats'),
    $e('client modifié', 'jeton_proprio', 'PATCH', '/api/clients/{client1}', ['notes' => 'Très fidèle']),
    $e('client 2', 'jeton_proprio', 'POST', '/api/clients', ['name' => 'À supprimer'], ['client2' => 'id']),
    $e('client supprimé', 'jeton_proprio', 'DELETE', '/api/clients/{client2}'),

    // ─── Commandes et livraisons ──────────────────────────────────────────
    $e('commande', 'jeton_proprio', 'POST', '/api/commandes', [
        'fournisseur_id' => '{four1}', 'notes' => 'Urgent', 'expected_date' => '2026-09-20',
        'items' => [['product_id' => '{prod3}', 'quantity' => 20, 'prix_unitaire' => 250], ['product_id' => '{prod2}', 'quantity' => 10, 'prix_unitaire' => 100]],
    ], ['cmd1' => 'id']),
    $e('commande 2', 'jeton_proprio', 'POST', '/api/commandes', ['items' => [['product_id' => '{prod3}', 'quantity' => 5, 'prix_unitaire' => 250]]], ['cmd2' => 'id']),
    $e('commandes', 'jeton_proprio', 'GET', '/api/commandes'),
    $e('commande détaillée', 'jeton_proprio', 'GET', '/api/commandes/{cmd1}'),
    $e('commande modifiée', 'jeton_proprio', 'PATCH', '/api/commandes/{cmd2}', ['notes' => 'Finalement non']),
    $e('livraison', 'jeton_proprio', 'POST', '/api/livraisons', ['commande_id' => '{cmd1}', 'tracking_note' => 'Camion de 14 h'], ['liv1' => 'id']),
    $e('livraison sans commande', 'jeton_proprio', 'POST', '/api/livraisons', ['tracking_note' => 'Sans commande'], ['liv2' => 'id']),
    $e('livraisons', 'jeton_proprio', 'GET', '/api/livraisons'),
    $e('livraison détaillée', 'jeton_proprio', 'GET', '/api/livraisons/{liv1}'),
    $e('livraison en cours', 'jeton_proprio', 'PATCH', '/api/livraisons/{liv1}', ['status' => 'en_cours']),
    $e('livraison livrée', 'jeton_proprio', 'PATCH', '/api/livraisons/{liv1}', ['status' => 'livree']),
    $e('livraison réceptionnée', 'jeton_proprio', 'PUT', '/api/livraisons/{liv1}', ['status' => 'livree', 'recevoir' => true]),
    $e('commande reçue', 'jeton_proprio', 'PATCH', '/api/commandes/{cmd2}/recevoir'),
    $e('livraison supprimée', 'jeton_proprio', 'DELETE', '/api/livraisons/{liv2}'),
    $e('commande supprimée', 'jeton_proprio', 'DELETE', '/api/commandes/{cmd2}'),
    $e('message de réappro', 'jeton_proprio', 'GET', '/api/fournisseurs/{four1}/reappro-message?seuil=10&date=2026-09-20'),

    // ─── Caisse, statistiques, IA, journal ────────────────────────────────
    $e('caisse du jour', 'jeton_proprio', 'GET', '/api/caisse/today'),
    $e('clôture de caisse', 'jeton_proprio', 'POST', '/api/caisse/close', ['notes' => 'RAS']),
    $e('historique de caisse', 'jeton_proprio', 'GET', '/api/caisse/history'),
    $e('caisse de la semaine', 'jeton_proprio', 'GET', '/api/caisse/weekly'),
    $e('résumé du jour', 'jeton_proprio', 'GET', '/api/stats/resume-jour'),
    $e('ventes par catégorie', 'jeton_proprio', 'GET', '/api/stats/ventes-par-categorie'),
    $e('ventes par jour', 'jeton_proprio', 'GET', '/api/stats/ventes-par-jour'),
    $e('paiements', 'jeton_proprio', 'GET', '/api/stats/paiements'),
    $e('meilleurs produits', 'jeton_proprio', 'GET', '/api/stats/top-produits'),
    $e('stock faible', 'jeton_proprio', 'GET', '/api/stats/stock-faible?seuil=10'),
    $e('marge par catégorie', 'jeton_proprio', 'GET', '/api/stats/marge-categorie'),
    $e('rotation du stock', 'jeton_proprio', 'GET', '/api/stats/rotation-stock'),
    $e('meilleurs clients', 'jeton_proprio', 'GET', '/api/stats/meilleurs-clients'),
    $e('marchandage', 'jeton_proprio', 'GET', '/api/stats/marchandage'),
    $e('réappro IA', 'jeton_proprio', 'GET', '/api/ia/reappro'),
    $e('journal', 'jeton_proprio', 'GET', '/api/activity'),
    $e('journal paginé', 'jeton_proprio', 'GET', '/api/activity?page=1&per_page=5'),
    $e('tontines (vide)', 'jeton_proprio', 'GET', '/api/tontines'),
    $e('tontine', 'jeton_proprio', 'POST', '/api/tontines', ['name' => 'Tontine du marché', 'type' => 'Hebdomadaire', 'amount' => 5000, 'members' => 12]),
    $e('tontines', 'jeton_proprio', 'GET', '/api/tontines'),

    // ─── Boutiques ────────────────────────────────────────────────────────
    $e('boutiques', 'jeton_proprio', 'GET', '/api/boutiques'),
    $e('boutique 2', 'jeton_proprio', 'POST', '/api/boutiques', ['name' => 'Boutique Marché', 'phone' => '77 555 66 77', 'address' => 'HLM', 'emoji' => '🏬'], ['boutique2' => 'id']),
    $e('tableau de bord', 'jeton_proprio', 'GET', '/api/boutiques/dashboard'),
    $e('statistiques boutique', 'jeton_proprio', 'GET', '/api/boutiques/{boutique2}/stats'),
    $e('boutique modifiée', 'jeton_proprio', 'PATCH', '/api/boutiques/{boutique2}', ['address' => 'HLM 5']),
    $e('boutique activée', 'jeton_proprio', 'POST', '/api/boutiques/{boutique2}/switch'),
    $e('produits de la boutique 2', 'jeton_proprio', 'GET', '/api/products'),
    $e('retour à la boutique 1', 'jeton_proprio', 'POST', '/api/boutiques/{boutique1}/switch'),
    $e('boutique principale indélébile', 'jeton_proprio', 'DELETE', '/api/boutiques/{boutique1}'),
    $e('boutique 3', 'jeton_proprio', 'POST', '/api/boutiques', ['name' => 'Boutique Gare'], ['boutique3' => 'id']),
    $e('limite de boutiques', 'jeton_proprio', 'POST', '/api/boutiques', ['name' => 'Boutique de trop']),
    $e('boutique supprimée', 'jeton_proprio', 'DELETE', '/api/boutiques/{boutique3}'),

    // ─── Équipe ───────────────────────────────────────────────────────────
    $e('invitation', 'jeton_proprio', 'POST', '/api/members/invite', [
        'email' => 'moussa@boutique.sn', 'role' => 'employe', 'permissions' => $permissionsEmploye,
        'name' => 'Moussa', 'phone' => '77 666 77 88', 'photo' => $png,
    ], ['jeton_invitation' => 'invite_token', 'membre1' => 'member.id'], ['jeton_invitation']),
    $e('invitation en double', 'jeton_proprio', 'POST', '/api/members/invite', ['email' => 'moussa@boutique.sn']),
    $e('aperçu public', null, 'GET', '/api/members/invite/{jeton_invitation}'),
    $e('aperçu inconnu', null, 'GET', '/api/members/invite/inconnu'),
    $e('inscription employé', null, 'POST', '/api/auth/register', ['username' => 'moussa@boutique.sn', 'password' => 'Password123', 'company_name' => 'Moussa'], ['jeton_employe' => 'token']),
    $e('invitation acceptée', 'jeton_employe', 'POST', '/api/members/accept', ['invite_token' => '{jeton_invitation}']),
    $e('ma boutique', 'jeton_employe', 'GET', '/api/members/my-boutique'),
    $e('membres', 'jeton_proprio', 'GET', '/api/members'),
    $e('membres de la boutique 1', 'jeton_proprio', 'GET', '/api/members?boutique_id={boutique1}'),
    $e('membre modifié', 'jeton_proprio', 'PATCH', '/api/members/{membre1}', ['role' => 'employe', 'name' => 'Moussa Sow']),
    $e('moi (employé)', 'jeton_employe', 'GET', '/api/auth/me'),
    $e('connexion employé', null, 'POST', '/api/auth/login', ['username' => 'moussa@boutique.sn', 'password' => 'Password123', 'device_name' => 'mobile-moussa']),
    $e('produits (employé)', 'jeton_employe', 'GET', '/api/products'),
    $e('corbeille refusée (employé)', 'jeton_employe', 'GET', '/api/products/trash'),
    $e('vente (employé)', 'jeton_employe', 'POST', '/api/sales', ['product_id' => '{prod2}', 'quantity' => 1, 'payment_method' => 'especes']),
    $e('vente sous le plancher (employé)', 'jeton_employe', 'POST', '/api/sales', ['product_id' => '{prod1}', 'quantite_base' => 1000, 'prix_reel' => 500, 'payment_method' => 'especes']),
    $e('résumé du jour (employé)', 'jeton_employe', 'GET', '/api/stats/resume-jour'),
    $e('statistiques refusées (employé)', 'jeton_employe', 'GET', '/api/stats/paiements'),
    $e('préférences (employé)', 'jeton_employe', 'PUT', '/api/auth/preferences', ['modules_off' => ['stock']]),
    $e('clients pour la vente (employé)', 'jeton_employe', 'GET', '/api/clients/for-sale'),
    $e('membre retiré', 'jeton_proprio', 'DELETE', '/api/members/{membre1}'),

    // ─── Cloisonnement entre commerçants ──────────────────────────────────
    $e('second commerçant', null, 'POST', '/api/auth/register', ['username' => 'autre@boutique.sn', 'password' => 'Password123', 'company_name' => 'Autre'], ['jeton_autre' => 'token']),
    $e('produit d\'autrui introuvable', 'jeton_autre', 'GET', '/api/products/{prod1}'),
    $e('catégorie d\'autrui refusée', 'jeton_autre', 'POST', '/api/products', ['name' => 'X', 'category_id' => '{cat2}']),

    // ─── Administration ───────────────────────────────────────────────────
    $e('connexion admin', null, 'POST', '/api/auth/login', ['username' => 'admin@samacommerce.sn', 'password' => 'MotDePasseAdmin2026'], ['jeton_admin' => 'token']),
    $e('utilisateurs', 'jeton_admin', 'GET', '/api/auth/users'),
    $e('utilisateurs refusés (commerçant)', 'jeton_proprio', 'GET', '/api/auth/users'),
    $e('utilisateur créé', 'jeton_admin', 'POST', '/api/auth/users', [
        'username' => 'nouveau@x.sn', 'company_name' => 'Nouveau', 'phone' => '77 777 88 99', 'plan' => 'Premium', 'payment_method' => 'orange',
    ], ['util_nouveau' => 'id']),
    $e('utilisateur bloqué', 'jeton_admin', 'PUT', '/api/auth/users/{util_nouveau}/block'),
    $e('utilisateur réactivé', 'jeton_admin', 'PUT', '/api/auth/users/{util_nouveau}/activate'),
    $e('relance', 'jeton_admin', 'POST', '/api/auth/users/{util_nouveau}/reminder'),
    $e('passage premium validé', 'jeton_admin', 'PUT', '/api/auth/upgrade/{id_proprio}/approve'),
    $e('passage premium refusé', 'jeton_admin', 'PUT', '/api/auth/upgrade/{util_nouveau}/reject'),
    $e('vue d\'ensemble', 'jeton_admin', 'GET', '/api/admin-stats/overview'),
    $e('revenus du mois', 'jeton_admin', 'GET', '/api/admin-stats/revenus?period=monthly'),
    $e('revenus totaux', 'jeton_admin', 'GET', '/api/admin-stats/revenus?period=all'),
    $e('évolution des revenus', 'jeton_admin', 'GET', '/api/admin-stats/revenus/evolution'),
    $e('transactions', 'jeton_admin', 'GET', '/api/admin-stats/transactions?limit=5'),
    $e('retrait', 'jeton_admin', 'POST', '/api/admin-withdrawals', ['amount' => 1000, 'method' => 'wave']),
    $e('retraits', 'jeton_admin', 'GET', '/api/admin-withdrawals'),
    $e('transfert', 'jeton_admin', 'POST', '/api/admin-transfers', ['from' => 'wave', 'to' => 'orange', 'amount' => 500]),
    $e('transferts', 'jeton_admin', 'GET', '/api/admin-transfers'),
    $e('comptes', 'jeton_admin', 'GET', '/api/admin-stats/accounts'),
    $e('détail d\'un compte', 'jeton_admin', 'GET', '/api/admin-stats/accounts/wave'),
    $e('paramètres', 'jeton_admin', 'GET', '/api/admin-settings'),
    $e('paramètres modifiés', 'jeton_admin', 'PUT', '/api/admin-settings', [
        'app_name' => 'SamaCommerce', 'contact_email' => 'contact@x.sn', 'timezone' => 'Africa/Dakar', 'premium_price' => 5000,
        'grace_period' => 7, 'alerts_enabled' => true, 'notify_new_subs' => false, 'notify_late_payments' => true,
        'notify_reports' => true, 'multi_sessions' => false,
    ]),
    $e('double facteur admin', 'jeton_admin', 'PATCH', '/api/admin-settings/twofa'),
    $e('utilisateur supprimé', 'jeton_admin', 'DELETE', '/api/auth/users/{util_nouveau}'),

    // ─── Fin de session ───────────────────────────────────────────────────
    $e('fournisseur supprimé', 'jeton_proprio', 'DELETE', '/api/fournisseurs/{four1}'),
    $e('déconnexion', 'jeton_proprio2', 'POST', '/api/auth/logout'),
    $e('jeton révoqué', 'jeton_proprio2', 'GET', '/api/auth/me'),
    $e('déconnexion partout', 'jeton_proprio', 'POST', '/api/auth/logout-all'),
    $e('plus aucun jeton', 'jeton_proprio', 'GET', '/api/auth/me'),
];
