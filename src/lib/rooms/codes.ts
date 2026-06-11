// Genera un código de sala de 6 caracteres alfanumérico en mayúsculas,
// fácil de escribir a mano (sin O/0/I/1 para evitar confusiones).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  return Array.from({ length: 6 }, () =>
    ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join('')
}
