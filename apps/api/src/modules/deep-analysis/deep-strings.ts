/**
 * The sentences the deep-analysis report composes itself, in every language the
 * console speaks.
 *
 * These live on the server rather than travelling as message keys, unlike the
 * rule and prevention catalogs: a deep report is built fresh for each request
 * and its cache key already includes the language, so there is nothing stored
 * that would have to be re-rendered after a language switch. Composing here
 * also keeps the grammar together — several of these sentences change shape
 * around a count or a direction, and that is not something a placeholder in a
 * dictionary can do well.
 *
 * The model-written parts of the report (headline, reasoning, prognosis) are
 * written in the requested language by the prompt. What is below is the
 * deterministic half: the reasoning chain, and the wording used when the model
 * is unreachable.
 */

export type DeepLanguage = "en" | "uz" | "ru";

export interface DeepStrings {
  /** Trend measures. Abbreviations that read the same everywhere stay put. */
  measure: Record<string, string>;
  chain: {
    verifiedRecord: string;
    record(readings: number, measurements: number): string;
    excluded(count: number): string;
    trendTitle(label: string, direction?: string): string;
    trendMoved(label: string, from: string, to: string, unit: string, count: number): string;
    trendSingle(label: string, value: string, unit: string): string;
    trendTarget(better: "lower" | "higher", target: string, atTarget: boolean): string;
    trendSlope(per30d: string): string;
    forecastTitle(label: string, days: number): string;
    forecastDetail(expected: string, unit: string, low: string, high: string): string;
    forecastReaches(days: number): string;
    forecastNeverReaches: string;
    ruleTitle(organ: string, color: string): string;
    ruleRead(values: string): string;
    literatureTitle: string;
    literatureDetail: string;
    conclusionTitle: string;
  };
  direction: Record<"improving" | "worsening" | "stable", string>;
  /** Wording used whole when the model is unreachable. */
  rules: {
    organsFlagged(count: number): string;
    worsening(labels: string): string;
    improving(labels: string): string;
    nothingFlagged: string;
    noForecast: string;
    prognosisLine(label: string, expected: string, unit: string, day: number, low: string, high: string): string;
  };
  organReason(label: string, value: string, unit: string, offTarget?: string, direction?: string): string;
  /** Caveats the trend fit attaches to a series. */
  caveat: {
    onePoint: string;
    twoPoints: string;
    sameDate: string;
    shortSpan(days: number, needed: number): string;
    fewReadings(count: number): string;
    underTwoMonths: string;
    tooShortForNinety: string;
    ninetyBeyondHistory: string;
  };
  noDiagnosisToSearch: string;
  disclaimer: string;
}

const en: DeepStrings = {
  measure: {
    latestHba1c: "HbA1c",
    latestEgfr: "eGFR",
    latestCreatinine: "Creatinine",
    latestAlt: "ALT",
    latestAst: "AST",
    latestSystolicBp: "Systolic BP",
  },
  chain: {
    verifiedRecord: "Verified record",
    record: (readings, measurements) =>
      `${readings} verified reading${readings === 1 ? "" : "s"} across ${measurements} measurement${measurements === 1 ? "" : "s"}.`,
    excluded: (count) =>
      ` ${count} AI-extracted or rejected value${count === 1 ? " was" : "s were"} left out until a doctor confirms.`,
    trendTitle: (label, direction) => `${label} ${direction ?? "recorded"}`,
    trendMoved: (label, from, to, unit, count) => `${label} moved from ${from} to ${to} ${unit} across ${count} readings.`,
    trendSingle: (label, value, unit) => `${label} is ${value} ${unit} (one reading).`,
    trendTarget: (better, target, atTarget) =>
      ` Target ${better === "lower" ? "≤" : "≥"} ${target}: ${atTarget ? "within it." : "not yet within it."}`,
    trendSlope: (per30d) => ` Fitted change ${per30d} per 30 days.`,
    forecastTitle: (label, days) => `${label} in ${days} days`,
    forecastDetail: (expected, unit, low, high) =>
      `If the recent slope continues: ${expected} ${unit} (band ${low}–${high}).`,
    forecastReaches: (days) => ` The line reaches the target in about ${days} days.`,
    forecastNeverReaches: " The line does not reach the target within a year.",
    ruleTitle: (organ, color) => `${organ} · ${color}`,
    ruleRead: (values) => ` Read: ${values}.`,
    literatureTitle: "Guidelines and literature",
    literatureDetail:
      "Current guidance found by web search for this profile. Read it as background, not as a finding about this patient.",
    conclusionTitle: "How it fits together",
  },
  direction: { improving: "improving", worsening: "worsening", stable: "stable" },
  rules: {
    organsFlagged: (count) => `${count} organ${count === 1 ? "" : "s"} flagged by the rules`,
    worsening: (labels) => `${labels} worsening`,
    improving: (labels) => `${labels} improving`,
    nothingFlagged: "No flagged organs and no clear trend in the verified record yet.",
    noForecast: "There are too few verified readings to project a course. Add results to draw a trend.",
    prognosisLine: (label, expected, unit, day, low, high) =>
      `${label}: ${expected} ${unit} by day ${day} (${low}–${high}) if the recent slope holds.`,
  },
  organReason: (label, value, unit, offTarget, direction) =>
    `${label} ${value} ${unit}` +
    (offTarget ? `, off the ${offTarget} target` : "") +
    (direction ? `, ${direction}` : ""),
  caveat: {
    onePoint: "Only one reading: there is no trend to read yet.",
    twoPoints: "Only two readings: a line fits any two points, so no forecast is drawn.",
    sameDate: "All readings share one date, so no trend can be read.",
    shortSpan: (days, needed) => `The readings cover only ${days} days; a forecast needs at least ${needed}.`,
    fewReadings: (count) => `Based on ${count} readings; more would narrow the band.`,
    underTwoMonths: "The readings span under two months.",
    tooShortForNinety: "The history is too short to project as far as 90 days, so the longer points are left out.",
    ninetyBeyondHistory: "The 90-day figure reaches further than the history behind it.",
  },
  noDiagnosisToSearch: "No diagnosis on record to search for.",
  disclaimer:
    "Decision support, not a diagnosis. Projections extend the patient's own past readings and stop being reliable when treatment changes. A physician confirms every conclusion.",
};

