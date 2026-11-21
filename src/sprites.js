// Pixel-art sprite matrices & palettes for Hammy Co-op

export const FUR_PALETTES = {
  golden: {
    main: '#f5b062',
    dark: '#d1843b',
    belly: '#fff5e4',
    ear: '#f7a1b5',
    cheek: '#ff8da1',
    outline: '#3b2416',
    eye: '#1f140e',
  },
  snow: {
    main: '#f9f6f0',
    dark: '#dfd7ca',
    belly: '#ffffff',
    ear: '#ffb5c5',
    cheek: '#ff96ad',
    outline: '#3b2416',
    eye: '#1f140e',
  },
  choco: {
    main: '#8c624c',
    dark: '#634130',
    belly: '#f5e6d8',
    ear: '#e5989b',
    cheek: '#ff8da1',
    outline: '#2b1910',
    eye: '#140c08',
  },
  berry: {
    main: '#f7a8b8',
    dark: '#dc7c91',
    belly: '#fff0f5',
    ear: '#ffd1dc',
    cheek: '#ff5c8a',
    outline: '#3b2416',
    eye: '#1f140e',
  },
};

// Legend:
// . = transparent, O = outline, M = main fur, D = dark fur, B = belly,
// E = ear inner / nose, K = eye, C = chubby cheek blush, W = white highlight
const HAMSTER_FRAMES = {
  idle1: [
    '.....OOO......OOO.....',
    '....OEEEO....OEEEO....',
    '....OMMMOOOOOOMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMMMMMMMMMMMMMMMO..',
    '..OMMWKMMMMMMMMWKMMO..',
    '.OMCCKKMMMMEEMMKKCCMO.',
    '.OMCCCMMMMMMMMMMCCCMO.',
    '.OMMMMBBBBBBBBBBMMMDMO',
    '.OMMMBBBBBBBBBBBBMMDMO',
    'OOMMMBBBBBBBBBBBBMMMDO',
    'OMMMMBBBBBBBBBBBBMMMDO',
    '.OMMMBBBBBBBBBBBBMMDO.',
    '.OMMMMBBBBBBBBBBMMMDO.',
    '..OMMMMMMMMMMMMMMMDO..',
    '..OOOMMMMMMMMMMMMDOO..',
    '...OO.OO......OO.OO...',
    '......................',
  ],
  idle2: [
    '......................',
    '.....OOO......OOO.....',
    '....OEEEO....OEEEO....',
    '....OMMMOOOOOOMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMWKMMMMMMMMWKMMO..',
    '.OMCCKKMMMMEEMMKKCCMO.',
    '.OMCCCMMMMMMMMMMCCCMO.',
    '.OMMMMBBBBBBBBBBMMMDMO',
    '.OMMMBBBBBBBBBBBBMMDMO',
    'OOMMMBBBBBBBBBBBBMMMDO',
    'OMMMMBBBBBBBBBBBBMMMDO',
    '.OMMMBBBBBBBBBBBBMMDO.',
    '.OMMMMBBBBBBBBBBMMMDO.',
    '..OMMMMMMMMMMMMMMMDO..',
    '..OOOMMMMMMMMMMMMDOO..',
    '...OO.OO......OO.OO...',
    '......................',
  ],
  walk1: [
    '.....OOO......OOO.....',
    '....OEEEO....OEEEO....',
    '....OMMMOOOOOOMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMWKMMMMMMMMWKMMO..',
    '.OMCCKKMMMMEEMMKKCCMO.',
    '.OMCCCMMMMMMMMMMCCCMO.',
    '.OMMMMBBBBBBBBBBMMMDMO',
    '.OMMMBBBBBBBBBBBBMMDMO',
    'OOMMMBBBBBBBBBBBBMMMDO',
    'OMMMMBBBBBBBBBBBBMMMDO',
    '.OMMMBBBBBBBBBBBBMMDO.',
    '.OMMMMBBBBBBBBBBMMMDO.',
    '..OMMMMMMMMMMMMMMMDO..',
    '..OOOMMMMMMMMMMMMDOO..',
    '..OO...OO....OO...OO..',
    '......................',
    '......................',
  ],
  walk2: [
    '.....OOO......OOO.....',
    '....OEEEO....OEEEO....',
    '....OMMMOOOOOOMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMWKMMMMMMMMWKMMO..',
    '.OMCCKKMMMMEEMMKKCCMO.',
    '.OMCCCMMMMMMMMMMCCCMO.',
    '.OMMMMBBBBBBBBBBMMMDMO',
    '.OMMMBBBBBBBBBBBBMMDMO',
    'OOMMMBBBBBBBBBBBBMMMDO',
    'OMMMMBBBBBBBBBBBBMMMDO',
    '.OMMMBBBBBBBBBBBBMMDO.',
    '.OMMMMBBBBBBBBBBMMMDO.',
    '..OMMMMMMMMMMMMMMMDO..',
    '..OOOMMMMMMMMMMMMDOO..',
    '....OO..OO..OO..OO....',
    '......................',
    '......................',
  ],
  eat1: [
    '.....OOO......OOO.....',
    '....OEEEO....OEEEO....',
    '....OMMMOOOOOOMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMWKMMMMMMMMWKMMO..',
    'OOMCCKKMMMMEEMMKKCCMOO',
    'OMCCCCMMMMMMMMMMCCCCMO',
    'OMCCCCBBBBBBBBBBCCCCMO',
    '.OMMMBBBBBBBBBBBBMMDMO',
    'OOMMMBBBBBBBBBBBBMMMDO',
    'OMMMMBBBBBBBBBBBBMMMDO',
    '.OMMMBBBBBBBBBBBBMMDO.',
    '.OMMMMBBBBBBBBBBMMMDO.',
    '..OMMMMMMMMMMMMMMMDO..',
    '..OOOMMMMMMMMMMMMDOO..',
    '...OO.OO......OO.OO...',
    '......................',
    '......................',
  ],
  happy: [
    '.....OOO......OOO.....',
    '....OEEEO....OEEEO....',
    '....OMMMOOOOOOMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMKMMMMMMMMMMKMMO..',
    '.OMKMKMMMMMEEMMMKMKMO.',
    '.OMCCCMMMMMMMMMMCCCMO.',
    '.OMMMMBBBBBBBBBBMMMDMO',
    '.OMMMBBBBBBBBBBBBMMDMO',
    'OOMMMBBBBBBBBBBBBMMMDO',
    'OMMMMBBBBBBBBBBBBMMMDO',
    '.OMMMBBBBBBBBBBBBMMDO.',
    '.OMMMMBBBBBBBBBBMMMDO.',
    '..OMMMMMMMMMMMMMMMDO..',
    '..OOOMMMMMMMMMMMMDOO..',
    '..OO............OO....',
    '......................',
    '......................',
  ],
  sleep: [
    '......................',
    '......................',
    '......................',
    '.....OOO......OOO.....',
    '....OEEEO....OEEEO....',
    '....OMMMOOOOOOMMMO....',
    '...OMMMMMMMMMMMMMMO...',
    '..OMMKKMMMMMMMEEKKMMO.',
    '.OMCCCMMMMMMMMMMCCCMO.',
    '.OMMMBBBBBBBBBBBBMMDMO',
    'OOMMMBBBBBBBBBBBBMMMDO',
    '.OMMMBBBBBBBBBBBBMMDO.',
    '.OMMMMBBBBBBBBBBMMMDO.',
    '..OMMMMMMMMMMMMMMMDO..',
    '..OOOMMMMMMMMMMMMDOO..',
    '......................',
    '......................',
    '......................',
  ],
};

