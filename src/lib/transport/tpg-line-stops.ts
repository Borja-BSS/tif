export interface TpgStop {
  name:  string
  coord: [number, number]  // [lng, lat]
}

export interface TpgLineConfig {
  terminusA: string
  terminusB: string
  stops:     TpgStop[]
}

export const TPG_LINES: Record<string, TpgLineConfig> = {
  '1': {
    terminusA: 'Veyrier-Douane', terminusB: 'Onex Cité',
    stops: [
      { name: 'Veyrier-Douane',  coord: [6.1648, 46.1545] },
      { name: 'Plainpalais',     coord: [6.1400, 46.1950] },
      { name: 'Bel-Air',         coord: [6.1447, 46.2042] },
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
      { name: 'Blandonnet',      coord: [6.0953, 46.2252] },
      { name: 'Onex Cité',       coord: [6.0932, 46.1855] },
    ],
  },
  '2': {
    terminusA: 'Aïre', terminusB: 'Moillesulaz',
    stops: [
      { name: 'Aïre',        coord: [6.0762, 46.2078] },
      { name: 'Cornavin',    coord: [6.1421, 46.2098] },
      { name: 'Bel-Air',     coord: [6.1447, 46.2042] },
      { name: 'Rive',        coord: [6.1499, 46.2016] },
      { name: 'Eaux-Vives',  coord: [6.1698, 46.2010] },
      { name: 'Moillesulaz', coord: [6.1876, 46.1955] },
    ],
  },
  '5': {
    terminusA: 'Aéroport', terminusB: 'Gradelle',
    stops: [
      { name: 'Aéroport', coord: [6.1093, 46.2310] },
      { name: 'Cornavin',  coord: [6.1421, 46.2098] },
      { name: 'Rive',      coord: [6.1499, 46.2016] },
      { name: 'Gradelle',  coord: [6.1876, 46.1856] },
    ],
  },
  '6': {
    terminusA: 'Cressy', terminusB: 'Aéroport',
    stops: [
      { name: 'Cressy',          coord: [6.0965, 46.1680] },
      { name: 'Lancy-Palettes',  coord: [6.1186, 46.1700] },
      { name: 'Acacias',         coord: [6.1369, 46.1955] },
      { name: 'Bel-Air',         coord: [6.1447, 46.2042] },
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
      { name: 'Blandonnet',      coord: [6.0953, 46.2252] },
      { name: 'Aéroport',        coord: [6.1093, 46.2310] },
    ],
  },
  '7': {
    terminusA: 'Carouge-Rondeau', terminusB: 'Cornavin',
    stops: [
      { name: 'Carouge-Rondeau', coord: [6.1375, 46.1849] },
      { name: 'Plainpalais',     coord: [6.1400, 46.1950] },
      { name: 'Bel-Air',         coord: [6.1447, 46.2042] },
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
    ],
  },
  '9': {
    terminusA: 'Palettes', terminusB: 'Carouge-Rondeau',
    stops: [
      { name: 'Palettes',        coord: [6.1196, 46.1607] },
      { name: 'Bachet-de-Pesay', coord: [6.1198, 46.1760] },
      { name: 'Plainpalais',     coord: [6.1400, 46.1950] },
      { name: 'Carouge-Rondeau', coord: [6.1375, 46.1849] },
    ],
  },
  '10': {
    terminusA: 'Cornavin', terminusB: 'Vernier',
    stops: [
      { name: 'Cornavin',   coord: [6.1421, 46.2098] },
      { name: 'Nations',    coord: [6.1409, 46.2261] },
      { name: 'Blandonnet', coord: [6.0953, 46.2252] },
      { name: 'Vernier',    coord: [6.0870, 46.2147] },
    ],
  },
  '12': {
    terminusA: 'Cornavin', terminusB: 'Moillesulaz',
    stops: [
      { name: 'Cornavin',    coord: [6.1421, 46.2098] },
      { name: 'Bel-Air',     coord: [6.1447, 46.2042] },
      { name: 'Rive',        coord: [6.1499, 46.2016] },
      { name: 'Eaux-Vives',  coord: [6.1698, 46.2010] },
      { name: 'Moillesulaz', coord: [6.1876, 46.1955] },
    ],
  },
  '14': {
    terminusA: 'Meyrin-Gravière', terminusB: 'Bernex',
    stops: [
      { name: 'Meyrin-Gravière', coord: [6.0610, 46.2290] },
      { name: 'Blandonnet',      coord: [6.0953, 46.2252] },
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
      { name: 'Plainpalais',     coord: [6.1400, 46.1950] },
      { name: 'Bachet-de-Pesay', coord: [6.1198, 46.1760] },
      { name: 'Bernex',          coord: [6.0850, 46.1754] },
    ],
  },
  '15': {
    terminusA: 'Palettes', terminusB: 'Cluse-Roseraie',
    stops: [
      { name: 'Palettes',        coord: [6.1196, 46.1607] },
      { name: 'Bachet-de-Pesay', coord: [6.1198, 46.1760] },
      { name: 'Plainpalais',     coord: [6.1400, 46.1950] },
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
      { name: 'Cluse-Roseraie',  coord: [6.1482, 46.1940] },
    ],
  },
  '18': {
    terminusA: 'Aéroport', terminusB: 'Carouge Marché',
    stops: [
      { name: 'Aéroport',        coord: [6.1093, 46.2310] },
      { name: 'Nations',          coord: [6.1409, 46.2261] },
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
      { name: 'Bel-Air',         coord: [6.1447, 46.2042] },
      { name: 'Rive',             coord: [6.1499, 46.2016] },
      { name: 'Carouge-Rondeau', coord: [6.1375, 46.1849] },
      { name: 'Carouge Marché',  coord: [6.1330, 46.1830] },
    ],
  },
  '19': {
    terminusA: 'Cornavin', terminusB: 'Meyrin-Village',
    stops: [
      { name: 'Cornavin',       coord: [6.1421, 46.2098] },
      { name: 'Nations',         coord: [6.1409, 46.2261] },
      { name: 'Blandonnet',     coord: [6.0953, 46.2252] },
      { name: 'Meyrin-Village', coord: [6.0800, 46.2231] },
    ],
  },
  '25': {
    terminusA: 'Cornavin', terminusB: 'Grand-Lancy',
    stops: [
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
      { name: 'Bel-Air',         coord: [6.1447, 46.2042] },
      { name: 'Acacias',         coord: [6.1369, 46.1955] },
      { name: 'Carouge-Rondeau', coord: [6.1375, 46.1849] },
      { name: 'Grand-Lancy',     coord: [6.1128, 46.1731] },
      { name: 'Lancy-Palettes',  coord: [6.1186, 46.1700] },
    ],
  },
  '36': {
    terminusA: 'Bernex', terminusB: 'Cornavin',
    stops: [
      { name: 'Bernex',          coord: [6.0850, 46.1754] },
      { name: 'Lancy-Palettes',  coord: [6.1186, 46.1700] },
      { name: 'Carouge-Rondeau', coord: [6.1375, 46.1849] },
      { name: 'Plainpalais',     coord: [6.1400, 46.1950] },
      { name: 'Cornavin',        coord: [6.1421, 46.2098] },
    ],
  },
}
