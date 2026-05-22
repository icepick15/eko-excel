'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, CORE_SUBJECTS } from '@/lib/types';
import Navbar from '@/components/Navbar';

// ── Simulated AI response engine ──────────────────────────────────────────────

const RESPONSES: Record<string, Array<{ keywords: string[]; answer: string }>> = {
  'Mathematics': [
    { keywords: ['quadratic', 'x²', 'x2', 'factoris', 'roots'], answer: 'A quadratic equation has the form ax² + bx + c = 0. Solve it by:\n① Factorising: find two numbers that multiply to ac and add to b.\n② Quadratic formula: x = (−b ± √(b²−4ac)) / 2a\n③ Completing the square.\n\nFor WAEC, always state both roots and check your answer by substituting back.' },
    { keywords: ['trigonometry', 'sin', 'cos', 'tan', 'angle'], answer: 'Key WAEC trig values to memorise:\n• sin 30° = ½,  cos 30° = √3/2\n• sin 45° = cos 45° = 1/√2\n• sin 60° = √3/2,  cos 60° = ½\n• tan 45° = 1,  tan 60° = √3\n\nSOHCAHTOA: Sin = Opposite/Hypotenuse, Cos = Adjacent/Hypotenuse, Tan = Opposite/Adjacent.' },
    { keywords: ['probability', 'statistics', 'mean', 'median', 'mode'], answer: 'Statistics basics:\n• Mean = sum of values ÷ number of values\n• Median = middle value when sorted\n• Mode = most frequent value\n\nFor probability: P(event) = favourable outcomes ÷ total outcomes. Always check P(A) + P(not A) = 1.' },
    { keywords: ['indices', 'power', 'exponent', 'logarithm', 'log'], answer: 'Index laws:\n• aᵐ × aⁿ = aᵐ⁺ⁿ\n• aᵐ ÷ aⁿ = aᵐ⁻ⁿ\n• (aᵐ)ⁿ = aᵐⁿ\n• a⁰ = 1,  a⁻ⁿ = 1/aⁿ\n\nLogarithm: logₐ(x) = y means aʸ = x. Remember: log(AB) = log A + log B.' },
    { keywords: ['geometry', 'circle', 'triangle', 'area', 'perimeter'], answer: 'Essential formulas:\n• Circle: Area = πr², Circumference = 2πr\n• Triangle: Area = ½ × base × height\n• Pythagoras: a² + b² = c² (right-angled triangle)\n\nFor WAEC, always draw a diagram and label your measurements.' },
    { keywords: ['sequence', 'series', 'arithmetic', 'geometric', 'progression'], answer: 'Arithmetic Progression (AP):\n• nth term: aₙ = a + (n−1)d\n• Sum: Sₙ = n/2 × (2a + (n−1)d)\n\nGeometric Progression (GP):\n• nth term: aₙ = arⁿ⁻¹\n• Sum: Sₙ = a(rⁿ−1)/(r−1) when r≠1\n\nwhere a = first term, d = common difference, r = common ratio.' },
  ],
  'English Language': [
    { keywords: ['comprehension', 'passage', 'reading', 'question'], answer: 'WAEC Comprehension strategy:\n① Read all questions FIRST before reading the passage.\n② Skim the passage for the main idea.\n③ Read carefully, underlining answers as you find them.\n④ Answer in your own words unless told to quote directly.\n⑤ Never copy the whole sentence — extract only what answers the question.' },
    { keywords: ['essay', 'writing', 'composition', 'formal', 'informal', 'letter'], answer: 'Essay structure for WAEC:\n• Introduction: state your main point clearly (2–3 sentences)\n• Body: 3 paragraphs, each with ONE idea supported by examples\n• Conclusion: summarise, do not introduce new ideas\n\nFor formal letters: include address, date, salutation, subject line. Sign off "Yours faithfully" (if name unknown) or "Yours sincerely" (if named).' },
    { keywords: ['grammar', 'tense', 'verb', 'noun', 'pronoun', 'adjective'], answer: 'Common WAEC grammar points:\n• Subject-verb agreement: "The group of students IS here" (singular collective noun)\n• Tenses: Past perfect (had + past participle) for action before another past action\n• Pronoun: "between you and ME" (not I) — object pronoun after preposition\n• Avoid double negatives: "I did not do ANYTHING" (not nothing)' },
    { keywords: ['summary', 'summarise', 'main points'], answer: 'Summary writing rules:\n① Identify the number of points required (usually 5)\n② Use your own words entirely\n③ One idea per sentence — no examples or elaboration\n④ Write in continuous prose, not bullet points\n⑤ Stay within the word limit (usually 120 words)\n⑥ Number your points if instructed' },
    { keywords: ['vocabulary', 'word', 'meaning', 'synonym', 'antonym'], answer: 'Vocabulary building tips for WAEC:\n• Learn 5 new words daily from past WAEC papers\n• Contextual clues: use surrounding words to infer meaning\n• Common roots: "bene" = good (benefit, benevolent), "mal" = bad (malice, malfunction)\n• Practice antonyms and synonyms — they appear regularly in Paper 1' },
  ],
  'Physics': [
    { keywords: ['velocity', 'speed', 'acceleration', 'motion', 'distance', 'displacement'], answer: 'Motion equations (SUVAT) for uniform acceleration:\n• v = u + at\n• s = ut + ½at²\n• v² = u² + 2as\n• s = ½(u + v)t\n\nRemember: velocity is a vector (direction matters), speed is scalar. Acceleration due to gravity g = 10 m/s² (WAEC standard).' },
    { keywords: ['force', 'newton', 'mass', 'weight', 'gravity'], answer: "Newton's Laws:\n① An object stays at rest or uniform motion unless acted on by a force\n② F = ma (Force = mass × acceleration)\n③ Every action has an equal and opposite reaction\n\nWeight = mg (mass × gravitational field strength)\nFor WAEC: always convert mass to kg and use g = 10 m/s²" },
    { keywords: ['electricity', 'current', 'voltage', 'resistance', 'ohm', 'circuit'], answer: "Ohm's Law: V = IR (Voltage = Current × Resistance)\n\nSeries circuit: Rₜ = R₁ + R₂ + R₃, same current throughout\nParallel circuit: 1/Rₜ = 1/R₁ + 1/R₂, same voltage across each branch\n\nPower: P = IV = I²R = V²/R\nEnergy: E = Pt (Power × time)" },
    { keywords: ['wave', 'frequency', 'wavelength', 'amplitude', 'sound', 'light'], answer: 'Wave equation: v = fλ (wave speed = frequency × wavelength)\n\nKey facts:\n• Sound: longitudinal wave, needs a medium, speed ≈ 340 m/s in air\n• Light: transverse wave, travels in vacuum, speed = 3×10⁸ m/s\n• Frequency (f) in Hz, Wavelength (λ) in metres\n• Period T = 1/f' },
    { keywords: ['energy', 'work', 'power', 'kinetic', 'potential'], answer: 'Energy equations:\n• Work done: W = Fd (Force × distance)\n• Kinetic energy: KE = ½mv²\n• Gravitational PE: PE = mgh\n• Power: P = W/t = Fv\n• Efficiency = (useful output / total input) × 100%\n\nEnergy is conserved — it changes form but total stays the same.' },
  ],
  'Chemistry': [
    { keywords: ['atom', 'electron', 'proton', 'neutron', 'element', 'periodic table'], answer: 'Atomic structure:\n• Protons: positive charge, in nucleus, = atomic number\n• Neutrons: no charge, in nucleus\n• Electrons: negative charge, in shells (2, 8, 8, …)\n• Mass number = protons + neutrons\n• Isotopes: same protons, different neutrons\n\nPeriodic table groups: Group I = alkali metals, Group VII = halogens, Group 0 = noble gases.' },
    { keywords: ['bonding', 'ionic', 'covalent', 'metallic', 'bond'], answer: 'Chemical bonding:\n• Ionic: metal + non-metal, transfer of electrons, forms giant lattice. High melting point, conducts when molten.\n• Covalent: non-metal + non-metal, sharing electrons. Can be simple molecular (low MP) or giant covalent (high MP).\n• Metallic: metal atoms, sea of delocalised electrons. Good conductor.\n\nFor WAEC: draw dot-and-cross diagrams for ionic and covalent bonds.' },
    { keywords: ['reaction', 'acid', 'base', 'alkali', 'ph', 'neutralisation'], answer: 'Acids and bases:\n• Acid: pH < 7, produces H⁺ ions in water\n• Alkali: pH > 7, produces OH⁻ ions in water\n• Neutralisation: acid + base → salt + water\n• Strong acids: HCl, H₂SO₄, HNO₃\n• Strong bases: NaOH, KOH\n\nSalt name = metal name + acid name (e.g., NaCl = sodium chloride from NaOH + HCl).' },
    { keywords: ['organic', 'alkane', 'alkene', 'alcohol', 'carbon', 'hydrocarbon'], answer: 'Organic chemistry basics:\n• Alkanes: CₙH₂ₙ₊₂ (saturated, single bonds only)\n• Alkenes: CₙH₂ₙ (unsaturated, have C=C double bond)\n• Alcohols: contain −OH group\n• Carboxylic acids: contain −COOH group\n\nTest for alkene: decolourises bromine water. Alkanes do not react with bromine water.' },
    { keywords: ['electrolysis', 'electrode', 'cathode', 'anode', 'ion'], answer: 'Electrolysis:\n• Cathode (negative): positive ions (cations) are reduced here\n• Anode (positive): negative ions (anions) are oxidised here\n• Memory: OILRIG — Oxidation Is Loss, Reduction Is Gain (of electrons)\n\nFor molten NaCl: Na⁺ → Na at cathode, Cl⁻ → Cl₂ at anode\nFor aqueous solutions: H⁺ displaced at cathode if metal is above hydrogen in reactivity series.' },
  ],
  'Biology': [
    { keywords: ['cell', 'nucleus', 'mitochondria', 'organelle', 'membrane'], answer: 'Cell organelles:\n• Nucleus: contains DNA, controls cell activities\n• Mitochondria: site of aerobic respiration (ATP production)\n• Ribosome: site of protein synthesis\n• Cell membrane: selectively permeable, controls what enters/exits\n• Chloroplast (plant only): site of photosynthesis\n• Cell wall (plant only): rigid, made of cellulose, gives shape' },
    { keywords: ['photosynthesis', 'chlorophyll', 'glucose', 'carbon dioxide', 'light'], answer: 'Photosynthesis equation:\n6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂\n\nConditions needed: light, water, CO₂, chlorophyll\nProducts: glucose (stored as starch) + oxygen\n\nLeaf adaptations: broad surface, thin, many stomata, network of veins for water transport.\nFor WAEC: always link structure to function.' },
    { keywords: ['respiration', 'atp', 'energy', 'oxygen', 'aerobic', 'anaerobic'], answer: 'Aerobic respiration:\nC₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP (energy)\n\nAnaerobic respiration (no oxygen):\n• In animals/humans: glucose → lactic acid + a little ATP\n• In yeast/plants: glucose → ethanol + CO₂ + a little ATP\n\nAerobic produces ~36 ATP. Anaerobic produces only 2 ATP — much less efficient.' },
    { keywords: ['genetics', 'dna', 'gene', 'allele', 'dominant', 'recessive', 'heredity'], answer: 'Genetics basics:\n• Gene: section of DNA coding for a characteristic\n• Allele: alternative form of a gene\n• Dominant: expressed even with one copy (capital letter, e.g. T)\n• Recessive: only expressed when two copies present (e.g. tt)\n• Genotype: genetic makeup (TT, Tt, tt)\n• Phenotype: physical appearance\n\nFor Punnett squares: always set up the grid with parent alleles on each side, then fill in.' },
    { keywords: ['ecology', 'food chain', 'ecosystem', 'habitat', 'population', 'producer'], answer: 'Ecology terms:\n• Producer: organism that makes its own food (green plants via photosynthesis)\n• Consumer: organism that eats others (herbivore, carnivore, omnivore)\n• Decomposer: breaks down dead material (bacteria, fungi)\n• Food chain shows energy flow: Producer → Primary consumer → Secondary consumer\n• Energy is lost at each level (~90%) — so food chains rarely exceed 5 levels\n• Biomass decreases up the chain (ecological pyramids)' },
  ],
};

