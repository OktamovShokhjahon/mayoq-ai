import type { Locale } from "./i18n";

/**
 * Interface copy for the deep-analysis panel. Held apart from the console
 * dictionaries for the same reason as the marketing copy: it is one feature's
 * worth of prose, and a `Record<Locale, …>` still makes a missing language a
 * build error. The report's own content (headline, reasoning) is written by the
 * API in the language the page asks for.
 */
export interface DeepCopy {
  eyebrow: string;
  title: string;
  intro: { doctor: string; patient: string };
  scope: string[];
  run: string;
  rerun: string;
  estimate: string;
  stages: string[];
  errorTitle: string;
  retry: string;
  coverage: {
    readings: string;
    diagnoses: string;
    medications: string;
    drugLabels: string;
    sources: string;
    excluded: string;
  };
  excludedHint: string;
  twinTitle: string;
  twinHint: string;
  organsTitle: string;
  ruleAssessed: string;
  watchByTrend: string;
  notAssessed: string;
  missing: string;
  trendsTitle: string;
  target: string;
  today: string;
  projection: string;
  expected: string;
  band: string;
  measured: string;
  daysToTarget: string;
  direction: { improving: string; worsening: string; stable: string };
  atTarget: string;
  offTarget: string;
  prognosisTitle: string;
  day: string;
  chainTitle: string;
  chainHint: string;
  literatureTitle: string;
  literatureNone: string;
  sourcesLabel: string;
  queriesLabel: string;
  drugsTitle: string;
  considerationsTitle: string;
  notesTitle: string;
  missingTitle: string;
  rulesOnly: string;
  generated: string;
  disclaimer: string;
  sourceModel: string;
  sourceRules: string;
}

const en: DeepCopy = {
  eyebrow: "Deep analysis",
  title: "Read the whole record, then check it against the evidence",
  intro: {
    doctor:
      "Searches everything held on this patient, runs the clinical rules, fits each trend, reads drug labels and looks up current guidelines. Every step is graded, so you can tell a measurement from a search result.",
    patient:
      "Looks at all of your confirmed results, shows where each one is heading and explains what guidelines say. It does not change any treatment: that stays with your doctor.",
  },
  scope: ["Every verified result", "Clinical rules", "Drug labels", "Guidelines and literature"],
  run: "Run deep analysis",
  rerun: "Run again",
  estimate: "Usually 15 to 40 seconds",
  stages: [
    "Reading the verified record",
    "Fitting trends and projections",
    "Checking drug labels",
    "Searching guidelines and literature",
    "Writing the reasoning",
  ],
  errorTitle: "The analysis did not finish",
  retry: "Try again",
  coverage: {
    readings: "Readings",
    diagnoses: "Diagnoses",
    medications: "Medications",
    drugLabels: "Drug labels",
    sources: "Literature sources",
    excluded: "Left out",
  },
  excludedHint: "Unconfirmed AI extractions are not used until a doctor confirms them.",
  twinTitle: "Where it shows",
  twinHint: "Choose an organ or a reasoning step to highlight it.",
  organsTitle: "Organs",
  ruleAssessed: "Assessed by rule",
  watchByTrend: "Worth watching",
  notAssessed: "Not assessed",
  missing: "Missing",
  trendsTitle: "Trends and projections",
  target: "Target",
  today: "Latest",
  projection: "Projection",
  expected: "Expected",
  band: "Likely range",
  measured: "Measured",
  daysToTarget: "Reaches target in about {n} days",
  direction: { improving: "Improving", worsening: "Worsening", stable: "Stable" },
  atTarget: "Within target",
  offTarget: "Off target",
  prognosisTitle: "Prognosis over 90 days",
  day: "Day",
  chainTitle: "How the conclusion was reached",
  chainHint: "From the record to the conclusion. Each step says how much weight it deserves.",
  literatureTitle: "Guidelines and literature",
  literatureNone: "No literature brief was produced.",
  sourcesLabel: "Sources",
  queriesLabel: "Searches run",
  drugsTitle: "Drug labels",
  considerationsTitle: "For the physician to weigh",
  notesTitle: "Things that can help",
  missingTitle: "Missing data",
  rulesOnly: "The AI service was unavailable. This page shows the rule and trend results without written reasoning.",
  generated: "Generated",
  disclaimer:
    "Decision support, not a diagnosis. Projections extend past readings and stop being reliable when treatment changes. A physician confirms every conclusion.",
  sourceModel: "Written by AI",
  sourceRules: "From the rules",
};

