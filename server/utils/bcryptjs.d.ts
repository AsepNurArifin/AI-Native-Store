/**
 * Deklarasi tipe untuk `bcryptjs@2` — paket ini hanya `index.js` tanpa `.d.ts`
 * sehingga TS melaporkan TS7016 dan meng-tipenya `any`.
 *
 * PENTING: hanya `export default`. bcryptjs 2.x adalah CommonJS murni, jadi ESM
 * named-export (`import { compare } from 'bcryptjs'`) GAGAL saat runtime dengan
 * "Named export 'compare' not found" — meski typecheck-nya lolos.
 * Pola yang benar: default import lalu destructure.
 */
declare module 'bcryptjs' {
  interface BcryptJs {
    compare(plain: string, hashed: string): Promise<boolean>
    genSalt(rounds?: number): Promise<string>
    hash(plain: string, salt: string): Promise<string>
  }
  const bcrypt: BcryptJs
  export default bcrypt
}