import type { Locale } from "./i18n";

/**
 * Copy for the public pages beyond the landing scroll. It sits in one typed
 * object per language rather than in the console dictionaries: these pages are
 * long-form prose that only marketing surfaces read, and keeping them here means
 * a copy edit never touches the strict key list the clinical UI is built on.
 * `Record<Locale, Copy>` still makes a missing language a build error.
 */
export interface Copy {
  nav: { features: string; how: string; pricing: string; about: string };
  footer: { line: string; product: string; company: string; legal: string };
  cases: {
    eyebrow: string;
    title: string;
    body: string;
    trend: string;
    organs: string;
    drivers: string;
    meds: string;
    target: string;
    synthetic: string;
    patients: Record<
      "alpha" | "beta" | "gamma",
      { tab: string; summary: string; trendLabel: string; drivers: string[] }
    >;
  };
  features: {
    eyebrow: string;
    title: string;
    body: string;
    items: Array<{ title: string; body: string }>;
    compareTitle: string;
    compareRows: Array<{ label: string; usual: string; mayoq: string }>;
    usual: string;
    ctaTitle: string;
    cta: string;
  };
  how: {
    eyebrow: string;
    title: string;
    body: string;
    steps: Array<{ title: string; body: string; actor: string }>;
    guardTitle: string;
    guardBody: string;
    cta: string;
  };
  pricing: {
    eyebrow: string;
    title: string;
    body: string;
    includedTitle: string;
    included: string[];
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
    cta: string;
  };
  about: {
    eyebrow: string;
    title: string;
    body: string;
    principlesTitle: string;
    principles: Array<{ title: string; body: string }>;
    nameTitle: string;
    nameBody: string;
    cta: string;
  };
}