const uz: DeepCopy = {
  eyebrow: "Chuqur tahlil",
  title: "Butun yozuvni o'qing va dalillar bilan solishtiring",
  intro: {
    doctor:
      "Bemor haqidagi barcha ma'lumotni qidiradi, klinik qoidalarni ishga tushiradi, har bir dinamikani hisoblaydi, dori yorliqlarini o'qiydi va zamonaviy qo'llanmalarni topadi. Har qadam baholanadi, shuning uchun o'lchovni qidiruv natijasidan farqlash mumkin.",
    patient:
      "Tasdiqlangan barcha natijalaringizni ko'radi, har biri qayoqqa ketayotganini ko'rsatadi va qo'llanmalar nima deyishini tushuntiradi. Davolashni o'zgartirmaydi: bu shifokoringizning ishi.",
  },
  scope: ["Barcha tasdiqlangan natijalar", "Klinik qoidalar", "Dori yorliqlari", "Qo'llanma va adabiyot"],
  run: "Chuqur tahlilni boshlash",
  rerun: "Qayta ishga tushirish",
  estimate: "Odatda 15 dan 40 soniyagacha",
  stages: [
    "Tasdiqlangan yozuv o'qilmoqda",
    "Dinamika va prognoz hisoblanmoqda",
    "Dori yorliqlari tekshirilmoqda",
    "Qo'llanma va adabiyot qidirilmoqda",
    "Xulosa yozilmoqda",
  ],
  errorTitle: "Tahlil yakunlanmadi",
  retry: "Qayta urinish",
  coverage: {
    readings: "O'lchovlar",
    diagnoses: "Tashxislar",
    medications: "Dorilar",
    drugLabels: "Dori yorliqlari",
    sources: "Adabiyot manbalari",
    excluded: "Chetda qoldi",
  },
  excludedHint: "Tasdiqlanmagan sun'iy intellekt natijalari shifokor tasdiqlamaguncha ishlatilmaydi.",
  twinTitle: "Qayerda ko'rinadi",
  twinHint: "Ajratib ko'rsatish uchun organ yoki xulosa qadamini tanlang.",
  organsTitle: "Organlar",
  ruleAssessed: "Qoida bilan baholangan",
  watchByTrend: "Kuzatishga arziydi",
  notAssessed: "Baholanmagan",
  missing: "Yetishmaydi",
  trendsTitle: "Dinamika va prognoz",
  target: "Maqsad",
  today: "Oxirgi",
  projection: "Prognoz",
  expected: "Kutilgan",
  band: "Ehtimoliy oraliq",
  measured: "O'lchangan",
  daysToTarget: "Maqsadga taxminan {n} kunda yetadi",
  direction: { improving: "Yaxshilanmoqda", worsening: "Yomonlashmoqda", stable: "Barqaror" },
  atTarget: "Maqsad doirasida",
  offTarget: "Maqsaddan tashqarida",
  prognosisTitle: "90 kunlik prognoz",
  day: "Kun",
  chainTitle: "Xulosaga qanday kelindi",
  chainHint: "Yozuvdan xulosagacha. Har qadam qanchalik ishonchli ekanini aytadi.",
  literatureTitle: "Qo'llanma va adabiyot",
  literatureNone: "Adabiyot sharhi tayyorlanmadi.",
  sourcesLabel: "Manbalar",
  queriesLabel: "Bajarilgan qidiruvlar",
  drugsTitle: "Dori yorliqlari",
  considerationsTitle: "Shifokor o'ylab ko'rishi uchun",
  notesTitle: "Yordam berishi mumkin",
  missingTitle: "Yetishmayotgan ma'lumot",
  rulesOnly: "AI xizmati mavjud emas edi. Bu sahifada yozma izohsiz qoida va dinamika natijalari ko'rsatilgan.",
  generated: "Tayyorlangan",
  disclaimer:
    "Qaror qo'llab-quvvatlash, tashxis emas. Prognoz avvalgi o'lchovlarni davom ettiradi va davolash o'zgarganda ishonchsiz bo'lib qoladi. Har bir xulosani shifokor tasdiqlaydi.",
  sourceModel: "AI yozgan",
  sourceRules: "Qoidalardan",
};

