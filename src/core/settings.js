// Configurações persistentes (localStorage) com valores padrão.
const KEY = 'alice.settings.v2';

export const DEFAULT_BINDINGS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', crouch: 'KeyC', interact: 'KeyE',
  leanLeft: 'KeyQ', leanRight: 'KeyR', flashlight: 'KeyF',
  inventory: 'KeyI', journal: 'Tab', holdBreath: 'Space',
};

export const BINDING_LABELS = {
  forward: 'Andar para frente', back: 'Andar para trás', left: 'Andar para a esquerda',
  right: 'Andar para a direita', sprint: 'Correr', crouch: 'Agachar', interact: 'Interagir',
  leanLeft: 'Inclinar à esquerda', leanRight: 'Inclinar à direita', flashlight: 'Lanterna',
  inventory: 'Inventário', journal: 'Objetivos e notas', holdBreath: 'Prender a respiração',
};

export const DEFAULTS = {
  sensitivity: 1.0,
  fov: 72,
  master: 0.9, sfx: 1.0, voice: 1.0, music: 0.7,
  subtitles: true, subtitleSize: 1.0,
  voiceSynth: false,  // voz sintetizada do sistema (desligada por padrão)
  headBob: true,
  reduceShake: false,
  reduceDistortion: false,
  reduceFlashing: false,
  showSanityNumber: false,
  difficulty: 'normal',
  resolution: 1.4,       // escala da resolução interna retrô (1.4 = ~380p)
  vertexJitter: false,   // tremor de vértices estilo PS1
  invertY: false,
  bindings: { ...DEFAULT_BINDINGS },
};

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...raw, bindings: { ...DEFAULT_BINDINGS, ...(raw.bindings || {}) } };
  } catch { return { ...DEFAULTS, bindings: { ...DEFAULT_BINDINGS } }; }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* armazenamento indisponível */ }
}

export const DIFFICULTY = {
  easy:   { label: 'Fácil',  sight: 0.65, hearing: 0.6, chaseSpeed: 0.85, batteries: 1.5, sanityRecovery: 1.6, searchOpen: 0.55, drain: 0.7 },
  normal: { label: 'Normal', sight: 1.0,  hearing: 1.0, chaseSpeed: 1.0,  batteries: 1.0, sanityRecovery: 1.0, searchOpen: 1.0,  drain: 1.0 },
  hard:   { label: 'Difícil', sight: 1.3, hearing: 1.45, chaseSpeed: 1.1, batteries: 0.6, sanityRecovery: 0.6, searchOpen: 1.4,  drain: 1.3 },
};
