"use client"

// Správa passkeys (Touch ID) pro přihlášení. Registrace jde přes
// `/api/passkey/register`, kde probíhá ověření WebAuthn na serveru.

import * as React from "react"
import { Fingerprint, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { motion } from "motion/react"
import { startRegistration } from "@simplewebauthn/browser"

import { fadeInUp } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { formatDate, toLocalISODate } from "@/lib/format"
import { usePasskeyApi, usePasskeys } from "@/lib/store"

export function PasskeysSection() {
  const passkeys = usePasskeys()
  const passkeyApi = usePasskeyApi()
  const [registering, setRegistering] = React.useState(false)

  async function register() {
    setRegistering(true)
    try {
      const optionsJSON = await fetch("/api/passkey/register").then((r) =>
        r.json()
      )
      const response = await startRegistration({ optionsJSON })
      const res = await fetch("/api/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? "Passkey se nepodařilo přidat.")
        return
      }
      toast.success("Passkey přidána")
    } catch (e) {
      if (e instanceof Error && e.name === "InvalidStateError") {
        toast.error("Toto zařízení už je přidané.")
      } else if (!(e instanceof Error && e.name === "NotAllowedError")) {
        toast.error("Passkey se nepodařilo přidat.")
      }
    } finally {
      setRegistering(false)
    }
  }

  async function remove(id: string) {
    await passkeyApi.remove(id)
    toast.success("Passkey odebrána")
  }

  return (
    <motion.section variants={fadeInUp} className="space-y-4">
      <div>
        <h2 className="text-sm">Přihlášení</h2>
        <p className="text-xs text-muted-foreground">
          Místo hesla se můžete přihlásit přes passkey (Touch ID).
        </p>
      </div>

      {passkeys.length > 0 && (
        <ul className="divide-y rounded-2xl border">
          {passkeys.map((p) => (
            <li key={p._id} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <Fingerprint className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  Přidáno {formatDate(toLocalISODate(new Date(p.createdAt)))}
                  {p.lastUsedAt &&
                    ` · naposledy použito ${formatDate(toLocalISODate(new Date(p.lastUsedAt)))}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(p._id)}
                aria-label="Odebrat"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" onClick={register} disabled={registering}>
        {registering ? <Loader2 className="animate-spin" /> : <Fingerprint />}
        Přidat passkey
      </Button>
    </motion.section>
  )
}
