# visorando-mcp

Serveur [Model Context Protocol](https://modelcontextprotocol.io/) non officiel pour rechercher et comparer les métadonnées publiques des randonnées [Visorando](https://www.visorando.com/).

## Fonctionnalités

- `search_hikes` — recherche par lieu, titre, mot-clé ou numéro ;
- `find_hikes` — recherche autour d’un lieu, filtrage par distance cible et classement par proximité ;
- `get_hike` — distance, durée, difficulté, dénivelé, boucle, départ, note et dates ;
- `compare_hikes` — comparaison parallèle de 2 à 5 fiches ;
- ressource `visorando://legal` — périmètre légal et technique ;
- prompt `choose_a_hike` — workflow de sélection assistée ;
- cache mémoire, délai maximal réseau, validation stricte des URL et protection SSRF ;
- zéro identifiant Visorando requis.

Un assistant connecté au serveur peut donc traiter directement une demande naturelle comme :

> Trouve une randonnée de 10 km autour de Guebwiller.

Il appellera `find_hikes` avec `location: "Guebwiller"` et `targetDistanceKm: 10`. La tolérance par défaut est de ±2 km et peut être modifiée.

> [!IMPORTANT]
> Visorando précise que les descriptions et traces GPS restent la propriété de leurs auteurs. Ce serveur ne les copie pas et ne contourne aucun téléchargement. Il expose uniquement des métadonnées publiques et renvoie vers la fiche source. Ce projet n’est ni affilié à ni approuvé par Visorando.

## Installation

```bash
git clone https://github.com/talanon/visorando-mcp.git
cd visorando-mcp
npm ci
npm run build
```

Configuration Codex/Claude Desktop :

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

Les tests sont déterministes et n’appellent pas Visorando. Une vérification réelle ponctuelle peut être faite avec l’inspecteur MCP :

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Limites

- Visorando ne publie pas d’API développeur publique documentée pour ce besoin ; le parseur s’appuie donc sur le HTML public et les données structurées Schema.org.
- Les changements de balisage du site peuvent demander une mise à jour du parseur.
- Les résultats ne remplacent pas la fiche originale, une carte adaptée, la météo ni l’évaluation des conditions sur le terrain.

## Licence

Code sous licence MIT. Les contenus Visorando restent soumis aux droits de Visorando et de leurs auteurs respectifs.
