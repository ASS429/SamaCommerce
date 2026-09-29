/* Exécute la reprise du stockage de l'ancienne version DÈS L'IMPORT.
 *
 * Ce module doit être le PREMIER importé par demarrage.tsx : les modules
 * s'évaluent dans l'ordre de leurs imports, et certains lisent le stockage dès
 * le leur (les titres de navigation lisent la langue, par exemple). Un simple
 * appel dans le corps de demarrage.tsx arriverait trop tard. */

import { effacerAncienCacheApi, migrerStockageLocal } from './migrationStockage'

migrerStockageLocal()
void effacerAncienCacheApi()