const ru: DeepCopy = {
  eyebrow: "Глубокий анализ",
  title: "Прочитать всю карту и сверить её с доказательствами",
  intro: {
    doctor:
      "Просматривает всё, что известно о пациенте, запускает клинические правила, считает каждую динамику, читает инструкции к препаратам и ищет актуальные рекомендации. Каждый шаг оценён, поэтому измерение легко отличить от результата поиска.",
    patient:
      "Смотрит все ваши подтверждённые результаты, показывает, куда движется каждый, и объясняет, что говорят рекомендации. Лечение не меняет: это остаётся за вашим врачом.",
  },
  scope: ["Все подтверждённые результаты", "Клинические правила", "Инструкции к препаратам", "Рекомендации и литература"],
  run: "Запустить глубокий анализ",
  rerun: "Запустить снова",
  estimate: "Обычно 15–40 секунд",
  stages: [
    "Чтение подтверждённой карты",
    "Расчёт динамики и прогноза",
    "Проверка инструкций к препаратам",
    "Поиск рекомендаций и литературы",
    "Написание выводов",
  ],
  errorTitle: "Анализ не завершился",
  retry: "Повторить",
  coverage: {
    readings: "Измерения",
    diagnoses: "Диагнозы",
    medications: "Лекарства",
    drugLabels: "Инструкции",
    sources: "Источники литературы",
    excluded: "Не учтено",
  },
  excludedHint: "Неподтверждённые извлечения ИИ не используются, пока врач их не подтвердит.",
  twinTitle: "Где это видно",
  twinHint: "Выберите орган или шаг рассуждения, чтобы выделить его.",
  organsTitle: "Органы",
  ruleAssessed: "Оценено правилом",
  watchByTrend: "Стоит наблюдать",
  notAssessed: "Не оценено",
  missing: "Не хватает",
  trendsTitle: "Динамика и прогнозы",
  target: "Цель",
  today: "Последнее",
  projection: "Прогноз",
  expected: "Ожидаемое",
  band: "Вероятный диапазон",
  measured: "Измерено",
  daysToTarget: "Достигнет цели примерно через {n} дн.",
  direction: { improving: "Улучшается", worsening: "Ухудшается", stable: "Стабильно" },
  atTarget: "В пределах цели",
  offTarget: "Вне цели",
  prognosisTitle: "Прогноз на 90 дней",
  day: "День",
  chainTitle: "Как получен вывод",
  chainHint: "От карты к выводу. Каждый шаг показывает, какого доверия он заслуживает.",
  literatureTitle: "Рекомендации и литература",
  literatureNone: "Обзор литературы не был составлен.",
  sourcesLabel: "Источники",
  queriesLabel: "Выполненные запросы",
  drugsTitle: "Инструкции к препаратам",
  considerationsTitle: "Врачу на рассмотрение",
  notesTitle: "Что может помочь",
  missingTitle: "Недостающие данные",
  rulesOnly: "Сервис ИИ был недоступен. Страница показывает результаты правил и динамики без написанных выводов.",
  generated: "Сформировано",
  disclaimer:
    "Поддержка решений, не диагноз. Прогноз продолжает прошлые измерения и перестаёт быть надёжным при смене лечения. Каждый вывод подтверждает врач.",
  sourceModel: "Написано ИИ",
  sourceRules: "Из правил",
};

export const DEEP_COPY: Record<Locale, DeepCopy> = { uz, en, ru };