export function drawHamster(ctx, x, y, frameName, furKey, flip = false, scale = 2) {
  const frame = HAMSTER_FRAMES[frameName] || HAMSTER_FRAMES.idle1;
  const pal = FUR_PALETTES[furKey] || FUR_PALETTES.golden;
  const colorMap = {
    O: pal.outline,
    M: pal.main,
    D: pal.dark,
    B: pal.belly,
    E: pal.ear,
    K: pal.eye,
    C: pal.cheek,
    W: '#ffffff',
  };

  const w = frame[0].length;
  const h = frame.length;
  const startX = Math.round(x - (w * scale) / 2);
  const startY = Math.round(y - h * scale);

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const ch = frame[row][col];
      if (ch === '.') continue;
      ctx.fillStyle = colorMap[ch] || '#000';
      const drawCol = flip ? w - 1 - col : col;
      ctx.fillRect(startX + drawCol * scale, startY + row * scale, scale, scale);
    }
  }
}

const FOOD_SPRITES = {
  seed: [
    '..OO..',
    '.OYYO.',
    'OYYBYO',
    'OYYBYO',
    '.OYYO.',
    '..OO..',
  ],
  carrot: [
    '...GG.',
    '..GGG.',
    '.OOOO.',
    'OORROO',
    '.ORRO.',
    '..OO..',
  ],
  strawberry: [
    '..GG..',
    '.ORRO.',
    'ORWRRO',
    'ORRRWO',
    '.ORRO.',
    '..OO..',
  ],
  cheese: [
    '..OOO.',
    '.OYYYO',
    'OYOYYO',
    'OYYYYO',
    'OOOOOO',
    '......',
  ],
};