const uz: Copy = {
  nav: { features: "Imkoniyatlar", how: "Qanday ishlaydi", pricing: "Narxlar", about: "Loyiha haqida" },
  footer: {
    line: "Klinik qaror qo'llab-quvvatlash. Shifokorning o'rnini bosmaydi.",
    product: "Mahsulot",
    company: "Loyiha",
    legal: "Barcha bemorlar sintetik. Ma'lumotlar tibbiy maslahat emas.",
  },
  cases: {
    eyebrow: "Namunaviy holatlar",
    title: "Uchta sintetik bemor, uch xil xavf ko'rinishi",
    body: "Bemorni tanlang va raqamlar organlarga qanday aylanishini ko'ring. Barcha ma'lumotlar to'qib chiqarilgan va haqiqiy shaxsga o'xshamaydi.",
    trend: "Ko'rsatkich dinamikasi",
    organs: "Organ signallari",
    drivers: "Signalni nima belgiladi",
    meds: "Dorilar",
    target: "Maqsad",
    synthetic: "Sintetik bemor",
    patients: {
      alpha: {
        tab: "2-tur diabet",
        summary: "51 yosh · 2-tur diabet · metformin bilan davolanmoqda",
        trendLabel: "HbA1c, %",
        drivers: [
          "HbA1c 8,6 dan 7,1 gacha tushdi, lekin maqsad 7,0 dan yuqori.",
          "Buyrak signali sariq: kreatinin va eGFR hali kiritilmagan.",
          "Yurak yashil: qon bosimi va lipidlar me'yorda.",
        ],
      },
      beta: {
        tab: "Gipertoniya",
        summary: "58 yosh · arterial gipertoniya · ikki dori",
        trendLabel: "Sistolik bosim, mm sim. ust.",
        drivers: [
          "Sistolik bosim 158 dan 141 gacha tushdi, hali 130 dan yuqori.",
          "Qon tomirlari sariq: oxirgi lipid tahlili 14 oydan oshgan.",
          "Buyrak yashil: eGFR barqaror.",
        ],
      },
      gamma: {
        tab: "Diabet + NSAID",
        summary: "63 yosh · diabet va gipertoniya · og'riq qoldiruvchi NSAID",
        trendLabel: "eGFR, ml/daq",
        drivers: [
          "eGFR 74 dan 55 gacha kamaydi: to'rt o'lchov ketma-ket pasaymoqda.",
          "NSAID va qon bosimi dorisi buyrakka yuklamani oshiradi. Qoida ishga tushdi.",
          "Qizil signal tashxis emas: shifokor tasdiqlashi kerak.",
        ],
      },
    },
  },
  features: {
    eyebrow: "Imkoniyatlar",
    title: "Har bir signal qayerdan kelgani ko'rinadi",
    body: "MAYOQ AI hujjatlarni o'qiydi, ma'lumotni shifokor tasdiqlagandan keyingina qoidalarga beradi va natijani organlar ustida ko'rsatadi.",
    items: [
      {
        title: "Hujjatlardan ma'lumot olish",
        body: "Tahlil va xulosa fayllari o'qiladi. Har bir topilgan qiymat manba sahifasi bilan saqlanadi.",
      },
      {
        title: "Shifokor tasdiqlashi",
        body: "Tasdiqlanmagan qiymat qoidalarga kirmaydi. Shifokor har birini qabul qiladi, tuzatadi yoki rad etadi.",
      },
      {
        title: "Deterministik klinik qoidalar",
        body: "Dori o'zaro ta'siri, allergiya va laboratoriya chegaralari aniq qoidalar bilan tekshiriladi, taxmin bilan emas.",
      },
      {
        title: "Raqamli egizak",
        body: "Bemor tanasi 3 o'lchovda: organlarni aylantiring, yaqinlashtiring, 30, 60 va 90 kunlik prognozni ko'ring.",
      },
      {
        title: "Davolash ssenariylari",
        body: "Dori o'zgarishi xavfni qanday siljitishini oldindan ko'ring va qarorni shifokor qabul qiladi.",
      },
      {
        title: "Uch tilda, uch rolda",
        body: "O'zbek, rus va ingliz tillari. Administrator, shifokor va bemor faqat o'ziga tegishli narsani ko'radi.",
      },
    ],
    compareTitle: "Odatiy vositadan farqi",
    usual: "Odatda",
    compareRows: [
      { label: "Manba", usual: "Natija qayerdan kelgani noma'lum", mayoq: "Har signal dalil darajasi bilan belgilanadi" },
      { label: "Yetishmaydigan ma'lumot", usual: "Jimgina to'ldiriladi", mayoq: "«Noma'lum» deb ko'rsatiladi" },
      { label: "Qaror", usual: "Tizim tavsiya beradi", mayoq: "Qarorni shifokor qabul qiladi" },
    ],
    ctaTitle: "Demoni 7 kun bepul sinab ko'ring",
    cta: "Demoni boshlash",
  },
  how: {
    eyebrow: "Qanday ishlaydi",
    title: "Hujjatdan prognozgacha oltita qadam",
    body: "Har qadam oldingisiga tayanadi va shifokor ko'zidan o'tmaguncha keyingisiga o'tmaydi.",
    steps: [
      { title: "Hujjat yuklanadi", body: "PDF, rasm yoki matn. Fayl bemor yozuviga bog'lanadi va audit jurnaliga tushadi.", actor: "Shifokor yoki bemor" },
      { title: "Qiymatlar ajratiladi", body: "Tahlil nomi, qiymat, birlik va sana topiladi. Har biri manba joyi bilan saqlanadi.", actor: "Tizim" },
      { title: "Shifokor tasdiqlaydi", body: "Ishonchsiz qiymatlar belgilanadi. Tasdiqlanganlargina keyingi bosqichga o'tadi.", actor: "Shifokor" },
      { title: "Qoidalar tekshiradi", body: "Dori, allergiya va laboratoriya qoidalari deterministik ishlaydi. Natija har doim bir xil.", actor: "Tizim" },
      { title: "Tushuntirish yoziladi", body: "Yozuvlar oddiy tilda izohlanadi. Yetishmayotgan ma'lumot alohida ko'rsatiladi.", actor: "Tizim" },
      { title: "Ssenariy ko'riladi", body: "30, 60 va 90 kunlik prognoz. Shifokor qabul qiladi, o'zgartiradi yoki rad etadi.", actor: "Shifokor" },
    ],
    guardTitle: "Tasdiqlanmagan qiymat hech qachon xulosaga kirmaydi",
    guardBody: "Bu qoida kod darajasida qat'iy: tasdiqlash bosqichi o'tkazib yuborilmaydi.",
    cta: "Namunani ko'rish",
  },
  pricing: {
    eyebrow: "Narxlar",
    title: "Klinika o'lchamiga qarab uchta reja",
    body: "Ro'yxatdan o'tgan zahoti 7 kunlik demo yoqiladi. To'liq ish jarayoni, foydalanish chegarasi bilan.",
    includedTitle: "Har bir rejaga kiradi",
    included: [
      "Reja doirasidagi shifokorlar uchun cheksiz bemor",
      "Uch rol: administrator, shifokor, bemor",
      "Raqamli egizak va prognoz ssenariylari",
      "To'liq audit jurnali",
      "O'zbek, rus va ingliz tillari",
    ],
    faqTitle: "Ko'p so'raladigan savollar",
    faq: [
      { q: "Tizim tashxis qo'yadimi?", a: "Yo'q. MAYOQ AI qaror qo'llab-quvvatlaydi. Har bir xulosani shifokor ko'rib chiqadi va qaror uniki." },
      { q: "Ma'lumot yetishmasa nima bo'ladi?", a: "Organ «baholanmagan» deb ko'rsatiladi va nima yetishmasligi yoziladi. Tizim qiymatni taxmin qilmaydi." },
      { q: "Demo tugagach ma'lumotlarim nima bo'ladi?", a: "Ma'lumotlar saqlanadi. Reja faollashtirilguncha faqat o'qish mumkin." },
      { q: "Bir klinika ma'lumotini boshqasi ko'ra oladimi?", a: "Yo'q. Har klinika alohida ajratilgan va har so'rov klinika bo'yicha tekshiriladi." },
      { q: "Demoda haqiqiy bemor ma'lumotini kiritsam bo'ladimi?", a: "Yo'q. Demo faqat sintetik ma'lumotlar uchun mo'ljallangan." },
    ],
    cta: "Demoni boshlash",
  },
  about: {
    eyebrow: "Loyiha haqida",
    title: "Mayoq: xavf toshga urilishdan oldin yonadigan chiroq",
    body: "Surunkali kasalliklar bilan yashaydigan odamlarda xavf asta-sekin to'planadi. Tahlillar turli joyda, dorilar boshqa yerda. MAYOQ AI ularni bitta ko'rinishga jamlaydi va shifokorga erta signal beradi.",
    principlesTitle: "To'rt tamoyil",
    principles: [
      { title: "Shifokor qaror qiladi", body: "Tizim hech qachon tashxis qo'ymaydi va dori buyurmaydi." },
      { title: "Noma'lum noma'lumligicha qoladi", body: "Yetishmagan ma'lumot to'ldirilmaydi. U ko'rsatiladi." },
      { title: "Rang faqat qoida bilan", body: "Yashil, sariq va qizil faqat klinik qoida natijasi. Bezak sifatida ishlatilmaydi." },
      { title: "Izlab topiladigan har qadam", body: "Qiymat qayerdan kelgani, kim tasdiqlagani va qachon, audit jurnalida turadi." },
    ],
    nameTitle: "Nom haqida",
    nameBody: "«Mayoq» o'zbek tilida dengiz chiroqi degani. Interfeysdagi to'q sariq faqat brend rangi. Klinik ma'noni faqat yashil, sariq va qizil olib yuradi.",
    cta: "Demoni boshlash",
  },
};

