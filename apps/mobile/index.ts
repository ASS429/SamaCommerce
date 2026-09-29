import { registerRootComponent } from 'expo';

import Application from './Application';

// registerRootComponent enregistre le composant racine sous le nom « main »
// (AppRegistry.registerComponent) et prépare l'environnement, que l'application
// tourne dans Expo Go ou dans une version native compilée.
registerRootComponent(Application);