const FOOD_COLORS = {
  O: '#3b2416',
  Y: '#ffd166',
  B: '#5c4033',
  G: '#2ecc71',
  R: '#ff5c77',
  W: '#fff3b0',
};

export function drawFoodSprite(ctx, type, x, y, scale = 2) {
  const sprite = FOOD_SPRITES[type] || FOOD_SPRITES.seed;
  const startX = Math.round(x - (sprite[0].length * scale) / 2);
  const startY = Math.round(y - sprite.length * scale);
  for (let r = 0; r < sprite.length; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      const ch = sprite[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = FOOD_COLORS[ch] || '#ffd166';
      ctx.fillRect(startX + c * scale, startY + r * scale, scale, scale);
    }
  }
}

export function drawHeart(ctx, x, y, scale = 2, color = '#ff5c8a') {
  const mat = [
    '.OO.OO.',
    'ORRORRO',
    'ORRRRRO',
    '.ORRRO.',
    '..ORO..',
    '...O...',
  ];
  const sx = Math.round(x - (7 * scale) / 2);
  const sy = Math.round(y - (6 * scale) / 2);
  for (let r = 0; r < mat.length; r++) {
    for (let c = 0; c < mat[r].length; c++) {
      const ch = mat[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'O' ? '#3b2416' : color;
      ctx.fillRect(sx + c * scale, sy + r * scale, scale, scale);
    }
  }
}

const ACCESSORY_SPRITES = {
  ribbon: {
    yOffset: -33,
    mat: [
      '.OO...OO.',
      'OPPOOOPPO',
      'OPPPWPPPO',
      '.OOOPOOO.',
    ],
  },
  crown: {
    yOffset: -36,
    mat: [
      'O..OOO..O',
      'OYOYYYO.O',
      'OYYYYYYYO',
      'OYYRYYRYO',
      'OOOOOOOOO',
    ],
  },
  leaf: {
    yOffset: -36,
    mat: [
      '...GGG...',
      '..GGGGGO.',
      '...OGG...',
      '....O....',
    ],
  },
  glasses: {
    yOffset: -24,
    mat: [
      'OOOOO..OOOOO',
      'OKWKO..OKWKO',
      'OKKKOOOOOKKK',
      '.OOO....OOO.',
    ],
  },
  beanie: {
    yOffset: -38,
    mat: [
      '....OOO....',
      '...OWWWO...',
      '..OBBBBBO..',
      '.OBBBBBBBBO',
      '.ORRRRRRRRO',
      '.OOOOOOOOOO',
    ],
  },
  cap: {
    yOffset: -36,
    mat: [
      '..OOOOOO...',
      '.OCCCCCCOO.',
      'OCCCCCCCCCO',
      'OOOOOOCCCCO',
      '......OOOO.',
    ],
  },
  bunny: {
    yOffset: -42,
    mat: [
      '.OO.....OO.',
      'OWPO...OWPO',
      'OWPO...OWPO',
      'OWPO...OWPO',
      '.OO.OOO.OO.',
    ],
  },
  witch: {
    yOffset: -40,
    mat: [
      '.....OO....',
      '....OPPO...',
      '...OPPPPO..',
      '..OYYYYYYO.',
      'OOOOOOOOOOO',
    ],
  },
};

const ACC_COLORS = {
  O: '#2b1910',
  P: '#ff5c8a',
  W: '#ffd6e5',
  Y: '#ffd166',
  R: '#ff4d6d',
  G: '#38b000',
  K: '#1d1e2c',
  B: '#54a0ff',
  C: '#48dbfb',
};

export function drawAccessory(ctx, x, y, type, scale = 2) {
  if (!type || type === 'none') return;
  const spec = ACCESSORY_SPRITES[type];
  if (!spec) return;
  const mat = spec.mat;
  const startX = Math.round(x - (mat[0].length * scale) / 2);
  const startY = Math.round(y + spec.yOffset);
  for (let r = 0; r < mat.length; r++) {
    for (let c = 0; c < mat[r].length; c++) {
      const ch = mat[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ACC_COLORS[ch] || '#000';
      ctx.fillRect(startX + c * scale, startY + r * scale, scale, scale);
    }
  }
}