const uz: DeepStrings = {
  measure: {
    latestHba1c: "HbA1c",
    latestEgfr: "eGFR",
    latestCreatinine: "Kreatinin",
    latestAlt: "ALT",
    latestAst: "AST",
    latestSystolicBp: "Sistolik bosim",
  },
  chain: {
    verifiedRecord: "Tasdiqlangan yozuv",
    record: (readings, measurements) => `${measurements} ko'rsatkich bo'yicha ${readings} ta tasdiqlangan o'lchov.`,
    excluded: (count) =>
      ` Shifokor tasdiqlamaguncha AI ajratgan yoki rad etilgan ${count} ta qiymat hisobga olinmadi.`,
    trendTitle: (label, direction) => `${label} — ${direction ?? "qayd etilgan"}`,
    trendMoved: (label, from, to, unit, count) =>
      `${label} ${count} ta o'lchov davomida ${from} dan ${to} ${unit} gacha o'zgardi.`,
    trendSingle: (label, value, unit) => `${label} ${value} ${unit} (bitta o'lchov).`,
    trendTarget: (better, target, atTarget) =>
      ` Maqsad ${better === "lower" ? "≤" : "≥"} ${target}: ${atTarget ? "shu doirada." : "hali bu doirada emas."}`,
    trendSlope: (per30d) => ` 30 kunlik hisoblangan o'zgarish: ${per30d}.`,
    forecastTitle: (label, days) => `${label} — ${days} kundan keyin`,
    forecastDetail: (expected, unit, low, high) =>
      `Agar so'nggi sur'at davom etsa: ${expected} ${unit} (oraliq ${low}–${high}).`,
    forecastReaches: (days) => ` Chiziq maqsadga taxminan ${days} kunda yetadi.`,
    forecastNeverReaches: " Chiziq bir yil ichida maqsadga yetmaydi.",
    ruleTitle: (organ, color) => `${organ} · ${color}`,
    ruleRead: (values) => ` O'qildi: ${values}.`,
    literatureTitle: "Qo'llanma va adabiyot",
    literatureDetail:
      "Ushbu profil uchun veb-qidiruv topgan zamonaviy qo'llanmalar. Buni shu bemor haqidagi xulosa emas, balki umumiy ma'lumot sifatida o'qing.",
    conclusionTitle: "Bularning bog'lanishi",
  },
  direction: { improving: "yaxshilanmoqda", worsening: "yomonlashmoqda", stable: "barqaror" },
  rules: {
    organsFlagged: (count) => `Qoidalar ${count} ta organni belgiladi`,
    worsening: (labels) => `${labels} yomonlashmoqda`,
    improving: (labels) => `${labels} yaxshilanmoqda`,
    nothingFlagged: "Tasdiqlangan yozuvda belgilangan organ ham, aniq dinamika ham yo'q.",
    noForecast: "Prognoz chizish uchun tasdiqlangan o'lchovlar juda kam. Natijalar qo'shing.",
    prognosisLine: (label, expected, unit, day, low, high) =>
      `${label}: so'nggi sur'at saqlansa, ${day}-kunga ${expected} ${unit} (${low}–${high}).`,
  },
  organReason: (label, value, unit, offTarget, direction) =>
    `${label} ${value} ${unit}` +
    (offTarget ? `, ${offTarget} maqsadidan tashqarida` : "") +
    (direction ? `, ${direction}` : ""),
  caveat: {
    onePoint: "Faqat bitta o'lchov: hali dinamika yo'q.",
    twoPoints: "Faqat ikkita o'lchov: ikki nuqtadan istalgan chiziq o'tadi, shuning uchun prognoz chizilmadi.",
    sameDate: "Barcha o'lchovlar bir kunga tegishli, shuning uchun dinamikani o'qib bo'lmaydi.",
    shortSpan: (days, needed) => `O'lchovlar atigi ${days} kunni qamraydi; prognoz uchun kamida ${needed} kun kerak.`,
    fewReadings: (count) => `${count} ta o'lchovga asoslangan; ko'proq bo'lsa oraliq torayadi.`,
    underTwoMonths: "O'lchovlar ikki oydan kamroq davrni qamraydi.",
    tooShortForNinety: "Tarix 90 kunga prognoz qilish uchun juda qisqa, shuning uchun uzoq nuqtalar chiqarib tashlandi.",
    ninetyBeyondHistory: "90 kunlik raqam orqadagi tarixdan uzoqroqqa cho'ziladi.",
  },
  noDiagnosisToSearch: "Qidirish uchun yozuvda tashxis yo'q.",
  disclaimer:
    "Qaror qo'llab-quvvatlash, tashxis emas. Prognoz bemorning o'z o'lchovlarini davom ettiradi va davolash o'zgarganda ishonchsiz bo'lib qoladi. Har bir xulosani shifokor tasdiqlaydi.",
};

