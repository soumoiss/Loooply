/**
 * LOOOPLY - Utilitários Compartilhados
 * Funções comuns e helpers reutilizáveis em toda a aplicação
 */

const Utils = {
  /**
   * Gerenciamento de Autenticação
   */
  Auth: {
    /**
     * Fazer login
     * @param {string} username - Nome do usuário
     * @param {string} password - Senha
     * @returns {boolean} - Sucesso do login
     */
    login: function(username, password) {
      const user = LOOOPLY_CONFIG.USERS[username];
      
      if (!user || user.password !== password) {
        return false;
      }

      localStorage.setItem(LOOOPLY_CONFIG.STORAGE.LOGIN_STATE, 'true');
      localStorage.setItem(LOOOPLY_CONFIG.STORAGE.USERNAME, username);
      localStorage.setItem(LOOOPLY_CONFIG.STORAGE.PROFILE_PIC, user.profilePic);
      localStorage.setItem(LOOOPLY_CONFIG.STORAGE.LAST_VISIT, new Date().toISOString());
      
      return true;
    },

    /**
     * Fazer logout
     */
    logout: function() {
      localStorage.removeItem(LOOOPLY_CONFIG.STORAGE.LOGIN_STATE);
      localStorage.removeItem(LOOOPLY_CONFIG.STORAGE.USERNAME);
      localStorage.removeItem(LOOOPLY_CONFIG.STORAGE.PROFILE_PIC);
      window.location.href = LOOOPLY_CONFIG.ROUTES.LOGIN;
    },

    /**
     * Verificar se está logado
     * @returns {boolean}
     */
    isLoggedIn: function() {
      return localStorage.getItem(LOOOPLY_CONFIG.STORAGE.LOGIN_STATE) === 'true';
    },

    /**
     * Obter usuário atual
     * @returns {string|null}
     */
    getCurrentUser: function() {
      return localStorage.getItem(LOOOPLY_CONFIG.STORAGE.USERNAME);
    },

    /**
     * Obter foto do perfil
     * @returns {string|null}
     */
    getProfilePic: function() {
      return localStorage.getItem(LOOOPLY_CONFIG.STORAGE.PROFILE_PIC);
    },

    /**
     * Obter informações do usuário
     * @returns {object|null}
     */
    getUserInfo: function() {
      const username = this.getCurrentUser();
      if (!username) return null;
      
      return {
        username,
        ...LOOOPLY_CONFIG.USERS[username],
        profilePic: this.getProfilePic()
      };
    }
  },

  /**
   * Gerenciamento de DOM
   */
  DOM: {
    /**
     * Selecionar elemento
     * @param {string} selector - Seletor CSS
     * @returns {Element}
     */
    select: function(selector) {
      return document.querySelector(selector);
    },

    /**
     * Selecionar múltiplos elementos
     * @param {string} selector - Seletor CSS
     * @returns {NodeList}
     */
    selectAll: function(selector) {
      return document.querySelectorAll(selector);
    },

    /**
     * Adicionar evento
     * @param {Element} element - Elemento
     * @param {string} event - Tipo de evento
     * @param {function} callback - Callback
     */
    on: function(element, event, callback) {
      if (element) element.addEventListener(event, callback);
    },

    /**
     * Remover evento
     * @param {Element} element - Elemento
     * @param {string} event - Tipo de evento
     * @param {function} callback - Callback
     */
    off: function(element, event, callback) {
      if (element) element.removeEventListener(event, callback);
    },

    /**
     * Adicionar classe
     * @param {Element} element - Elemento
     * @param {string} className - Nome da classe
     */
    addClass: function(element, className) {
      if (element) element.classList.add(className);
    },

    /**
     * Remover classe
     * @param {Element} element - Elemento
     * @param {string} className - Nome da classe
     */
    removeClass: function(element, className) {
      if (element) element.classList.remove(className);
    },

    /**
     * Alternar classe
     * @param {Element} element - Elemento
     * @param {string} className - Nome da classe
     */
    toggleClass: function(element, className) {
      if (element) element.classList.toggle(className);
    },

    /**
     * Verificar se tem classe
     * @param {Element} element - Elemento
     * @param {string} className - Nome da classe
     * @returns {boolean}
     */
    hasClass: function(element, className) {
      return element ? element.classList.contains(className) : false;
    },

    /**
     * Definir conteúdo
     * @param {Element} element - Elemento
     * @param {string} content - Conteúdo
     */
    setContent: function(element, content) {
      if (element) element.textContent = content;
    },

    /**
     * Obter conteúdo
     * @param {Element} element - Elemento
     * @returns {string}
     */
    getContent: function(element) {
      return element ? element.textContent : '';
    }
  },

  /**
   * Utilitários de String
   */
  String: {
    /**
     * Capitalizar primeira letra
     * @param {string} str - String
     * @returns {string}
     */
    capitalize: function(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * Truncar string
     * @param {string} str - String
     * @param {number} length - Comprimento máximo
     * @returns {string}
     */
    truncate: function(str, length = 50) {
      if (!str || str.length <= length) return str;
      return str.substring(0, length) + '...';
    },

    /**
     * Escapar caracteres especiais
     * @param {string} str - String
     * @returns {string}
     */
    escape: function(str) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return str.replace(/[&<>"']/g, (char) => map[char]);
    },

    /**
     * Remover espaços
     * @param {string} str - String
     * @returns {string}
     */
    trim: function(str) {
      return str ? str.trim().replace(/\s+/g, ' ') : '';
    }
  },

  /**
   * Utilitários de Array
   */
  Array: {
    /**
     * Ordenar array
     * @param {array} arr - Array
     * @param {string} key - Chave para ordenar
     * @param {string} order - 'asc' ou 'desc'
     * @returns {array}
     */
    sortBy: function(arr, key, order = 'asc') {
      return [...arr].sort((a, b) => {
        if (order === 'asc') {
          return a[key] > b[key] ? 1 : -1;
        } else {
          return a[key] < b[key] ? 1 : -1;
        }
      });
    },

    /**
     * Filtrar array único
     * @param {array} arr - Array
     * @param {string} key - Chave para filtrar
     * @returns {array}
     */
    unique: function(arr, key = null) {
      if (!key) return [...new Set(arr)];
      return [...new Map(arr.map((item) => [item[key], item])).values()];
    }
  },

  /**
   * Utilitários de Tempo
   */
  Time: {
    /**
     * Formatar data
     * @param {Date|string} date - Data
     * @param {string} format - Formato desejado
     * @returns {string}
     */
    format: function(date, format = 'DD/MM/YYYY') {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      
      return format
        .replace('DD', day)
        .replace('MM', month)
        .replace('YYYY', year);
    },

    /**
     * Obter diferença entre datas
     * @param {Date} date1 - Primeira data
     * @param {Date} date2 - Segunda data
     * @returns {number} - Diferença em ms
     */
    diff: function(date1, date2) {
      return new Date(date2) - new Date(date1);
    },

    /**
     * Verificar se é hoje
     * @param {Date} date - Data
     * @returns {boolean}
     */
    isToday: function(date) {
      const today = new Date();
      const d = new Date(date);
      return d.toDateString() === today.toDateString();
    }
  },

  /**
   * Utilitários de Armazenamento
   */
  Storage: {
    /**
     * Salvar no localStorage
     * @param {string} key - Chave
     * @param {*} value - Valor
     */
    set: function(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
      }
    },

    /**
     * Obter do localStorage
     * @param {string} key - Chave
     * @returns {*}
     */
    get: function(key) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (e) {
        console.error('Erro ao obter do localStorage:', e);
        return null;
      }
    },

    /**
     * Remover do localStorage
     * @param {string} key - Chave
     */
    remove: function(key) {
      localStorage.removeItem(key);
    },

    /**
     * Limpar localStorage
     */
    clear: function() {
      localStorage.clear();
    }
  },

  /**
   * Utilitários de Validação
   */
  Validate: {
    /**
     * Validar email
     * @param {string} email - Email
     * @returns {boolean}
     */
    email: function(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    },

    /**
     * Validar senha
     * @param {string} password - Senha
     * @returns {boolean}
     */
    password: function(password) {
      return password && password.length >= LOOOPLY_CONFIG.LIMITS.PASSWORD_MIN_LENGTH;
    },

    /**
     * Validar nome de usuário
     * @param {string} username - Nome de usuário
     * @returns {boolean}
     */
    username: function(username) {
      return username && username.length >= LOOOPLY_CONFIG.LIMITS.USERNAME_MIN_LENGTH;
    }
  },

  /**
   * Utilitários de Notificação
   */
  Notify: {
    /**
     * Mostrar toast
     * @param {string} message - Mensagem
     * @param {string} type - 'success', 'error', 'info'
     * @param {number} duration - Duração em ms
     */
    toast: function(message, type = 'info', duration = 3000) {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#35C878' : type === 'error' ? '#E63232' : '#7010B0'};
        color: white;
        border-radius: 8px;
        z-index: 9999;
        font-size: 14px;
        font-weight: 600;
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), duration);
    }
  },

  /**
   * Utilitários de Fetch/API
   */
  HTTP: {
    /**
     * GET request
     * @param {string} url - URL
     * @param {object} options - Opções
     * @returns {Promise}
     */
    get: async function(url, options = {}) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          ...options
        });
        return response.json();
      } catch (error) {
        console.error('Erro na requisição GET:', error);
        throw error;
      }
    },

    /**
     * POST request
     * @param {string} url - URL
     * @param {object} data - Dados
     * @param {object} options - Opções
     * @returns {Promise}
     */
    post: async function(url, data = {}, options = {}) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          ...options
        });
        return response.json();
      } catch (error) {
        console.error('Erro na requisição POST:', error);
        throw error;
      }
    }
  },

  /**
   * Verificar suporte a recursos
   */
  Support: {
    /**
     * Verificar se LocalStorage está disponível
     * @returns {boolean}
     */
    hasLocalStorage: function() {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Verificar se está online
     * @returns {boolean}
     */
    isOnline: function() {
      return navigator.onLine;
    }
  }
};

// Exportar utilidades
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