const en: Copy = {
  nav: { features: "Features", how: "How it works", pricing: "Pricing", about: "About" },
  footer: {
    line: "Clinical decision support. It does not replace the physician.",
    product: "Product",
    company: "Project",
    legal: "All patients are synthetic. Nothing here is medical advice.",
  },
  cases: {
    eyebrow: "Sample cases",
    title: "Three synthetic patients, three risk pictures",
    body: "Pick a patient to see how their numbers turn into organ signals. Every record is invented and resembles no real person.",
    trend: "Trend",
    organs: "Organ signals",
    drivers: "What set the signal",
    meds: "Medications",
    target: "Target",
    synthetic: "Synthetic patient",
    patients: {
      alpha: {
        tab: "Type 2 diabetes",
        summary: "51 years · type 2 diabetes · on metformin",
        trendLabel: "HbA1c, %",
        drivers: [
          "HbA1c fell from 8.6 to 7.1, still above the 7.0 target.",
          "Kidney is amber: creatinine and eGFR have not been entered yet.",
          "Heart is green: blood pressure and lipids are in range.",
        ],
      },
      beta: {
        tab: "Hypertension",
        summary: "58 years · arterial hypertension · two agents",
        trendLabel: "Systolic pressure, mmHg",
        drivers: [
          "Systolic pressure fell from 158 to 141, still above 130.",
          "Blood vessels are amber: the last lipid panel is over 14 months old.",
          "Kidney is green: eGFR is stable.",
        ],
      },
      gamma: {
        tab: "Diabetes + NSAID",
        summary: "63 years · diabetes and hypertension · NSAID for pain",
        trendLabel: "eGFR, ml/min",
        drivers: [
          "eGFR fell from 74 to 55: four readings in a row are lower.",
          "An NSAID with a blood pressure drug adds load on the kidney. A rule fired.",
          "Red is not a diagnosis: a physician has to confirm it.",
        ],
      },
    },
  },
  features: {
    eyebrow: "Features",
    title: "Every signal shows where it came from",
    body: "MAYOQ AI reads documents, passes values to the rules only after a physician confirms them, and shows the result on the organs.",
    items: [
      {
        title: "Document extraction",
        body: "Lab reports and discharge summaries are read. Each value is stored with the page it came from.",
      },
      {
        title: "Physician verification",
        body: "An unconfirmed value never reaches the rules. The doctor accepts, corrects or rejects each one.",
      },
      {
        title: "Deterministic clinical rules",
        body: "Drug interactions, allergies and lab thresholds are checked by explicit rules, not by guesswork.",
      },
      {
        title: "Digital twin",
        body: "The patient's body in 3D: rotate, zoom in, and step through 30, 60 and 90-day projections.",
      },
      {
        title: "Treatment scenarios",
        body: "See how a medication change would move risk before anyone prescribes it. The physician decides.",
      },
      {
        title: "Three languages, three roles",
        body: "Uzbek, Russian and English. Admins, doctors and patients each see only what belongs to them.",
      },
    ],
    compareTitle: "How it differs from the usual tool",
    usual: "Usually",
    compareRows: [
      { label: "Source", usual: "No way to tell where a result came from", mayoq: "Every signal carries an evidence grade" },
      { label: "Missing data", usual: "Quietly filled in", mayoq: "Shown as unknown" },
      { label: "Decision", usual: "The system recommends", mayoq: "The physician decides" },
    ],
    ctaTitle: "Try the demo free for 7 days",
    cta: "Start the demo",
  },
  how: {
    eyebrow: "How it works",
    title: "Six steps from document to projection",
    body: "Each step builds on the last and does not advance until a physician has looked.",
    steps: [
      { title: "A document is uploaded", body: "PDF, image or text. The file attaches to the patient record and lands in the audit log.", actor: "Doctor or patient" },
      { title: "Values are extracted", body: "Test name, value, unit and date are found. Each is kept with its place in the source.", actor: "System" },
      { title: "A physician verifies", body: "Low-confidence values are flagged. Only confirmed ones move on.", actor: "Physician" },
      { title: "Rules check", body: "Drug, allergy and lab rules run deterministically. The same input always gives the same result.", actor: "System" },
      { title: "An explanation is written", body: "Findings are described in plain language. Missing data is listed separately.", actor: "System" },
      { title: "A scenario is reviewed", body: "A 30, 60 and 90-day projection. The physician accepts, changes or rejects it.", actor: "Physician" },
    ],
    guardTitle: "An unconfirmed value never enters a conclusion",
    guardBody: "This rule is enforced in code: the verification step cannot be skipped.",
    cta: "See a sample case",
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Three plans, sized to the clinic",
    body: "A 7-day demo turns on the moment a clinic registers. Full workflow, with usage limits.",
    includedTitle: "Included in every plan",
    included: [
      "Unlimited patients for the doctors your plan covers",
      "Three roles: admin, doctor, patient",
      "Digital twin and projection scenarios",
      "Full audit log",
      "Uzbek, Russian and English",
    ],
    faqTitle: "Common questions",
    faq: [
      { q: "Does the system diagnose?", a: "No. MAYOQ AI supports decisions. A physician reviews every conclusion and the decision stays theirs." },
      { q: "What happens when data is missing?", a: "The organ shows as not assessed and the gap is named. The system does not guess a value." },
      { q: "What happens to my data when the demo ends?", a: "It is kept. It is read-only until a plan is activated." },
      { q: "Can one clinic see another's data?", a: "No. Each clinic is isolated and every request is checked against its clinic." },
      { q: "Can I enter real patient data in the demo?", a: "No. The demo is for synthetic data only." },
    ],
    cta: "Start the demo",
  },
  about: {
    eyebrow: "About",
    title: "Mayoq: the lamp that lights before the ship meets rock",
    body: "For people living with chronic conditions, risk builds slowly. Results sit in one place and medications in another. MAYOQ AI pulls them into a single view and gives the physician an early signal.",
    principlesTitle: "Four principles",
    principles: [
      { title: "The physician decides", body: "The system never diagnoses and never prescribes." },
      { title: "Unknown stays unknown", body: "Missing data is not filled in. It is shown." },
      { title: "Colour only from a rule", body: "Green, amber and red are clinical rule results. They are never decoration." },
      { title: "Every step is traceable", body: "Where a value came from, who confirmed it and when: all in the audit log." },
    ],
    nameTitle: "On the name",
    nameBody: "\"Mayoq\" is the Uzbek word for lighthouse. The orange in the interface is brand colour only. Clinical meaning belongs to green, amber and red alone.",
    cta: "Start the demo",
  },
};