const FALLBACK = [
  'That\'s a great question! Let me give you a general tip: break the topic into smaller parts, find the underlying rule or formula, then practise 3–5 exam questions on it. Which specific part is confusing you?',
  'For WAEC success, focus on understanding the concept rather than memorising. Can you tell me more specifically what part you\'re stuck on? I can give you a targeted explanation.',
  'Try this approach: write down what you already know about this topic, then identify exactly what\'s missing. Past WAEC questions are the best practice — they repeat patterns every year.',
];

function getResponse(subject: string, input: string): string {
  const lower = input.toLowerCase();
  const bank = RESPONSES[subject] ?? [];
  const match = bank.find((r) => r.keywords.some((k) => lower.includes(k)));
  if (match) return match.answer;
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}

// ── component ─────────────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'tutor'; text: string; }

export default function TutorPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState(CORE_SUBJECTS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'tutor', text: `Hello! I'm your EkoExcel AI Tutor. I'm here to help you with ${CORE_SUBJECTS[0]}. What would you like to understand today?` },
  ]);
  const [input, setInput]     = useState('');
  const [typing, setTyping]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.STUDENT && user.role !== Role.TEACHER) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  function changeSubject(s: string) {
    setSubject(s);
    setMessages([{ role: 'tutor', text: `Switched to ${s}! I can help you understand any topic in ${s}. What are you working on?` }]);
    setInput('');
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const answer = getResponse(subject, text);
      setTyping(false);
      setMessages((prev) => [...prev, { role: 'tutor', text: answer }]);
    }, 900 + Math.random() * 600);
  }

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F7FA' }}>
      <Navbar />

      {/* Subject selector */}
      <div className="sticky top-0 z-10 px-4 py-2 overflow-x-auto" style={{ background: '#0033A0' }}>
        <div className="flex gap-2 max-w-2xl mx-auto">
          {CORE_SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => changeSubject(s)}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0"
              style={{
                background: subject === s ? '#FFCC00' : 'rgba(255,255,255,0.15)',
                color: subject === s ? '#0033A0' : 'white',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'tutor' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mr-2 mt-1"
                  style={{ background: '#0033A0', color: '#FFCC00' }}>
                  AI
                </div>
              )}
              <div
                className="max-w-xs sm:max-w-sm rounded-2xl px-4 py-3 text-sm whitespace-pre-line"
                style={{
                  background: msg.role === 'user' ? '#0033A0' : 'white',
                  color: msg.role === 'user' ? 'white' : '#111827',
                  border: msg.role === 'tutor' ? '1.5px solid #E5E7EB' : 'none',
                  borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                  borderBottomLeftRadius: msg.role === 'tutor' ? 4 : undefined,
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: '#0033A0', color: '#FFCC00' }}>AI</div>
              <div className="px-4 py-3 rounded-2xl" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                <div className="flex gap-1">
                  {[0,1,2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full" style={{ background: '#9CA3AF', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="px-4 pb-2 max-w-2xl mx-auto w-full overflow-x-auto">
        <div className="flex gap-2">
          {getSuggestions(subject).map((s) => (
            <button key={s} onClick={() => { setInput(s); }}
              className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
              style={{ background: '#EFF6FF', color: '#0033A0', border: '1.5px solid #BFDBFE' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-6 max-w-2xl mx-auto w-full">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl px-4 py-3 text-sm"
            style={{ border: '1.5px solid #E5E7EB', background: 'white' }}
            placeholder={`Ask about ${subject}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          />
          <button
            onClick={send}
            disabled={!input.trim() || typing}
            className="px-4 py-3 rounded-xl font-bold text-sm"
            style={{ background: input.trim() && !typing ? '#0033A0' : '#D1D5DB', color: 'white' }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

function getSuggestions(subject: string): string[] {
  const map: Record<string, string[]> = {
    'Mathematics':      ['How do I solve quadratic equations?', 'Explain trigonometry ratios', 'What is a geometric progression?'],
    'English Language': ['How to write a formal letter?', 'Tips for comprehension questions', 'Grammar rules for WAEC'],
    'Physics':          ['Explain Newton\'s laws', 'How to calculate velocity?', 'Ohm\'s law explained'],
    'Chemistry':        ['What is ionic bonding?', 'Explain acid-base reactions', 'Organic chemistry basics'],
    'Biology':          ['How does photosynthesis work?', 'Explain DNA and genetics', 'What is aerobic respiration?'],
  };
  return map[subject] ?? [];
}
