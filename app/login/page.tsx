"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Fingerprint, Lock } from "lucide-react"
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  )
}

const noopSubscribe = () => () => {}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  // Podpora WebAuthn jde zjistit jen v prohlížeči; na serveru tlačítko skryjeme.
  const passkeySupported = React.useSyncExternalStore(
    noopSubscribe,
    browserSupportsWebAuthn,
    () => false
  )

  function redirectAfterLogin() {
    const from = searchParams.get("from")
    router.replace(from && from.startsWith("/") ? from : "/")
    router.refresh()
  }

  async function loginWithPasskey() {
    setLoading(true)
    setError(null)
    try {
      const optionsJSON = await fetch("/api/passkey/login").then((r) =>
        r.json()
      )
      const response = await startAuthentication({ optionsJSON })
      const res = await fetch("/api/passkey/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Přihlášení přes passkey se nezdařilo.")
        setLoading(false)
        return
      }
      redirectAfterLogin()
    } catch (e) {
      // Zavřený dialog Touch ID není chyba, kterou by bylo potřeba hlásit.
      const cancelled = e instanceof Error && e.name === "NotAllowedError"
      if (!cancelled) setError("Přihlášení přes passkey se nezdařilo.")
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Přihlášení se nezdařilo.")
        setLoading(false)
        return
      }
      redirectAfterLogin()
    } catch {
      setError("Přihlášení se nezdařilo.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Lock className="size-6" strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">FAXTERIX</h1>
            <p className="text-sm text-muted-foreground">
              Zadejte heslo pro přístup
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Heslo</Label>
          <Input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !password}
        >
          {loading ? "Ověřuji…" : "Vstoupit"}
        </Button>

        {passkeySupported && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={loginWithPasskey}
          >
            <Fingerprint />
            Přihlásit přes passkey
          </Button>
        )}
      </form>
    </div>
  )
}
