/**
 * Tüm denge sayıları tek yerde. Oyun mantığı buradan okur; kod içinde sihirli sayı olmasın.
 * Değerler ilk tahmindir, simülasyon testleriyle ayarlanır.
 */
export const BALANCE = {
  time: {
    /** 1x hızda 1 gerçek saniyede geçen oyun dakikası (10 gerçek dakika = 1 gün). */
    minutesPerRealSecond: 2.4,
    speeds: [0, 1, 2, 4] as const,
    /** Oyun Pazartesi 06:00'da başlar. */
    startMinutes: 6 * 60,
    nightStartHour: 22,
    nightEndHour: 6,
    passOutHour: 2,
    /** Ofiste bu saatten sonra uyunabilir. */
    sleepFromHour: 20,
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
  /** Zorluk seviyeleri: başlangıç parası, haftalık yardım çarpanı, ihtiyaç artış çarpanı. */
  difficulty: {
    easy: { startMoney: 9000, aidMul: 1.3, needsMul: 0.8 },
    normal: { startMoney: 6000, aidMul: 1, needsMul: 1 },
    hard: { startMoney: 4000, aidMul: 0.8, needsMul: 1.2 },
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
    /** Seviye 1→2 ve 2→3 yükseltme bedelleri. */
    licenseUpgradeCosts: [4000, 12000] as const,
    /** Haftalık bina bakımı: maliyetin oranı. */
    upkeepRate: 0.01,
    startReputation: 20,
    deliveryFee: 10,
    /** Ofisten kredi: tek seferde bu kadar, haftalık faiz oranı (anaparaya eklenmez, her hafta kasadan düşer). */
    loan: { amount: 5000, weeklyInterest: 0.05 },
    /** İflas: kasa art arda bu kadar hafta −(haftalık maaş + tampon) altındaysa oyun biter. */
    bankruptcy: { weeks: 3, buffer: 1000 },
  },
  staff: {
    baseWage: { caretaker: 350, trainer: 500, vet: 650 } as const,
    maxStaff: 12,
    /** Ofis Sv3 (lisans 3) personel sınırı. */
    maxStaffTop: 16,
    candidatesPerDay: 3,
    /** Kare / oyun dakikası. */
    baseSpeed: 1.4,
    decisionIntervalMin: 2,
    taskMinutes: { feed: 15, water: 10, clean: 12, play: 25, train: 40, groom: 25, treat: 35 } as const,
    playBelow: 45,
    groomBelow: 45,
    treatBelow: 65,
    energyDrainWorking: 5,
    energyDrainIdle: 1.5,
    breakBelow: 25,
    breakBelowLazy: 40,
    restUntil: 80,
    restRegenRoom: 25,
    restRegenOutside: 10,
    quitAfterUnpaidWeeks: 2,
    /** Mutfak hazırsa yem/su görev süresi çarpanı. */
    kitchenPrepMul: 0.6,
    /** Eğitim kursu: ücret ve süre (gün); dönüşte en az bir seviye. */
    course: { cost: 800, days: 1 },
    /** Gönüllü: Cuma başvurur (weekday 4), maaşsız, yalnız hafta sonu, verim düşük, 2 maaş günü sonra ayrılır. */
    volunteer: { weeks: 2, efficiencyMul: 0.6, reputationGain: 1, offerWeekday: 4 },
    /** Deneyim: görev başına xp; seviye eşiği xpPerLevel × seviye. */
    progress: { xpPerTask: 10, xpPerLevel: 100, maxLevel: 5, levelUpMorale: 5 },
    /** Moral (0-100): saatlik değişimler, düşük moral cezası ve istifa. */
    morale: {
      start: 70,
      tiredBelowEnergy: 20,
      tiredLoss: 3,
      restRoomGain: 4,
      restGain: 1,
      offDutyGain: 1,
      workGain: 0.5,
      /** Görevdeki personel başına sahipsiz görev bundan fazlaysa iş yükü cezası. */
      overloadPerStaff: 3,
      overloadLoss: 2,
      unpaidLoss: 15,
      lowBelow: 30,
      lowEfficiencyMul: 0.8,
      quitBelow: 10,
      quitAfterDays: 3,
    },
    /**
     * Personel tuvaleti (0.16.2): vardiyada ihtiyaç saatte perHour artar, goAbove'da en yakın hazır Personel WC'ye gider
     * (minutes dk). WC yoksa penaltyAbove üstünde saatlik moral kaybı ve verim çarpanı. 10 saatlik vardiyada WC'siz
     * ~2,5 saat ceza (plandaki 9/saat 10 saatte 90'a hiç ulaşmıyordu).
     */
    toilet: {
      perHour: 12,
      goAbove: 70,
      minutes: 8,
      penaltyAbove: 90,
      moraleLossPerHour: 4,
      /** Sıkışma morali bunun altına indirmez: verim düşer (lowBelow altı) ama yalnız WC yüzünden istifa olmaz. */
      moraleFloor: 25,
      efficiencyMul: 0.9,
    },
    /** Dinlenme odası eşyaları (0.16.3): içerideki panodan alınır; etkiler yalnız o odada molada olanlara. */
    rest: {
      furniture: {
        sofa: { cost: 300, max: 2 },
        coffee: { cost: 250, max: 1 },
        tv: { cost: 400, max: 1 },
        fridge: { cost: 200, max: 1 },
      },
      seatsPerSofa: 2,
      /** Kanepede oturanın mola yenilenmesi çarpanı eki (+%25). */
      sofaRegenBonus: 0.25,
      coffeeMoralePerHour: 2,
      tvMoralePerHour: 1,
      /** Buzdolabı: moladan enerji bu değere dolunca dönülür (yoksa restUntil). */
      fridgeRestUntil: 100,
    },
  },
  adoption: {
    dailyBase: 0.6,
    dailyMax: 3,
    arriveFromHour: 10,
    arriveToHour: 16,
    patienceMinutes: 150,
    walkSpeed: 1.6,
    feeBase: 150,
    feePerPreference: 90,
    feeMax: 900,
    minHealth: 60,
    minHygiene: 40,
    minLoyalty: 30,
    repGood: 4,
    repOk: 1,
    repBad: 3,
    repLeaveUnserved: 1,
    repReturn: 3,
    returnChanceBadMatch: 0.2,
    returnAfterDays: 3,
  },
  /** Dekor puanı: çiçek/bank/tabela/lamba toplamı (tavanlı); sahiplenici sabrı, geliş sıklığı ve denetime etki eder. */
  decor: {
    points: { flower: 1, bench: 3, sign: 5, lamp: 0.5 } as const,
    /** Sadece bir tabela sayılır. */
    maxSigns: 1,
    max: 20,
    /** Puan başına sahiplenici sabrı (dakika). */
    patiencePerPoint: 2,
    /** Puan başına günlük beklenen sahiplenici artışı. */
    adoptersPerPoint: 1 / 40,
  },
  shelter: {
    startFoodPortions: 30,
    startBowlFood: 2,
    /** Yalak su kapasitesi (birim); köpek başına içim 10. */
    troughCapacity: 100,
    /** Mutfak varsa yalaklar saatte bu kadar kendiliğinden dolar. */
    kitchenWaterPerHour: 15,
  },
  dogs: {
    growth: { youngAtWeek: 4, adultAtWeek: 12, seniorAtWeek: 52 },
    senior: { healthDecayMul: 1.3, healthRegenMul: 0.5, playDecayMul: 0.7, speedMul: 0.8 },
    /** Kare / oyun dakikası. */
    baseSpeed: 1.1,
    portionBySize: { S: 1, M: 1.5, L: 2 } as const,
    portionByStage: { puppy: 0.5, young: 0.8, adult: 1, senior: 0.9 } as const,
    sickBelowHealth: 40,
    needs: {
      hungerPerHour: 5,
      hungerPerHourPuppy: 7,
      hungerPerHourLarge: 5.5,
      thirstPerHour: 8,
      thirstAfterPlay: 10,
      thirstHarmAbove: 85,
      thirstHarmPerHour: 2,
      playDecayPerHour: 4,
      playYardGainPerHour: 2,
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
    drinkAboveThirst: 55,
    drinkDurationMin: 3,
    drinkRelief: 70,
    drinkWaterUse: 10,
    bladderAfterMeal: 15,
    toiletAboveBladder: 85,
    toiletDurationMin: 2,
    /** Mesane doluysa ve enerji bunun üstündeyse köpek gece tuvalet için uyanır. */
    wakeForToiletEnergyAbove: 20,
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
    washDurationMin: 30,
    treatHealthGain: 40,
    treatDurationMin: 40,
    trainingZoneBonus: 1.25,
    obstacleBonus: 0.05,
    stationRadius: 2.6,
    /** Köpek-köpek etkileşimi: dost oyunu, hırlaşma, havlama. */
    social: {
      /** Bu keyfin altındaki köpek oyun arkadaşı arar. */
      seekBelowPlay: 50,
      /** Eş olabilmek için keyif bunun altında olmalı. */
      partnerBelowPlay: 60,
      radius: 8,
      /** Oyun bahçesi bu kadar yakınsa buluşma orada olur. */
      yardRadius: 10,
      meetTimeoutMin: 4,
      durationMin: 20,
      playGain: 25,
      energyCost: 6,
      affinityGain: 5,
      socialSkillGain: 2,
      playfulInitiateMul: 1.3,
      /** Çekingen köpek ancak bu dostluk puanının üstündeki köpekle oyun başlatır. */
      shyMinAffinity: 20,
      compat: { playful: 1.0, calm: 0.8, bold: 0.9, shy: 0.7 } as const,
      growlChanceBoldBold: 0.2,
      growlAffinity: -8,
      growlPlayLoss: 5,
      growlDurationMin: 2,
      /** Hırlaşma uyarısı bu kadar dakika kalır. */
      growlAlertMin: 60,
      barkChance: 0.3,
      barkDurationMin: 3,
      barkPlayBelow: 30,
      barkHungerAbove: 85,
    },
    /** Huyun davranışa etkisi. */
    temperament: {
      /** Çekingen: bu sadakatin altında sevme kazancı yarım, üstünde bir buçuk kat. */
      shyTrustAt: 40,
      shyPetMulBelow: 0.5,
      shyPetMulAbove: 1.5,
      /** Çekingen köpek bu sadakatin altında insan bitişiğine gelince kaçar. */
      shyFleeLoyaltyBelow: 50,
      shyFleeTriggerDistance: 1.4,
      shyFleeDistance: 2.5,
      shyFleeCooldownMin: 5,
      boldEscapeMul: 1.5,
      boldTameTreats: 2,
      boldWanderRadius: 10,
      wanderRadius: 6,
      playfulSelfPlayBelow: 50,
      calmLieMul: 1.5,
    },
    /** Hastalıklar: günlük başlangıç zarları, saatlik bulaşma, etkiler. */
    illness: {
      fleaHygieneBelow: 25,
      fleaChance: 0.05,
      /** Kulübesiz + kış/yağmur/kar. */
      coldChance: 0.08,
      stomachMessAbove: 3,
      stomachChance: 0.04,
      spreadRadius: 2,
      spreadPerHour: { flea: 0.03, cold: 0.02, stomach: 0 } as const,
      fleaHygienePerHour: 3,
      coldEnergyDrainMul: 1.4,
      stomachBladderPerHour: 5,
      /** Tedavi edilmezse bu kadar günde kendiliğinden geçer. */
      selfHealDays: 7,
    },
    /** Öğrenilen becerilerin etkisi (100 olunca). */
    skills: {
      /** "Otur": oyuncu bu kadar saniye bitişik durunca köpek oturur. */
      sitNearSeconds: 2,
      sitNearDistance: 1.4,
      sitMinutes: 1,
      sitMatchBonus: 3,
      /** İstekten fazla her öğrenilmiş beceri için eşleşme puanı ve tavanı. */
      extraSkillBonus: 2,
      extraSkillBonusMax: 6,
      /** "Gel": çağır aracının yarıçapı (kare). */
      callRadius: 12,
      /** "Tasma": gezinti dönüşünde kazanımlar. */
      walk: { playGain: 40, loyaltyGain: 5, hygieneLoss: 10, energyCost: 15 },
    },
  },
  /** Soy (M14): kalıtımda mutasyon ve nadirlik yükselme olasılıkları. */
  breeding: {
    mutation: 0.1,
    rarityUp: 0.15,
    /** Yuva evi: tam ve uygun çift bu kadar günde bir yumurta verir. */
    days: 5,
    /** Yumurtadan sonra iki köpeğin dinlenme süresi (hafta). */
    cooldownWeeks: 4,
    minHealth: 70,
    /** Karşılıklı dostluk (iki yönün küçüğü) en az. */
    minAffinity: 60,
  },
  eggs: {
    hatchDays: 3,
    nestRespawnDays: 2,
    treatsPerBush: 2,
    treatsMax: 10,
    bushRegrowDays: 1.5,
    /** Sokak köpeğini evcilleştirmek için gereken ödül sayısı. */
    tameTreats: 3,
    strayDens: 6,
    strayMinDistFromPlot: 28,
    strayMinDistBetween: 30,
    /** Peşinden gelen köpek bu kadar uzak kalırsa oyuncunun yanına ışınlanır. */
    followCatchUpDistance: 10,
  },
  exploration: {
    revealRadius: 9,
  },
  seasons: {
    weeksPerSeason: 2,
  },
  weather: {
    summerHygieneMul: 1.25,
    summerThirstMul: 1.5,
    winterHungerMul: 1.15,
    winterEnergyMul: 1.15,
    /** Kulübesiz köpeklere soğuk gecelerde saatlik sağlık kaybı. */
    coldDamagePerHour: 2,
    springNestMul: 0.7,
    autumnBerryBonus: 1,
    rainHygieneMul: 1.5,
    stormHygieneMul: 1.8,
    snowEnergyMul: 1.25,
    rainAdopterMul: 0.6,
    stormAdopterMul: 0.3,
    snowAdopterMul: 0.7,
  },
  events: {
    newspaperChance: 0.03,
    inspectionChance: 0.08,
    donationChance: 0.04,
    discountChance: 0.06,
    vetChance: 0.05,
    escapeChancePerDog: 0.03,
    escapeLoyaltyBelow: 25,
    escapeDays: 3,
    inspectionBonusPerDog: 60,
    inspectionFine: 200,
  },
  /** Tuvalet alanı: alandaki pislik "kapsanır" (MessSystem). */
  toilet: {
    /** Bu kadar pislikten sonra alan dolu sayılır. */
    capacity: 6,
    /** Dolmamış alandaki pisliğin denetim/hastalık ağırlığı. */
    containedInspectionMul: 0.25,
    /** Çöp kutusu bu kadar kare içindeyse (Chebyshev) alanı destekler. */
    binRadius: 6,
    binCapacityBonus: 4,
    /** Çöp kutusuna yakın temizlik görevlerinin süre çarpanı. */
    binCleanMul: 0.7,
    /** Personel aciliyeti: kapsanan pislik düşük, alan dolunca yüksek. */
    staffUrgencyBase: 0.2,
    staffUrgencyPerMess: 0.05,
    staffUrgencyFull: 0.6,
  },
  /** Otomatik çit kapısı (GateSystem). */
  gates: {
    /** İzinli aktör kapı karesinin merkezine bu kadar yaklaşınca açılır (kare). */
    openRadius: 1.6,
    /** Kimse kalmayınca bu kadar saniye sonra kapanır. */
    closeDelaySec: 1.0,
  },
  /** Dokunma girdisi (WorldScene). */
  touch: {
    /** Bu süredir olay üretmeyen "basılı" işaretçi bayat sayılır; pinch'i tetiklemez (kaçan touchend koruması). */
    stalePointerMs: 3000,
    /** Dokunmada tap sayılmak için basış noktasından en çok kayma (CSS pikseli; sahnede DPR ile çarpılır). */
    tapSlopPx: 8,
    /** Farede aynı eşik (tuval pikseli). */
    mouseSlopPx: 3,
    /** Uzun basış (köpek seçimi) süresi. */
    longPressMs: 450,
    /** Dokunuş köpeğe bu kadar yakınsa (kare) köpek aday olur. */
    dogSnapTiles: 1.1,
    /** Bu kadar yakınsa dokunuş doğrudan köpeğin üstüdür: oyuncu dibinde olsa da köpeğe gider. */
    dogDirectTiles: 0.5,
  },
  /** Dokun-git: oyuncu yol takibi (PlayerNav). */
  nav: {
    plotMaxNodes: 4000,
    maxNodes: 30000,
    /** Sıradaki kareye bu kadar yaklaşınca geçildi sayılır. */
    arriveDist: 0.22,
    axisDead: 0.08,
    /** Köpek hedefte bundan uzaksa yeniden yaklaşılır. */
    reachDist: 1.7,
    stuckSeconds: 0.6,
    maxReplans: 2,
  },
  /** Otomatik yem makinesi (FeederSystem): saat başı menzildeki kaplara kilerden porsiyon. */
  feeder: {
    radius: 8,
    feedPerHour: 2,
    /** Menzildeki kabın yem görevi aciliyet çarpanı. */
    taskUrgencyMul: 0.5,
  },
  /** Satın alınan yükseltmeler (bina yükseltmeleri content/buildings.ts `upgrade` alanında). */
  upgrades: {
    /** Büyük çanta: ofisten alınır. */
    backpack: { cost: 1500, slots: 6 },
  },
  /** Zafer "Yılın Barınağı": iki eşik birlikte sağlanınca bir kez (oyun sürer). */
  victory: {
    adoptions: 50,
    reputation: 90,
  },
  /** Oyuncu otopilotu (Autopilot.ts). Süreler gerçek saniye. */
  autopilot: {
    /** Boştayken görev tahtasına bu aralıkla bakılır. */
    idleRecheckSec: 3,
    /** Ulaşılamayan/başarısız hedef bu süre yeniden denenmez. */
    failCooldownSec: 30,
    /** Yem siparişinden sonra bekleme. */
    orderWaitSec: 10,
    /** Keşfedilmiş yumurtalı yuva bu kadar kare içindeyse gidilir. */
    nestRadius: 40,
    /** Keşfedilmiş böğürtlen çalısı bu kadar kare içindeyse gidilir. */
    bushRadius: 25,
    /** Koşu: dayanıklılık bunun üstünde ve kalan yol runMinTiles'tan uzunsa başlar... */
    runAboveStamina: 60,
    /** ...bunun altına inince yürümeye döner (histerezis). */
    runStopStamina: 40,
    runMinTiles: 6,
  },
  /** Dünya üstü balonların eşikleri (Emotes.ts). */
  emotes: {
    hungerAbove: 70,
    thirstAbove: 70,
    bladderAbove: 85,
    playBelow: 30,
  },
  camera: {
    avatarZoom: 3,
    manageZoom: 1.5,
    /** Yatay telefon: daha geniş görüş. */
    phone: { avatarZoom: 2.5, manageZoom: 1.25 },
    minZoom: 1,
    maxZoom: 4,
    panSpeed: 600, // ekran pikseli / saniye (zoom'a bölünür)
  },
} as const;

export type Speed = (typeof BALANCE.time.speeds)[number];