const ru: Copy = {
  nav: { features: "Возможности", how: "Как это работает", pricing: "Тарифы", about: "О проекте" },
  footer: {
    line: "Поддержка клинических решений. Не заменяет врача.",
    product: "Продукт",
    company: "Проект",
    legal: "Все пациенты синтетические. Ничто здесь не является медицинской рекомендацией.",
  },
  cases: {
    eyebrow: "Примеры случаев",
    title: "Три синтетических пациента, три картины риска",
    body: "Выберите пациента и посмотрите, как его показатели превращаются в сигналы по органам. Все записи вымышлены и не похожи на реальных людей.",
    trend: "Динамика",
    organs: "Сигналы по органам",
    drivers: "Что определило сигнал",
    meds: "Лекарства",
    target: "Цель",
    synthetic: "Синтетический пациент",
    patients: {
      alpha: {
        tab: "Диабет 2 типа",
        summary: "51 год · диабет 2 типа · принимает метформин",
        trendLabel: "HbA1c, %",
        drivers: [
          "HbA1c снизился с 8,6 до 7,1, но всё ещё выше цели 7,0.",
          "Почки жёлтые: креатинин и СКФ ещё не внесены.",
          "Сердце зелёное: давление и липиды в норме.",
        ],
      },
      beta: {
        tab: "Гипертония",
        summary: "58 лет · артериальная гипертония · два препарата",
        trendLabel: "Систолическое давление, мм рт. ст.",
        drivers: [
          "Систолическое давление снизилось со 158 до 141, всё ещё выше 130.",
          "Сосуды жёлтые: последней липидограмме больше 14 месяцев.",
          "Почки зелёные: СКФ стабильна.",
        ],
      },
      gamma: {
        tab: "Диабет + НПВП",
        summary: "63 года · диабет и гипертония · НПВП от боли",
        trendLabel: "СКФ, мл/мин",
        drivers: [
          "СКФ упала с 74 до 55: четыре измерения подряд ниже предыдущего.",
          "НПВП вместе с препаратом от давления повышает нагрузку на почки. Сработало правило.",
          "Красный сигнал не диагноз: его должен подтвердить врач.",
        ],
      },
    },
  },
  features: {
    eyebrow: "Возможности",
    title: "У каждого сигнала видно, откуда он взялся",
    body: "MAYOQ AI читает документы, передаёт значения правилам только после подтверждения врачом и показывает результат на органах.",
    items: [
      {
        title: "Извлечение из документов",
        body: "Читаются анализы и выписки. Каждое значение хранится вместе со страницей-источником.",
      },
      {
        title: "Подтверждение врачом",
        body: "Неподтверждённое значение не попадает в правила. Врач принимает, исправляет или отклоняет каждое.",
      },
      {
        title: "Детерминированные клинические правила",
        body: "Лекарственные взаимодействия, аллергии и лабораторные пороги проверяются чёткими правилами, а не догадками.",
      },
      {
        title: "Цифровой двойник",
        body: "Тело пациента в 3D: вращайте, приближайте и переключайте прогноз на 30, 60 и 90 дней.",
      },
      {
        title: "Сценарии лечения",
        body: "Посмотрите, как смена препарата сдвинет риск, до назначения. Решает врач.",
      },
      {
        title: "Три языка, три роли",
        body: "Узбекский, русский и английский. Администратор, врач и пациент видят только своё.",
      },
    ],
    compareTitle: "Чем это отличается от обычного инструмента",
    usual: "Обычно",
    compareRows: [
      { label: "Источник", usual: "Непонятно, откуда результат", mayoq: "У каждого сигнала есть уровень доказательности" },
      { label: "Нехватка данных", usual: "Тихо заполняется", mayoq: "Показывается как неизвестное" },
      { label: "Решение", usual: "Рекомендует система", mayoq: "Решает врач" },
    ],
    ctaTitle: "Попробуйте демо бесплатно 7 дней",
    cta: "Начать демо",
  },
  how: {
    eyebrow: "Как это работает",
    title: "Шесть шагов от документа до прогноза",
    body: "Каждый шаг опирается на предыдущий и не идёт дальше, пока врач не посмотрел.",
    steps: [
      { title: "Загружается документ", body: "PDF, изображение или текст. Файл привязывается к карте пациента и попадает в журнал аудита.", actor: "Врач или пациент" },
      { title: "Извлекаются значения", body: "Находятся название анализа, значение, единица и дата. Каждое хранится с местом в источнике.", actor: "Система" },
      { title: "Врач подтверждает", body: "Значения с низкой уверенностью помечаются. Дальше проходят только подтверждённые.", actor: "Врач" },
      { title: "Правила проверяют", body: "Правила по лекарствам, аллергиям и анализам работают детерминированно. Одинаковый вход даёт одинаковый результат.", actor: "Система" },
      { title: "Пишется пояснение", body: "Находки описываются простым языком. Недостающие данные перечисляются отдельно.", actor: "Система" },
      { title: "Просматривается сценарий", body: "Прогноз на 30, 60 и 90 дней. Врач принимает, меняет или отклоняет его.", actor: "Врач" },
    ],
    guardTitle: "Неподтверждённое значение никогда не попадает в вывод",
    guardBody: "Это правило закреплено в коде: шаг подтверждения нельзя пропустить.",
    cta: "Посмотреть пример",
  },
  pricing: {
    eyebrow: "Тарифы",
    title: "Три плана по размеру клиники",
    body: "7-дневное демо включается сразу после регистрации клиники. Полный рабочий процесс с лимитами использования.",
    includedTitle: "Входит в каждый план",
    included: [
      "Неограниченно пациентов для врачей в рамках плана",
      "Три роли: администратор, врач, пациент",
      "Цифровой двойник и сценарии прогноза",
      "Полный журнал аудита",
      "Узбекский, русский и английский языки",
    ],
    faqTitle: "Частые вопросы",
    faq: [
      { q: "Система ставит диагноз?", a: "Нет. MAYOQ AI поддерживает решения. Каждый вывод проверяет врач, и решение остаётся за ним." },
      { q: "Что будет, если данных не хватает?", a: "Орган показывается как неоценённый, а недостающее называется. Система не угадывает значение." },
      { q: "Что будет с моими данными после демо?", a: "Они сохранятся. До активации плана доступно только чтение." },
      { q: "Может ли одна клиника увидеть данные другой?", a: "Нет. Каждая клиника изолирована, каждый запрос проверяется по клинике." },
      { q: "Можно ли вносить в демо данные реальных пациентов?", a: "Нет. Демо предназначено только для синтетических данных." },
    ],
    cta: "Начать демо",
  },
  about: {
    eyebrow: "О проекте",
    title: "Маяк: свет, который зажигается до встречи корабля со скалой",
    body: "У людей с хроническими заболеваниями риск копится медленно. Анализы лежат в одном месте, лекарства в другом. MAYOQ AI собирает их в одну картину и даёт врачу ранний сигнал.",
    principlesTitle: "Четыре принципа",
    principles: [
      { title: "Решает врач", body: "Система никогда не ставит диагноз и не назначает лекарства." },
      { title: "Неизвестное остаётся неизвестным", body: "Недостающие данные не дорисовываются. Они показываются." },
      { title: "Цвет только от правила", body: "Зелёный, жёлтый и красный это результат клинического правила. Не украшение." },
      { title: "Каждый шаг прослеживается", body: "Откуда значение, кто и когда его подтвердил: всё в журнале аудита." },
    ],
    nameTitle: "О названии",
    nameBody: "«Mayoq» по-узбекски «маяк». Оранжевый в интерфейсе только цвет бренда. Клинический смысл несут лишь зелёный, жёлтый и красный.",
    cta: "Начать демо",
  },
};

export const MARKETING_COPY: Record<Locale, Copy> = { uz, en, ru };
