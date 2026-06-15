// Jednoduchá ochrana celé aplikace jedním heslem (APP_PASSWORD).
// Cookie nese token = SHA-256(APP_PASSWORD), aby v ní nikdy nebylo heslo
// v čitelné podobě. Web Crypto API běží jak v edge middleware, tak v Node
// route handlerech, takže stejnou funkci sdílí obě strany.

export const AUTH_COOKIE = "faxterix_auth"

function getPassword(): string {
  const pw = process.env.APP_PASSWORD
  if (!pw) {
    throw new Error("APP_PASSWORD není nastavené v prostředí.")
  }
  return pw
}

/** Token očekávaný v cookie pro aktuální heslo. */
export async function expectedToken(): Promise<string> {
  const data = new TextEncoder().encode(getPassword())
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Ověří, že předané heslo odpovídá APP_PASSWORD. */
export async function verifyPassword(candidate: string): Promise<boolean> {
  return candidate === getPassword()
}

/** Porovná hodnotu cookie s očekávaným tokenem. */
export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  return token === (await expectedToken())
}
