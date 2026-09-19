/**
 * Pre-recorded answers for a live demo when the model or its free-tier quota
 * is unavailable (spec §9.5). Used only when DEMO_AI_FALLBACK=true, and every
 * answer says so in its own text and carries the model id "demo-fallback" so a
 * viewer can never mistake it for live model output.
 *
 * Keyed by prompt name, then by the language the page asked for. A canned
 * answer in the wrong language is worse than none: it is the one paragraph on
 * screen that did not follow the language switch, which reads as a product
 * that is only half translated. Document extraction has no entry on purpose:
 * a canned list of facts would look like the contents of the uploaded file, so
 * that path keeps using the deterministic parser.
 */
export const DEMO_MODEL_ID = "demo-fallback (pre-recorded)";

type Language = "en" | "uz" | "ru";

/** Says what it is, in the language the rest of the answer is written in. */
const TAG: Record<Language, string> = {
  en: "[Demo · pre-recorded, not live AI] ",
  uz: "[Demo · oldindan yozilgan, jonli AI emas] ",
  ru: "[Демо · заранее записано, не живой ИИ] ",
};

const RESPONSES: Array<{ prefix: string; body: Record<Language, unknown> }> = [
  {
    prefix: "treatment-scenario-narrative",
    body: {
      en: {
        narrative:
          TAG.en +
          "The rule checks flag the organs shown in yellow or red for closer monitoring. Some recent laboratory values are missing, so this result is incomplete. Please review the listed evidence and the missing data before deciding.",
        confidence: "limited",
      },
      uz: {
        narrative:
          TAG.uz +
          "Qoida tekshiruvlari sariq yoki qizil ko'rsatilgan organlarni diqqat bilan kuzatishga belgiladi. Ba'zi so'nggi laboratoriya qiymatlari yo'q, shuning uchun bu natija to'liq emas. Qaror qabul qilishdan oldin keltirilgan dalillarni va yetishmayotgan ma'lumotlarni ko'rib chiqing.",
        confidence: "limited",
      },
      ru: {
        narrative:
          TAG.ru +
          "Проверки по правилам отметили органы, показанные жёлтым или красным, для более внимательного наблюдения. Некоторых недавних лабораторных значений нет, поэтому результат неполный. Прежде чем решать, просмотрите приведённые доказательства и недостающие данные.",
        confidence: "limited",
      },
    },
  },
  {
    prefix: "patient-chatbot",
    body: {
      en: {
        reply:
          TAG.en +
          "I can explain general health information and the medicines and results your doctor has approved for you. I can't diagnose or prescribe. Please ask your care team about anything specific to you, and contact emergency services if you feel very unwell.",
        isEducationalOnly: true,
      },
      uz: {
        reply:
          TAG.uz +
          "Men umumiy sog'liq ma'lumotlarini hamda shifokoringiz siz uchun tasdiqlagan dori va natijalarni tushuntira olaman. Tashxis qo'ya olmayman va dori tayinlay olmayman. Shaxsan sizga tegishli savollar bo'yicha shifokoringizga murojaat qiling, o'zingizni juda yomon his qilsangiz tez yordamga qo'ng'iroq qiling.",
        isEducationalOnly: true,
      },
      ru: {
        reply:
          TAG.ru +
          "Я могу объяснить общую информацию о здоровье, а также лекарства и результаты, которые одобрил ваш врач. Я не ставлю диагнозы и не назначаю лечение. По всему, что касается лично вас, обращайтесь к своему врачу, а если вам очень плохо — вызывайте скорую помощь.",
        isEducationalOnly: true,
      },
    },
  },
  {
    prefix: "diagnosis-detail",
    body: {
      en: {
        summary: TAG.en + "A long-term condition that needs regular monitoring by the care team.",
        monitoring: ["Regular laboratory follow-up", "Blood pressure and weight checks"],
        verifyBeforeTreating: ["Recent kidney function results", "Current medication list and allergies"],
        redFlags: ["Sudden worsening of symptoms", "New chest pain or breathlessness"],
      },
      uz: {
        summary: TAG.uz + "Shifokorlar jamoasi tomonidan muntazam kuzatuvni talab qiladigan surunkali holat.",
        monitoring: ["Muntazam laboratoriya nazorati", "Qon bosimi va vazn o'lchovlari"],
        verifyBeforeTreating: ["So'nggi buyrak faoliyati natijalari", "Joriy dorilar ro'yxati va allergiyalar"],
        redFlags: ["Alomatlarning to'satdan kuchayishi", "Yangi ko'krak og'rig'i yoki nafas qisilishi"],
      },
      ru: {
        summary: TAG.ru + "Хроническое состояние, требующее регулярного наблюдения командой врачей.",
        monitoring: ["Регулярный лабораторный контроль", "Измерение давления и веса"],
        verifyBeforeTreating: ["Недавние результаты функции почек", "Текущий список лекарств и аллергии"],
        redFlags: ["Внезапное ухудшение симптомов", "Новая боль в груди или одышка"],
      },
    },
  },
  {
    prefix: "drug-reference-condense",
    body: {
      en: { summary: TAG.en + "See the official label sections listed below for the full text.", keyCautions: [] },
      uz: { summary: TAG.uz + "To'liq matn uchun quyidagi rasmiy yorliq bo'limlariga qarang.", keyCautions: [] },
      ru: { summary: TAG.ru + "Полный текст — в разделах официальной инструкции, перечисленных ниже.", keyCautions: [] },
    },
  },
  {
    prefix: "patient-summary",
    body: {
      en: {
        summary:
          TAG.en +
          "Your doctor has reviewed your treatment plan. Please keep taking your medicines as instructed and keep your follow-up appointments. The picture shown is an illustration of what could happen, not a promise. Ask your care team if you have questions.",
      },
      uz: {
        summary:
          TAG.uz +
          "Shifokoringiz davolash rejangizni ko'rib chiqdi. Dorilaringizni ko'rsatilganidek qabul qilishda davom eting va navbatdagi qabullarni o'tkazib yubormang. Ko'rsatilgan tasvir nima bo'lishi mumkinligining tasviri, va'da emas. Savollaringiz bo'lsa, shifokoringizdan so'rang.",
      },
      ru: {
        summary:
          TAG.ru +
          "Ваш врач рассмотрел план лечения. Продолжайте принимать лекарства так, как назначено, и не пропускайте приёмы. Показанная картина — иллюстрация возможного, а не обещание. С вопросами обращайтесь к своему врачу.",
      },
    },
  },
  {
    prefix: "prevention-wording",
    body: {
      en: { intro: TAG.en + "These are the everyday habits your care team's rules suggest for you.", items: [] },
      uz: { intro: TAG.uz + "Bular shifokorlaringiz qoidalari siz uchun tavsiya qilgan kundalik odatlar.", items: [] },
      ru: { intro: TAG.ru + "Это повседневные привычки, которые правила вашей команды врачей советуют именно вам.", items: [] },
    },
  },
];

function isLanguage(code?: string): code is Language {
  return code === "en" || code === "uz" || code === "ru";
}

export function demoResponseFor(promptVersion: string, language?: string): unknown | undefined {
  const entry = RESPONSES.find((candidate) => promptVersion.startsWith(candidate.prefix));
  if (!entry) return undefined;
  return entry.body[isLanguage(language) ? language : "en"];
}
