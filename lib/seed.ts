import { Role, BehavioralTrait } from './types';
import type { User, District, School, Student, TopicSegment, DiaryEntry, QuizQuestion } from './types';
import {
  districtStore, schoolStore, studentStore, topicStore,
  diaryStore, seedStore, userStore, quizQuestionStore,
} from './storage';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function seedData(): void {
  if (typeof window === 'undefined') return;
  if (seedStore.isSeeded()) return;

  // Districts
  const districts: District[] = [
    { id: 'dist-1', name: 'Education District I (Lagos Island)' },
    { id: 'dist-2', name: 'Education District II (Eti-Osa)' },
    { id: 'dist-3', name: 'Education District III (Ikorodu)' },
  ];
  districts.forEach((d) => districtStore.save(d));

  // Schools
  const schools: School[] = [
    { id: 'sch-1', name: 'Lagos Model College, Meiran', districtId: 'dist-1', address: 'Meiran, Lagos' },
    { id: 'sch-2', name: 'Government College, Igbobi', districtId: 'dist-1', address: 'Igbobi, Lagos' },
    { id: 'sch-3', name: 'Ansar-Ud-Deen High School', districtId: 'dist-2', address: 'Isale-Eko, Lagos' },
  ];
  schools.forEach((s) => schoolStore.save(s));

  // Users
  const users: User[] = [
    {
      id: 'user-teacher-1', phone: '08012345678', name: 'Mrs. Adaeze Okonkwo',
      role: Role.TEACHER, schoolId: 'sch-1', createdAt: daysAgo(60),
    },
    {
      id: 'user-teacher-2', phone: '08023456789', name: 'Mr. Babatunde Alli',
      role: Role.TEACHER, schoolId: 'sch-1', createdAt: daysAgo(60),
    },
    {
      id: 'user-head-1', phone: '08034567890', name: 'Mr. Emmanuel Chukwu',
      role: Role.HEADTEACHER, schoolId: 'sch-1', createdAt: daysAgo(90),
    },
    {
      id: 'user-district-1', phone: '08045678901', name: 'Dr. Fatima Sule',
      role: Role.DISTRICT, districtId: 'dist-1', createdAt: daysAgo(120),
    },
    {
      id: 'user-ministry-1', phone: '08056789012', name: 'Hon. Gbenga Adewale',
      role: Role.MINISTRY, createdAt: daysAgo(180),
    },
  ];
  if (typeof window !== 'undefined') {
    localStorage.setItem('eko_users', JSON.stringify(users));
  }

  // Students
  const studentNames = [
    'Abiodun Fashola', 'Chidinma Obi', 'Emeka Nwosu', 'Funmilayo Adeleke',
    'Gbenga Coker', 'Halima Yusuf', 'Ikenna Eze', 'Jumoke Bello',
    'Kayode Adesanya', 'Lara Okafor',
  ];
  const classes = ['SS1', 'SS2', 'SS3'];
  const students: Student[] = studentNames.map((name, i) => ({
    id: `stu-${i + 1}`,
    name,
    schoolId: 'sch-1',
    class: classes[i % 3],
    enrolledDate: daysAgo(300),
  }));
  students.forEach((s) => studentStore.save(s));

  // Topics
  const topicData: Array<[string, string, number]> = [
    ['Mathematics', 'Algebra & Quadratic Equations', 0.85],
    ['Mathematics', 'Trigonometry', 0.78],
    ['Mathematics', 'Statistics & Probability', 0.72],
    ['English', 'Comprehension & Summary', 0.90],
    ['English', 'Essay Writing', 0.85],
    ['English', 'Grammar & Usage', 0.80],
    ['Physics', 'Mechanics & Motion', 0.75],
    ['Physics', 'Electricity & Magnetism', 0.70],
    ['Chemistry', 'Organic Chemistry', 0.80],
    ['Chemistry', 'Acids, Bases & Salts', 0.75],
    ['Biology', 'Cell Biology & Genetics', 0.85],
    ['Biology', 'Ecology & Environment', 0.70],
  ];
  const topics: TopicSegment[] = topicData.map(([subject, topic, freq], i) => ({
    id: `topic-${i + 1}`,
    subject,
    topic,
    waecFrequency: freq,
    weight: freq,
  }));
  topics.forEach((t) => topicStore.save(t));

  // Diary Entries (seed historical data)
  const traitValues: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
  const traits = Object.values(BehavioralTrait);

  const diaries: DiaryEntry[] = [];
  students.forEach((student, si) => {
    // Each student gets ~8 diary entries spread over the last 30 days
    for (let day = 0; day < 8; day++) {
      const topicIdx = (si + day) % topics.length;
      const topic = topics[topicIdx];
      const baseScore = 40 + (si * 6) + (day * 2);
      const clampedScore = Math.min(95, Math.max(30, baseScore));
      const behavioralTraits = traits.reduce((acc, trait) => {
        acc[trait] = traitValues[(si + day) % 3];
        return acc;
      }, {} as Record<BehavioralTrait, 'high' | 'medium' | 'low'>);

      diaries.push({
        id: uid(),
        idempotencyKey: `${student.id}-${topic.id}-day${day}`,
        studentId: student.id,
        teacherId: 'user-teacher-1',
        topicId: topic.id,
        classScore: clampedScore,
        attendance: students.filter((_, idx) => idx !== (si + day) % students.length).map((s) => s.id),
        behavioralTraits,
        createdAt: daysAgo(30 - day * 4),
      });
    }
  });
  diaries.forEach((d) => diaryStore.save(d));

  seedStore.markSeeded();
  seedExtended();
}

