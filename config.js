/**
 * LOOOPLY - Arquivo de Configuração Centralizado
 * Este arquivo contém todas as configurações globais do aplicativo
 */

const LOOOPLY_CONFIG = {
  // Identidade da Aplicação
  APP: {
    NAME: 'Loooply',
    VERSION: '1.0.0',
    COMPANY: 'MoissWorld',
    DESCRIPTION: 'Cartas aos amigos ;)'
  },

  // Tema de Cores (Material Design inspirado)
  THEME: {
    PRIMARY: '#7010B0',
    PRIMARY_DARK: '#6010A0',
    PRIMARY_DEEP: '#503090',
    DEEP_PURPLE: '#302050',
    SUCCESS: '#35C878',
    ERROR: '#E63232',
    WARNING: '#FF9500',
    SURFACE: '#F5F0FA',
    SURFACE_LILAC: '#F0E0F0',
    TEXT_PRIMARY: '#403050',
    TEXT_SECONDARY: '#7010B0',
    TEXT_MUTED: '#AAA2B0',
    BORDER: '#DED6E5'
  },

  // LocalStorage Keys
  STORAGE: {
    LOGIN_STATE: 'isLoggedIn',
    USERNAME: 'username',
    PROFILE_PIC: 'profilePic',
    CURRENT_CARD: 'currentCard',
    CARDS_READ: 'cardsRead',
    THEME_MODE: 'themeMode',
    LAST_VISIT: 'lastVisit',
    USER_PREFERENCES: 'userPreferences'
  },

  // Usuários autorizados (Simulado - Em produção usar autenticação real)
  USERS: {
    'Patati': {
      password: 'patati@123',
      profilePic: 'user1_perf.png',
      role: 'user',
      email: 'patati@moissworld.com'
    },
    'Misol': {
      password: 'misol@1234000',
      profilePic: 'user2_perf.png',
      role: 'user',
      email: 'misol@moissworld.com'
    },
    'Lilika': {
      password: 'lilika@1234000',
      profilePic: 'user3_perf.png',
      role: 'user',
      email: 'lilika@moissworld.com'
    },
    'YARA': {
      password: 'yaraa@0309',
      profilePic: 'user4_perf.png',
      role: 'user',
      email: 'yara@moissworld.com'
    }
  },

  // APIs e endpoints
  API: {
    YOUTUBE_KEY: 'AIzaSyDrJdOQ9y5SxLR_1_nNt8fY5DGNIg8pskU',
    YOUTUBE_PLAYLIST_ID: 'PLMeQ_QyqhY7s',
    YOUTUBE_API_URL: 'https://www.googleapis.com/youtube/v3/playlistItems',
    MEDIA_INDEX: 'midia-index.json',
    MAX_PLAYLIST_RESULTS: 50
  },

  // Navegação
  ROUTES: {
    SPLASH: 'index.html',
    LOGIN: 'login.html',
    HOME: 'home.html',
    GALERIA: 'galeria.html',
    MUSICAS: 'musicas.html'
  },

  // Mensagens da Aplicação
  MESSAGES: {
    WELCOME: 'Bem-vindo ao Loooply!',
    LOGIN_SUCCESS: 'Login realizado com sucesso!',
    LOGIN_FAILED: 'Usuário ou senha inválidos.',
    SESSION_EXPIRED: 'Sua sessão expirou. Por favor, faça login novamente.',
    LOGOUT_SUCCESS: 'Você saiu com sucesso.',
    LOADING: 'Carregando...',
    ERROR: 'Ocorreu um erro. Tente novamente.',
    NO_DATA: 'Nenhum dado encontrado.'
  },

  // Limites e Restrições
  LIMITS: {
    PASSWORD_MIN_LENGTH: 6,
    USERNAME_MIN_LENGTH: 2,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 5 * 60 * 1000 // 5 minutos
  },

  // Recursos e Features
  FEATURES: {
    GALERIA_ENABLED: true,
    MUSICAS_ENABLED: true,
    CALENDAR_ENABLED: true,
    OFFLINE_MODE: false,
    DEBUG_MODE: false
  }
};

// Exportar configuração
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LOOOPLY_CONFIG;
}
