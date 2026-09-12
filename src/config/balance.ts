/**
 * Tüm denge sayıları tek yerde. Oyun mantığı buradan okur; kod içinde sihirli sayı olmasın.
 * Değerler ilk tahmindir, simülasyon testleriyle ayarlanır.
 */
export const BALANCE = {
  time: {
    /** 1x hızda 1 gerçek saniyede geçen oyun dakikası (10 gerçek dakika = 1 gün). */
    minutesPerRealSecond: 2.4,
    speeds: [0, 1, 2, 4] as const,
    nightSkipSpeed: 12,
    /** Oyun Pazartesi 06:00'da başlar. */
    startMinutes: 6 * 60,
    nightStartHour: 22,
    nightEndHour: 6,
    passOutHour: 2,
    mealHours: [8, 18] as const,
    mealWindowMinutes: 60,
    weekTickHour: 6,
  },
  world: {
    width: 200,
    height: 200,
    /** Barınak arsası (kare). Merkezde, genişletilebilir. */
    plot: { x: 80, y: 84, w: 40, h: 32 },
    plotMaxW: 88,
    plotMaxH: 64,
    nestMinDistance: 12,
    nestTarget: 70,
  },
  player: {
    walkSpeed: 4.5, // kare/saniye
    runSpeed: 8,
    staminaMax: 100,
    staminaDrainPerSecond: 14,
    staminaRegenPerSecond: 10,
    backpackSlots: 3,
    /** Çarpışma kutusu (kare biriminde), ayak merkezine göre. */
    hitbox: { w: 0.6, h: 0.4 },
  },
  economy: {
    startMoney: 6000,
    currency: '₺',
    aidPerDogPerWeek: 150,
    aidMultiplierMin: 0.4,
    aidMultiplierMax: 1.5,
    foodBagPrice: 80,
    foodBagPortions: 20,
    treatmentPrice: 60,
    licenseCaps: [8, 20, 45] as const,
  },
  shelter: {
    startFoodPortions: 30,
    startBowlFood: 2,
  },
  dogs: {
    growth: { youngAtWeek: 4, adultAtWeek: 12 },
    /** Kare / oyun dakikası. */
    baseSpeed: 1.1,
    portionBySize: { S: 1, M: 1.5, L: 2 } as const,
    portionByStage: { puppy: 0.5, young: 0.8, adult: 1 } as const,
    sickBelowHealth: 40,
    needs: {
      hungerPerHour: 5,
      hungerPerHourPuppy: 7,
      hungerPerHourLarge: 5.5,
      playDecayPerHour: 4,
      bladderPerHour: 7,
      hygieneDecayPerHour: 1.0,
      hygieneMessPenalty: 8,
      energyRegenPerHour: 12,
      energyDecayPerHour: 3,
      healthDropHungerAbove: 85,
      healthDropHygieneBelow: 20,
      healthDropPerHour: 3,
      healthRegenPerHour: 2,
      loyaltyDecayPerDay: 1,
    },
    eatAboveHunger: 55,
    eatDurationMin: 10,
    mealHungerRelief: 60,
    bladderAfterMeal: 15,
    toiletAboveBladder: 85,
    toiletDurationMin: 2,
    sleepBelowEnergy: 15,
    selfPlayBelow: 35,
    selfPlayDurationMin: 20,
    selfPlayGain: 20,
    petLoyaltyGain: 2,
    petLoyaltyGainDiminished: 0.5,
    petsFullGainPerDay: 3,
    petDurationMin: 3,
    playGain: 35,
    playLoyaltyGain: 2,
    playEnergyCost: 10,
    playDurationMin: 30,
    playMinEnergy: 15,
    trainBaseGain: 8,
    trainIntelligenceGain: 3,
    trainLoyaltyGain: 0.1,
    trainEnergyCost: 8,
    trainDurationMin: 45,
    trainMinEnergy: 20,
    groomGain: 30,
    groomDurationMin: 20,
  },
  camera: {
    avatarZoom: 3,
    manageZoom: 1.5,
    minZoom: 1,
    maxZoom: 4,
    panSpeed: 600, // ekran pikseli / saniye (zoom'a bölünür)
  },
} as const;

export type Speed = (typeof BALANCE.time.speeds)[number];