export function seedExtended(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('eko_seeded_v2') === 'true') return;

  // Student + Parent user accounts
  const extendedUsers: User[] = [
    {
      id: 'user-student-1', phone: '08067890123', name: 'Abiodun Fashola',
      role: Role.STUDENT, schoolId: 'sch-1', studentId: 'stu-1', createdAt: daysAgo(300),
    },
    {
      id: 'user-student-2', phone: '08078901234', name: 'Chidinma Obi',
      role: Role.STUDENT, schoolId: 'sch-1', studentId: 'stu-2', createdAt: daysAgo(300),
    },
    {
      id: 'user-parent-1', phone: '08089012345', name: 'Mr. Emeka Fashola',
      role: Role.PARENT, childId: 'stu-1', createdAt: daysAgo(300),
    },
    {
      id: 'user-parent-2', phone: '08090123456', name: 'Mrs. Grace Obi',
      role: Role.PARENT, childId: 'stu-2', createdAt: daysAgo(300),
    },
  ];
  userStore.addMany(extendedUsers);

  // Question bank — 5 questions per topic (60 total)
  const questions: QuizQuestion[] = [
    // Mathematics — Algebra & Quadratic Equations (topic-1)
    { id: 'q-1-1', subject: 'Mathematics', topicId: 'topic-1', difficulty: 'medium', question: 'Solve: x² − 5x + 6 = 0', options: ['x = 2 or x = 3', 'x = 1 or x = 6', 'x = −2 or x = −3', 'x = 2 or x = −3'], correctIndex: 0 },
    { id: 'q-1-2', subject: 'Mathematics', topicId: 'topic-1', difficulty: 'medium', question: 'The sum of roots of 2x² − 6x + 4 = 0 is:', options: ['3', '6', '2', '−3'], correctIndex: 0 },
    { id: 'q-1-3', subject: 'Mathematics', topicId: 'topic-1', difficulty: 'hard', question: 'If x² + kx + 9 = 0 has equal roots, the possible values of k are:', options: ['±6', '±3', '±9', '±18'], correctIndex: 0 },
    { id: 'q-1-4', subject: 'Mathematics', topicId: 'topic-1', difficulty: 'easy', question: 'Factorise: x² + 7x + 12', options: ['(x + 3)(x + 4)', '(x + 2)(x + 6)', '(x + 1)(x + 12)', '(x + 3)(x − 4)'], correctIndex: 0 },
    { id: 'q-1-5', subject: 'Mathematics', topicId: 'topic-1', difficulty: 'medium', question: 'The product of the roots of 3x² − 12x + 9 = 0 is:', options: ['3', '−4', '9', '12'], correctIndex: 0 },
    // Mathematics — Trigonometry (topic-2)
    { id: 'q-2-1', subject: 'Mathematics', topicId: 'topic-2', difficulty: 'easy', question: 'sin 30° equals:', options: ['½', '√3/2', '1/√2', '1'], correctIndex: 0 },
    { id: 'q-2-2', subject: 'Mathematics', topicId: 'topic-2', difficulty: 'easy', question: 'cos 60° equals:', options: ['½', '√3/2', '1', '0'], correctIndex: 0 },
    { id: 'q-2-3', subject: 'Mathematics', topicId: 'topic-2', difficulty: 'easy', question: 'tan 45° equals:', options: ['1', '0', '√3', '1/√3'], correctIndex: 0 },
    { id: 'q-2-4', subject: 'Mathematics', topicId: 'topic-2', difficulty: 'medium', question: 'If sin θ = 3/5, then cos θ equals:', options: ['4/5', '3/4', '5/4', '5/3'], correctIndex: 0 },
    { id: 'q-2-5', subject: 'Mathematics', topicId: 'topic-2', difficulty: 'medium', question: 'In a right triangle with hypotenuse 10 and one angle of 30°, the side opposite 30° is:', options: ['5', '5√3', '10√3', '8'], correctIndex: 0 },
    // Mathematics — Statistics & Probability (topic-3)
    { id: 'q-3-1', subject: 'Mathematics', topicId: 'topic-3', difficulty: 'easy', question: 'The mean of 4, 7, 8, 10, 11 is:', options: ['8', '7', '9', '10'], correctIndex: 0 },
    { id: 'q-3-2', subject: 'Mathematics', topicId: 'topic-3', difficulty: 'easy', question: 'A bag has 3 red and 2 blue balls. P(red) =', options: ['3/5', '2/5', '1/2', '3/2'], correctIndex: 0 },
    { id: 'q-3-3', subject: 'Mathematics', topicId: 'topic-3', difficulty: 'medium', question: 'The median of 2, 4, 5, 6, 8, 10 is:', options: ['5.5', '5', '6', '4'], correctIndex: 0 },
    { id: 'q-3-4', subject: 'Mathematics', topicId: 'topic-3', difficulty: 'easy', question: 'The mode of 3, 4, 4, 5, 6, 4, 7 is:', options: ['4', '5', '3', '6'], correctIndex: 0 },
    { id: 'q-3-5', subject: 'Mathematics', topicId: 'topic-3', difficulty: 'medium', question: 'For mutually exclusive events A and B, P(A or B) =', options: ['P(A) + P(B)', 'P(A) × P(B)', 'P(A) − P(B)', '1 − P(A)'], correctIndex: 0 },
    // English — Comprehension & Summary (topic-4)
    { id: 'q-4-1', subject: 'English', topicId: 'topic-4', difficulty: 'easy', question: 'A topic sentence in a paragraph:', options: ['States the main idea', 'Gives detailed examples', 'Concludes the paragraph', 'Introduces a new topic'], correctIndex: 0 },
    { id: 'q-4-2', subject: 'English', topicId: 'topic-4', difficulty: 'easy', question: 'When writing a summary, you should:', options: ['Use your own words', 'Copy the text exactly', 'Add personal opinions', 'Use many quotations'], correctIndex: 0 },
    { id: 'q-4-3', subject: 'English', topicId: 'topic-4', difficulty: 'medium', question: 'An "inference" in comprehension means:', options: ['A conclusion based on evidence', 'A direct quotation', 'A dictionary definition', 'An introductory sentence'], correctIndex: 0 },
    { id: 'q-4-4', subject: 'English', topicId: 'topic-4', difficulty: 'medium', question: 'The word "candid" most nearly means:', options: ['Frank and honest', 'Secretive', 'Colourful', 'Silent'], correctIndex: 0 },
    { id: 'q-4-5', subject: 'English', topicId: 'topic-4', difficulty: 'hard', question: 'The best strategy for summarising a long passage is to:', options: ['Identify only the main ideas', 'Copy all important sentences', 'Start from the final paragraph', 'Quote every key phrase'], correctIndex: 0 },
    // English — Essay Writing (topic-5)
    { id: 'q-5-1', subject: 'English', topicId: 'topic-5', difficulty: 'easy', question: 'A thesis statement in an essay is:', options: ['The main argument of the essay', 'The conclusion paragraph', 'A supporting detail', 'A quotation from a source'], correctIndex: 0 },
    { id: 'q-5-2', subject: 'English', topicId: 'topic-5', difficulty: 'easy', question: 'The introduction of an essay should:', options: ['Hook the reader and state the thesis', 'Present all evidence upfront', 'Conclude the argument', 'List all references'], correctIndex: 0 },
    { id: 'q-5-3', subject: 'English', topicId: 'topic-5', difficulty: 'medium', question: 'In formal essay writing, you should:', options: ['Avoid contractions such as "don\'t"', 'Use slang for emphasis', 'Write only in second person', 'Keep all sentences as brief as possible'], correctIndex: 0 },
    { id: 'q-5-4', subject: 'English', topicId: 'topic-5', difficulty: 'medium', question: 'Body paragraphs in an argumentative essay should:', options: ['Support the thesis with evidence', 'Introduce entirely new topics', 'Restate the introduction', 'Summarise other essays'], correctIndex: 0 },
    { id: 'q-5-5', subject: 'English', topicId: 'topic-5', difficulty: 'hard', question: 'A "counter-argument" in an essay means:', options: ['Acknowledging an opposing view before refuting it', 'Agreeing with all sides equally', 'Ignoring the other side\'s views', 'Restating your own argument twice'], correctIndex: 0 },
    // English — Grammar & Usage (topic-6)
    { id: 'q-6-1', subject: 'English', topicId: 'topic-6', difficulty: 'easy', question: 'Which sentence is grammatically correct?', options: ["She doesn't know anything.", "She don't know nothing.", "She doesn't know nothing.", "She didn't knew anything."], correctIndex: 0 },
    { id: 'q-6-2', subject: 'English', topicId: 'topic-6', difficulty: 'medium', question: 'The plural of "phenomenon" is:', options: ['phenomena', 'phenomenons', 'phenomenas', 'phenomenes'], correctIndex: 0 },
    { id: 'q-6-3', subject: 'English', topicId: 'topic-6', difficulty: 'easy', question: 'He walked _____ to the market.', options: ['slowly', 'slow', 'slower', 'slowest'], correctIndex: 0 },
    { id: 'q-6-4', subject: 'English', topicId: 'topic-6', difficulty: 'easy', question: 'A sentence that asks a question is called:', options: ['An interrogative sentence', 'An imperative sentence', 'An exclamatory sentence', 'A declarative sentence'], correctIndex: 0 },
    { id: 'q-6-5', subject: 'English', topicId: 'topic-6', difficulty: 'medium', question: 'Which sentence is correctly punctuated?', options: ["It's a long way home.", "Its a long way home.", "Its' a long way home.", "It's a long way — home!"], correctIndex: 0 },
    // Physics — Mechanics & Motion (topic-7)
    { id: 'q-7-1', subject: 'Physics', topicId: 'topic-7', difficulty: 'easy', question: "Newton's First Law states that an object at rest will:", options: ['Stay at rest unless acted upon by an external force', 'Accelerate constantly', 'Lose mass over time', 'Have zero weight'], correctIndex: 0 },
    { id: 'q-7-2', subject: 'Physics', topicId: 'topic-7', difficulty: 'easy', question: 'Speed is calculated as:', options: ['Distance ÷ Time', 'Time ÷ Distance', 'Distance × Time', 'Mass ÷ Time'], correctIndex: 0 },
    { id: 'q-7-3', subject: 'Physics', topicId: 'topic-7', difficulty: 'easy', question: 'The SI unit of force is:', options: ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'], correctIndex: 0 },
    { id: 'q-7-4', subject: 'Physics', topicId: 'topic-7', difficulty: 'medium', question: 'A car accelerates from 0 to 20 m/s in 4 seconds. Its acceleration is:', options: ['5 m/s²', '80 m/s²', '0.2 m/s²', '24 m/s²'], correctIndex: 0 },
    { id: 'q-7-5', subject: 'Physics', topicId: 'topic-7', difficulty: 'medium', question: "An object in free fall near Earth's surface accelerates at approximately:", options: ['10 m/s²', '9 m/s', '100 m/s²', '1 m/s²'], correctIndex: 0 },
    // Physics — Electricity & Magnetism (topic-8)
    { id: 'q-8-1', subject: 'Physics', topicId: 'topic-8', difficulty: 'easy', question: "According to Ohm's Law, V equals:", options: ['IR', 'I ÷ R', 'R ÷ I', 'I + R'], correctIndex: 0 },
    { id: 'q-8-2', subject: 'Physics', topicId: 'topic-8', difficulty: 'easy', question: 'The SI unit of electrical resistance is:', options: ['Ohm (Ω)', 'Ampere (A)', 'Volt (V)', 'Coulomb (C)'], correctIndex: 0 },
    { id: 'q-8-3', subject: 'Physics', topicId: 'topic-8', difficulty: 'medium', question: 'In a parallel circuit, the voltage across each component is:', options: ['The same for all components', 'Different for each component', 'Zero throughout', 'Doubled for each added branch'], correctIndex: 0 },
    { id: 'q-8-4', subject: 'Physics', topicId: 'topic-8', difficulty: 'medium', question: 'Electrical power P equals:', options: ['IV', 'I ÷ V', 'V ÷ I', 'I + V'], correctIndex: 0 },
    { id: 'q-8-5', subject: 'Physics', topicId: 'topic-8', difficulty: 'easy', question: 'Two like charges placed near each other will:', options: ['Repel each other', 'Attract each other', 'Neutralise each other', 'Have no effect on each other'], correctIndex: 0 },
    // Chemistry — Organic Chemistry (topic-9)
    { id: 'q-9-1', subject: 'Chemistry', topicId: 'topic-9', difficulty: 'easy', question: 'Methane (CH₄) belongs to which homologous series?', options: ['Alkanes', 'Alkenes', 'Alkynes', 'Alcohols'], correctIndex: 0 },
    { id: 'q-9-2', subject: 'Chemistry', topicId: 'topic-9', difficulty: 'easy', question: 'The functional group of alcohols is:', options: ['−OH', '−COOH', '−CHO', '−CO−'], correctIndex: 0 },
    { id: 'q-9-3', subject: 'Chemistry', topicId: 'topic-9', difficulty: 'easy', question: 'Ethylene (CH₂=CH₂) is an:', options: ['Alkene', 'Alkane', 'Alkyne', 'Aromatic compound'], correctIndex: 0 },
    { id: 'q-9-4', subject: 'Chemistry', topicId: 'topic-9', difficulty: 'medium', question: 'The general formula for alkanes is:', options: ['CₙH₂ₙ₊₂', 'CₙH₂ₙ', 'CₙH₂ₙ₋₂', 'CₙHₙ'], correctIndex: 0 },
    { id: 'q-9-5', subject: 'Chemistry', topicId: 'topic-9', difficulty: 'medium', question: 'Fermentation of glucose produces:', options: ['Ethanol + CO₂', 'Methane + H₂O', 'Acetic acid + O₂', 'Propanol + N₂'], correctIndex: 0 },
    // Chemistry — Acids, Bases & Salts (topic-10)
    { id: 'q-10-1', subject: 'Chemistry', topicId: 'topic-10', difficulty: 'easy', question: 'An acid has a pH value that is:', options: ['Less than 7', 'Exactly 7', 'Greater than 7', 'Always above 10'], correctIndex: 0 },
    { id: 'q-10-2', subject: 'Chemistry', topicId: 'topic-10', difficulty: 'easy', question: 'Neutralisation is the reaction between:', options: ['An acid and a base', 'Two acids', 'Two bases', 'A metal and water'], correctIndex: 0 },
    { id: 'q-10-3', subject: 'Chemistry', topicId: 'topic-10', difficulty: 'easy', question: 'NaOH is classified as a:', options: ['Strong base', 'Weak acid', 'Salt', 'Neutral substance'], correctIndex: 0 },
    { id: 'q-10-4', subject: 'Chemistry', topicId: 'topic-10', difficulty: 'medium', question: 'HCl + NaOH → ?', options: ['NaCl + H₂O', 'NaOH + HCl (no reaction)', 'Na + H₂ + Cl₂', 'NaCl₂ + H₂'], correctIndex: 0 },
    { id: 'q-10-5', subject: 'Chemistry', topicId: 'topic-10', difficulty: 'easy', question: 'The pH of pure water at 25°C is:', options: ['7', '0', '14', '5'], correctIndex: 0 },
    // Biology — Cell Biology & Genetics (topic-11)
    { id: 'q-11-1', subject: 'Biology', topicId: 'topic-11', difficulty: 'easy', question: 'The "powerhouse of the cell" is the:', options: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi body'], correctIndex: 0 },
    { id: 'q-11-2', subject: 'Biology', topicId: 'topic-11', difficulty: 'easy', question: 'DNA is found mainly in the:', options: ['Nucleus', 'Cytoplasm', 'Cell membrane', 'Vacuole'], correctIndex: 0 },
    { id: 'q-11-3', subject: 'Biology', topicId: 'topic-11', difficulty: 'medium', question: 'In Mendelian genetics, "Tt" means the organism is:', options: ['Heterozygous', 'Homozygous dominant', 'Homozygous recessive', 'Non-viable'], correctIndex: 0 },
    { id: 'q-11-4', subject: 'Biology', topicId: 'topic-11', difficulty: 'medium', question: 'Mitosis results in:', options: ['2 genetically identical daughter cells', '4 different gamete cells', '1 cell with doubled DNA', '2 cells each with half the DNA'], correctIndex: 0 },
    { id: 'q-11-5', subject: 'Biology', topicId: 'topic-11', difficulty: 'medium', question: 'The cell membrane is described as:', options: ['Selectively permeable', 'Completely impermeable', 'Permeable to large molecules only', 'Rigid like a cell wall'], correctIndex: 0 },
    // Biology — Ecology & Environment (topic-12)
    { id: 'q-12-1', subject: 'Biology', topicId: 'topic-12', difficulty: 'easy', question: 'Producers in a food chain are:', options: ['Green plants', 'Herbivores', 'Carnivores', 'Decomposers'], correctIndex: 0 },
    { id: 'q-12-2', subject: 'Biology', topicId: 'topic-12', difficulty: 'easy', question: 'Photosynthesis converts:', options: ['CO₂ + H₂O → glucose + O₂', 'O₂ + glucose → CO₂ + H₂O', 'N₂ + H₂O → protein', 'Glucose → CO₂ only'], correctIndex: 0 },
    { id: 'q-12-3', subject: 'Biology', topicId: 'topic-12', difficulty: 'easy', question: 'The primary source of energy in most ecosystems is:', options: ['The Sun', 'Water', 'Soil', 'Wind'], correctIndex: 0 },
    { id: 'q-12-4', subject: 'Biology', topicId: 'topic-12', difficulty: 'medium', question: 'Decomposers in an ecosystem are mainly:', options: ['Fungi and bacteria', 'Large predators', 'Green plants', 'Insects only'], correctIndex: 0 },
    { id: 'q-12-5', subject: 'Biology', topicId: 'topic-12', difficulty: 'easy', question: 'Biodiversity refers to:', options: ['The variety of life in an area', 'The number of plant species only', 'The level of water pollution', 'The temperature range of an area'], correctIndex: 0 },
  ];
  quizQuestionStore.saveMany(questions);

  localStorage.setItem('eko_seeded_v2', 'true');
}
