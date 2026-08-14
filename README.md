# visorando-mcp

Plugin Codex et serveur [Model Context Protocol](https://modelcontextprotocol.io/) non officiels pour rechercher un itinéraire [Visorando](https://www.visorando.com/), préparer nutrition et hydratation, puis organiser l’accès au départ.

## Fonctionnalités

- `search_hikes` — recherche par lieu, titre, mot-clé ou numéro ;
- `find_hikes` — recherche autour d’un lieu, filtrage par distance cible et classement par proximité ;
- `get_hike` — distance, durée, difficulté, dénivelé, boucle, départ, note et dates ;
- `compare_hikes` — comparaison parallèle de 2 à 5 fiches ;
- `estimate_trail_needs` — fourchettes de glucides, eau, sodium, portage initial et nombre de portions ;
- `find_hike_access` — parkings, gares, trams et arrêts de bus OpenStreetMap proches du départ ;
- `prepare_trail` — préparation combinée d’une fiche : durée trail, besoins et accès ;
- ressource `visorando://legal` — périmètre légal et technique ;
- ressource `visorando://trail-planning-method` — hypothèses et limites des calculs ;
- prompt `choose_a_hike` — workflow de sélection assistée ;
- prompt `prepare_a_trail` — workflow complet de préparation ;
- quatre skills Codex : recherche, nutrition/hydratation, accès et orchestration complète ;
- cache mémoire, délai maximal réseau, validation stricte des URL et protection SSRF ;
- zéro identifiant Visorando requis.

Un assistant connecté au serveur peut donc traiter directement une demande naturelle comme :

> Trouve une randonnée de 10 km autour de Guebwiller.

Il appellera `find_hikes` avec `location: "Guebwiller"`, `targetDistanceKm: 10` et la tolérance par défaut de ±2 km. Si la recherche renvoie moins de deux résultats, l’assistant élargira la tolérance de 2 km, au maximum trois fois : ±4 km, ±6 km, puis ±8 km. Si aucun résultat n’est trouvé après ces trois élargissements, il l’indiquera clairement.

## Exemples de demandes d’un trailer

- « Trouve-moi une boucle de 20 km et environ 1 000 m D+ autour de Gérardmer. »
- « Compare ces trois parcours pour une sortie longue, en privilégiant le dénivelé et un retour au point de départ. »
- « Je pense courir ce parcours en 3 h 30 : combien de grammes de glucides et combien de gels de 25 g préparer ? »
- « Il fera chaud et je transpire environ 0,8 L/h. J’ai un ravitaillement fiable de 1 L : combien d’eau dois-je porter au départ ? »
- « Où puis-je me garer à moins de 1,5 km du départ ? »
- « Puis-je venir en train ou en bus, et quels arrêts dois-je vérifier ? »
- « Prépare toute ma sortie : parcours, temps estimé, nutrition, eau, parking ou transports et checklist. »
- « Refais le calcul avec mon allure de 6 min/km-effort et une réserve d’eau de 500 ml. »

Par défaut, toute sortie proposée inclut automatiquement le Départ/Arrivée Visorando reporté sur Google Maps comme stationnement indicatif, les parkings OpenStreetMap voisins, l’eau, la nourriture et les photos illustratives disponibles sur la fiche. Sans données personnelles, le plugin estime la durée à 6 min/km-effort et prévoit 30 à 40 g de glucides par heure. Ces valeurs restent indicatives et doivent être testées à l’entraînement. L’hydratation privilégie un taux de sudation personnel lorsqu’il est connu ; les valeurs génériques ne sont qu’un point de départ.

> [!IMPORTANT]
> Visorando précise que les descriptions et traces GPS restent la propriété de leurs auteurs. Ce serveur ne les copie pas et ne contourne aucun téléchargement. Il expose uniquement des métadonnées publiques et renvoie vers la fiche source. Ce projet n’est ni affilié à ni approuvé par Visorando.

## Installation

```bash
git clone https://github.com/talanon/visorando-mcp.git
cd visorando-mcp
npm ci
npm run build
```

### Plugin Codex

Le dépôt contient le manifeste `.codex-plugin/plugin.json`, le branchement MCP
`.mcp.json` et les quatre skills du dossier `skills/`. Pour le développement local,
compilez le serveur puis exposez ce dépôt depuis votre marketplace personnelle.
Après installation du plugin, ouvrez une nouvelle tâche Codex afin de charger
le skill et les outils MCP.

### Serveur MCP seul

La commande suivante enregistre le chemin absolu dans `~/.codex/config.toml` :

```bash
codex mcp add visorando -- node "$(pwd)/dist/index.js"
codex mcp get visorando
```

Ouvrez ensuite une nouvelle session Codex pour charger le serveur. Vous pouvez
alors demander, par exemple : « Trouve une randonnée de 10 km autour de
Guebwiller. »

Configuration Claude Desktop :

```json
{
  "mcpServers": {
    "visorando": {
      "command": "node",
      "args": ["/chemin/absolu/visorando-mcp/dist/index.js"]
    }
  }
}
```

Pour un lancement depuis le dépôt :

```bash
npm start
```

Le protocole utilise `stdout`. Les éventuels diagnostics sont écrits sur `stderr` afin de ne pas corrompre les messages MCP.

## Développement

Prérequis : Node.js 20 ou supérieur.

```bash
npm install
npm run check
npm run build
npm run pack:check
```

Le contrôle qualité bloque toute régression sous les seuils suivants : 95 % des instructions, 90 % des branches, 100 % des fonctions et 95 % des lignes. Il combine TypeScript strict, ESLint avec analyse typée stricte, Prettier, Vitest, audit npm, test du paquet réellement installé, CI Node.js 20/22/24 et analyse CodeQL. Dependabot surveille les dépendances npm et GitHub Actions.

Les tests sont déterministes et n’appellent pas Visorando. Une vérification
réelle ponctuelle peut être faite avec l’Inspector MCP v2. Le mode doit être
indiqué avant la commande du serveur :

```bash
npx --yes @modelcontextprotocol/inspector@latest --web node dist/index.js
```

Pour vérifier la liste des outils sans interface graphique :

```bash
npx --yes @modelcontextprotocol/inspector@latest --cli \
  node dist/index.js --method tools/list
```

## Limites

- Visorando ne publie pas d’API développeur publique documentée pour ce besoin ; le parseur s’appuie donc sur le HTML public et les données structurées Schema.org.
- Les changements de balisage du site peuvent demander une mise à jour du parseur.
- Les accès proviennent d’OpenStreetMap via Overpass : leur présence, leur ouverture, leur capacité et les horaires doivent être vérifiés.
- Les distances d’accès sont à vol d’oiseau et les liens de transport délèguent le calcul d’itinéraire ; aucune donnée temps réel n’est fournie.
- Nutrition, hydratation, sodium et durée trail sont des estimations, pas des prescriptions médicales ni des garanties de performance.
- Les résultats ne remplacent pas la fiche originale, une carte adaptée, la météo ni l’évaluation des conditions sur le terrain.

## Licence

Code sous licence MIT. Les contenus Visorando restent soumis aux droits de Visorando et de leurs auteurs respectifs.
