import { hex } from './Pixels';

/** Oyunun tamamında kullanılan sabit palet. Yeni renk eklerken buraya ekle, sprite içinde hex yazma. */
export const P = {
  outline: hex(0x24203a),

  grass: hex(0x62b24b),
  grassDark: hex(0x4f993c),
  grassLight: hex(0x80cf5e),
  plot: hex(0x8fd46a),
  plotStripe: hex(0x86c962),
  plotDark: hex(0x74b854),

  forestFloor: hex(0x468b3c),
  forestDark: hex(0x376f30),
  forestLeaf: hex(0x8b5a2b),

  leaf: hex(0x3f9d46),
  leafDark: hex(0x2c7534),
  leafLight: hex(0x72c65e),
  pine: hex(0x2f7f5c),
  pineDark: hex(0x205c42),
  pineLight: hex(0x52a878),
  trunk: hex(0x7e522d),
  trunkDark: hex(0x5b3a1f),
  trunkLight: hex(0x9b6a3c),

  sand: hex(0xe2d295),
  sandDark: hex(0xcdb977),
  sandLight: hex(0xf0e3b0),

  water: hex(0x3d7ec6),
  waterDark: hex(0x3069ab),
  waterLight: hex(0x6faae0),
  foam: hex(0xd9edf8),
  shallow: hex(0x66a9dc),
  shallowLight: hex(0x93c7ea),

  rock: hex(0x8f9196),
  rockDark: hex(0x62646a),
  rockLight: hex(0xbabcc1),
  rocky: hex(0x8f9c74),
  rockyDark: hex(0x76855d),
  rockyLight: hex(0xa6b28b),

  mountain: hex(0x5a5862),
  mountainDark: hex(0x3d3b46),
  mountainLight: hex(0x807e8a),

  swamp: hex(0x566443),
  swampDark: hex(0x3f4b30),
  swampWater: hex(0x4f6f62),
  reed: hex(0x6f8d3a),
  reedTuft: hex(0x9a6a3a),

  path: hex(0xbb9769),
  pathDark: hex(0x9e7d53),
  pathLight: hex(0xd1b283),
  plank: hex(0xa97540),
  plankDark: hex(0x7d5430),
  dirt: hex(0x9c7048),
  dirtDark: hex(0x7d5836),

  flowerPink: hex(0xf28fb8),
  flowerYellow: hex(0xf6d55c),
  flowerWhite: hex(0xf8f4ec),
  flowerRed: hex(0xe4514f),
  flowerBlue: hex(0x7aa6f0),
  berry: hex(0xd93b4c),

  twig: hex(0x94703f),
  twigDark: hex(0x6b4e2a),
  twigLight: hex(0xb08a52),
  eggBlue: hex(0xa3d5e9),
  eggPink: hex(0xf3b6cb),
  eggGreen: hex(0xc3e59d),
  eggYellow: hex(0xf6e4a3),
  eggSpot: hex(0x6d6a8a),

  skin: hex(0xf1c9a1),
  skinDark: hex(0xcf9e72),
  hair: hex(0x5c3b22),
  shirt: hex(0x3f82dc),
  shirtDark: hex(0x2e63ad),
  pants: hex(0x3b4664),
  pantsDark: hex(0x2c3449),
  shoes: hex(0x2c2535),
  eye: hex(0x24203a),
} as const;