const ru: DeepStrings = {
  measure: {
    latestHba1c: "HbA1c",
    latestEgfr: "СКФ",
    latestCreatinine: "Креатинин",
    latestAlt: "АЛТ",
    latestAst: "АСТ",
    latestSystolicBp: "Систолическое АД",
  },
  chain: {
    verifiedRecord: "Подтверждённая карта",
    record: (readings, measurements) => `${readings} подтверждённых измерений по ${measurements} показателям.`,
    excluded: (count) => ` ${count} значений, извлечённых ИИ или отклонённых, не учтено до подтверждения врачом.`,
    trendTitle: (label, direction) => `${label} — ${direction ?? "записано"}`,
    trendMoved: (label, from, to, unit, count) =>
      `${label} изменился с ${from} до ${to} ${unit} за ${count} измерений.`,
    trendSingle: (label, value, unit) => `${label} — ${value} ${unit} (одно измерение).`,
    trendTarget: (better, target, atTarget) =>
      ` Цель ${better === "lower" ? "≤" : "≥"} ${target}: ${atTarget ? "в пределах." : "пока вне пределов."}`,
    trendSlope: (per30d) => ` Расчётное изменение ${per30d} за 30 дней.`,
    forecastTitle: (label, days) => `${label} через ${days} дн.`,
    forecastDetail: (expected, unit, low, high) =>
      `Если недавний темп сохранится: ${expected} ${unit} (диапазон ${low}–${high}).`,
    forecastReaches: (days) => ` Линия достигает цели примерно через ${days} дн.`,
    forecastNeverReaches: " Линия не достигает цели в течение года.",
    ruleTitle: (organ, color) => `${organ} · ${color}`,
    ruleRead: (values) => ` Прочитано: ${values}.`,
    literatureTitle: "Рекомендации и литература",
    literatureDetail:
      "Актуальные рекомендации, найденные веб-поиском для этого профиля. Читайте их как фон, а не как вывод об этом пациенте.",
    conclusionTitle: "Как это складывается",
  },
  direction: { improving: "улучшается", worsening: "ухудшается", stable: "стабильно" },
  rules: {
    organsFlagged: (count) => `Правила отметили органов: ${count}`,
    worsening: (labels) => `${labels} ухудшается`,
    improving: (labels) => `${labels} улучшается`,
    nothingFlagged: "В подтверждённой карте нет ни отмеченных органов, ни явной динамики.",
    noForecast: "Подтверждённых измерений слишком мало, чтобы построить прогноз. Добавьте результаты.",
    prognosisLine: (label, expected, unit, day, low, high) =>
      `${label}: ${expected} ${unit} к ${day}-му дню (${low}–${high}), если недавний темп сохранится.`,
  },
  organReason: (label, value, unit, offTarget, direction) =>
    `${label} ${value} ${unit}` +
    (offTarget ? `, вне цели ${offTarget}` : "") +
    (direction ? `, ${direction}` : ""),
  caveat: {
    onePoint: "Только одно измерение: динамики пока нет.",
    twoPoints: "Только два измерения: через две точки проходит любая прямая, поэтому прогноз не строится.",
    sameDate: "Все измерения сделаны в один день, поэтому динамику прочитать нельзя.",
    shortSpan: (days, needed) => `Измерения охватывают лишь ${days} дн.; для прогноза нужно не менее ${needed}.`,
    fewReadings: (count) => `Основано на ${count} измерениях; большее число сузило бы диапазон.`,
    underTwoMonths: "Измерения охватывают меньше двух месяцев.",
    tooShortForNinety: "История слишком коротка для прогноза на 90 дней, поэтому дальние точки опущены.",
    ninetyBeyondHistory: "Значение на 90 дней уходит дальше, чем история за ним.",
  },
  noDiagnosisToSearch: "В карте нет диагноза, по которому можно искать.",
  disclaimer:
    "Поддержка решений, не диагноз. Прогноз продолжает прошлые измерения самого пациента и перестаёт быть надёжным при смене лечения. Каждый вывод подтверждает врач.",
};

const STRINGS: Record<DeepLanguage, DeepStrings> = { en, uz, ru };

export function deepStrings(language?: string): DeepStrings {
  return STRINGS[(language ?? "en") as DeepLanguage] ?? en;
}
