// Preferências locais do visitante. Sempre protegido: o navegador pode bloquear o storage.
const KEY = 'ultimaCotacao'

export function saveLastQuote(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage indisponível */
  }
}

export function getLastQuote(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearLastQuote() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage indisponível */
  }
}
