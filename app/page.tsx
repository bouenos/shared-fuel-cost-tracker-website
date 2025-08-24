"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Fuel, History, Loader2, LogOut, Send, Settings, Undo2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { addMileageEntry, loadAppState, resetAndGetMessage, undoLastEntry, updateSettings } from "./actions"

type User = "Amit" | "John"

const CODES_TO_USER: Record<string, User> = {
  "1337": "Amit",
  "1234": "John",
}

type Entry = {
  id: string
  type: "init" | "entry" | "reset"
  timestamp: number
  reading?: number
  deltaKm?: number
  attributedTo?: User
  enteredBy?: User
  note?: string
  snapshot?: {
    kmBy: Record<User, number>
    pricePerKm: number
    totalKm: number
    totalAmount: number
  }
}

type AppState = {
  version: number
  pricePerKm: number
  startingOdometer: number
  lastOdometer: number | null
  kmBy: Record<User, number>
  history: Entry[]
  lastEnteredBy: User | null
}

const SESSION_KEY = "fuel-split-session-user"

function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n)
  } catch {
    return `₪${n.toFixed(2)}`
  }
}

export default function Page() {
  // Session
  const [sessionUser, setSessionUser] = useState<User | null>(null)
  const [state, setState] = useState<AppState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = window.localStorage.getItem(SESSION_KEY)
    if (saved) setSessionUser(saved as User)
  }, [])

  // Load state from database
  useEffect(() => {
    async function loadState() {
      try {
        setLoading(true)
        const appState = await loadAppState()
        setState(appState)
        setError(null)
      } catch (err) {
        console.error("Failed to load state:", err)
        setError("Failed to load data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    if (sessionUser) {
      loadState()
    }
  }, [sessionUser])

  // Derived values
  const totalKm = state ? state.kmBy.Amit + state.kmBy.John : 0
  const totalAmount = state ? totalKm * state.pricePerKm : 0
  const amounts = state
    ? {
        Amit: state.kmBy.Amit * state.pricePerKm,
        John: state.kmBy.John * state.pricePerKm,
      }
    : { Amit: 0, John: 0 }

  // UI State
  const [code, setCode] = useState("")
  const [mileageValue, setMileageValue] = useState<string>("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Undo stack (only last mileage entry)
  const lastEntry = useMemo(() => {
    if (!state) return null
    for (let i = state.history.length - 1; i >= 0; i--) {
      if (state.history[i].type === "entry") return state.history[i]
    }
    return null
  }, [state])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const user = CODES_TO_USER[code.trim()]
    if (!user) {
      alert("Invalid code")
      return
    }
    setSessionUser(user)
    if (typeof window !== "undefined") window.localStorage.setItem(SESSION_KEY, user)
  }

  function logout() {
    setSessionUser(null)
    setState(null)
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY)
  }

  async function addMileage() {
    if (!sessionUser || !state) return
    const reading = Number(mileageValue)
    if (!Number.isFinite(reading) || reading < 0) {
      alert("Please enter a valid mileage (km).")
      return
    }

    try {
      setActionLoading(true)
      const newState = await addMileageEntry(sessionUser, reading, state)
      setState(newState)
      setMileageValue("")
    } catch (err: any) {
      alert(err.message || "Failed to add mileage. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  async function undoLast() {
    if (!lastEntry || !state) return

    try {
      setActionLoading(true)
      const newState = await undoLastEntry(state)
      setState(newState)
    } catch (err: any) {
      alert(err.message || "Failed to undo. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  function openWhatsAppWithMessage(msg: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank")
  }

  async function doResetAndShare() {
    if (!state) return

    try {
      setActionLoading(true)
      const { message, newState } = await resetAndGetMessage(state)
      setState(newState)
      openWhatsAppWithMessage(message)
    } catch (err: any) {
      alert(err.message || "Failed to reset. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  async function saveSettings(newPricePerKm: number, newStartingOdo: number) {
    if (!state) return

    try {
      setActionLoading(true)
      const newState = await updateSettings(newPricePerKm, newStartingOdo, state)
      setState(newState)
      setSettingsOpen(false)
    } catch (err: any) {
      alert(err.message || "Failed to save settings. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  // Forms controlled state for settings
  const [priceInput, setPriceInput] = useState<string>("")
  const [startOdoInput, setStartOdoInput] = useState<string>("")
  useEffect(() => {
    if (state) {
      setPriceInput(String(state.pricePerKm))
      setStartOdoInput(String(state.startingOdometer))
    }
  }, [settingsOpen, state])

  // Loading or error states
  if (!sessionUser) {
    return (
      <div className="dark">
        <main className="min-h-screen bg-zinc-950 text-zinc-50">
          <div className="mx-auto max-w-sm p-4 pt-12">
            <Card className="shadow-sm bg-zinc-900 border-zinc-800">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-purple-400" />
                  <CardTitle className="text-zinc-100">Fuel Split Login</CardTitle>
                </div>
                <CardDescription className="text-zinc-400">
                  Enter your one-time code. Only Amit and John can access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="code" className="text-zinc-300">
                      Access Code
                    </Label>
                    <Input
                      id="code"
                      className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Enter your code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <span>{"Ask Amit for the code."}</span>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white border-0">
                    Enter
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="dark">
        <main className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            <span className="text-zinc-300">Loading...</span>
          </div>
        </main>
      </div>
    )
  }

  if (error || !state) {
    return (
      <div className="dark">
        <main className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
          <div className="mx-auto max-w-sm p-4">
            <Card className="shadow-sm bg-zinc-900 border-zinc-800">
              <CardContent className="pt-6 text-center">
                <p className="text-zinc-300 mb-4">{error || "Failed to load data"}</p>
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-purple-600 hover:bg-purple-500 text-white border-0"
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dark">
      <main className="min-h-screen bg-zinc-950 text-zinc-50">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur border-b border-zinc-800">
          <div className="mx-auto max-w-sm px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-purple-400" />
              <div className="font-medium text-zinc-100">Fuel Split</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* History */}
              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800">
                    <History className="h-5 w-5" />
                    <span className="sr-only">History</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="top"
                  className="max-h-[85vh] overflow-y-auto bg-zinc-900 text-zinc-50 border-zinc-800 mx-0 px-4 py-0 pb-4"
                >
                  <SheetHeader>
                    <SheetTitle>History</SheetTitle>
                    <SheetDescription className="text-zinc-400">Mileage entries and resets.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-3 space-y-3">
                    {state.history.length === 0 && <div className="text-sm text-zinc-400">No history yet.</div>}
                    {state.history
                      .slice()
                      .reverse()
                      .map((e) => {
                        const d = new Date(e.timestamp).toLocaleString()
                        if (e.type === "reset") {
                          return (
                            <div key={e.id} className="rounded-lg border border-zinc-800 p-3 bg-zinc-950">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">Reset</div>
                                <Badge variant="secondary" className="bg-zinc-800 text-zinc-200 border-0">
                                  {d}
                                </Badge>
                              </div>
                              <div className="mt-2 grid gap-1 text-sm">
                                <div className="flex items-center justify-between">
                                  <span>Amit</span>
                                  <span>
                                    {e.snapshot
                                      ? `${e.snapshot.kmBy.Amit} km • ${formatCurrency(
                                          e.snapshot.kmBy.Amit * e.snapshot.pricePerKm,
                                        )}`
                                      : "-"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>John</span>
                                  <span>
                                    {e.snapshot
                                      ? `${e.snapshot.kmBy.John} km • ${formatCurrency(
                                          e.snapshot.kmBy.John * e.snapshot.pricePerKm,
                                        )}`
                                      : "-"}
                                  </span>
                                </div>
                                <Separator className="my-2 bg-zinc-800" />
                                <div className="flex items-center justify-between">
                                  <span>Total</span>
                                  <span className="font-medium">
                                    {e.snapshot
                                      ? `${e.snapshot.totalKm} km • ${formatCurrency(e.snapshot.totalAmount)}`
                                      : "-"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        // entry or init
                        return (
                          <div key={e.id} className="rounded-lg border border-zinc-800 p-3 bg-zinc-950">
                            <div className="flex items-center justify-between">
                              <div className="font-medium flex items-center gap-2">
                                <span>{e.type === "init" ? "Initial reading" : "Mileage entry"}</span>
                                {e.type === "entry" && e.deltaKm !== undefined && (
                                  <Badge variant="outline" className="ml-1 border-purple-500/40 text-purple-300">
                                    {`${e.deltaKm} km`}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="bg-zinc-800 text-zinc-200 border-0">
                                {d}
                              </Badge>
                            </div>
                            <div className="mt-2 grid gap-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span>Reading</span>
                                <span className="font-medium">{e.reading != null ? `${e.reading} km` : "-"}</span>
                              </div>
                              {e.type === "entry" && (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span>Entered by</span>
                                    <span>{e.enteredBy}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Credited to</span>
                                    <span className="font-medium text-purple-300">{e.attributedTo}</span>
                                  </div>
                                </>
                              )}
                              {e.note && <div className="text-xs text-zinc-500 mt-1">{e.note}</div>}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </SheetContent>
              </Sheet>

              {/* Settings */}
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="top"
                  className="max-h-[85vh] overflow-y-auto bg-zinc-900 text-zinc-50 border-zinc-800 px-4 py-0 pb-4"
                >
                  <SheetHeader>
                    <SheetTitle>Settings</SheetTitle>
                    <SheetDescription className="text-zinc-400">Set constants and preferences.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-3 grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price" className="text-zinc-300">
                        Price per km (ILS)
                      </Label>
                      <Input
                        id="price"
                        inputMode="decimal"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        placeholder="e.g. 0.5"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="startOdo" className="text-zinc-300">
                        Starting mileage (km)
                      </Label>
                      <Input
                        id="startOdo"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={startOdoInput}
                        onChange={(e) => setStartOdoInput(e.target.value)}
                        placeholder="e.g. 1000"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <div className="text-xs text-zinc-500">
                        If an initial reading already exists, this is informational only.
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Button
                        variant="secondary"
                        className="flex-1 bg-zinc-800 text-zinc-100 border-0 hover:bg-zinc-700"
                        onClick={() => setSettingsOpen(false)}
                        disabled={actionLoading}
                      >
                        Close
                      </Button>
                      <Button
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white border-0"
                        onClick={() => saveSettings(Number(priceInput), Number(startOdoInput))}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Logout */}
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Log out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="mx-auto max-w-sm p-4 space-y-4">
          {/* Summary with bigger numbers, less text */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
            <CardContent className="grid gap-4">
              <div className="flex flex-col items-center pt-2">
                <div className="text-6xl font-extrabold tracking-tight text-zinc-50">{formatCurrency(totalAmount)}</div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-zinc-400">{totalKm} km</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">{formatCurrency(state.pricePerKm)} / km</span>
                </div>
              </div>
              <div className="grid gap-2">
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-200",
                    state.lastEnteredBy === "Amit"
                      ? sessionUser === "Amit"
                        ? "border-zinc-600 bg-zinc-900 shadow-sm" // Current user - subtle grey/white
                        : "border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/20" // Other user - purple glow
                      : "border-zinc-800 bg-zinc-950",
                  )}
                >
                  <div className="text-xs text-zinc-400">Amit</div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-zinc-100">{formatCurrency(amounts.Amit)}</div>
                    <div className="text-xs text-zinc-500">{state.kmBy.Amit} km</div>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-200",
                    state.lastEnteredBy === "John"
                      ? sessionUser === "John"
                        ? "border-zinc-600 bg-zinc-900 shadow-sm" // Current user - subtle grey/white
                        : "border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/20" // Other user - purple glow
                      : "border-zinc-800 bg-zinc-950",
                  )}
                >
                  <div className="text-xs text-zinc-400">John</div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-zinc-100">{formatCurrency(amounts.John)}</div>
                    <div className="text-xs text-zinc-500">{state.kmBy.John} km</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Odometer</span>
                <span className="font-medium text-zinc-300">
                  {state.lastOdometer != null ? `${state.lastOdometer} km` : `Not set`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Inline mileage input with small Undo on side */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-zinc-100">Enter mileage</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Credit goes to the other person automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label htmlFor="mileage" className="sr-only">
                    Mileage (km)
                  </Label>
                  <Input
                    id="mileage"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={mileageValue}
                    onChange={(e) => setMileageValue(e.target.value)}
                    placeholder={state.lastOdometer === null ? "e.g. 1000 (initial)" : `Last: ${state.lastOdometer} km`}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                    disabled={actionLoading}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undoLast}
                  disabled={!lastEntry || actionLoading}
                  className={cn(
                    "shrink-0",
                    "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800",
                    (!lastEntry || actionLoading) && "opacity-50 cursor-not-allowed",
                  )}
                  aria-label="Undo last"
                  title="Undo last entry"
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Undo2 className="h-5 w-5" />}
                </Button>
              </div>
              <Button
                onClick={addMileage}
                className="h-12 bg-purple-600 hover:bg-purple-500 text-white border-0"
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add mileage
              </Button>
              <Button
                onClick={doResetAndShare}
                className="h-12 bg-purple-900 hover:bg-purple-800 text-purple-50 border-0"
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5" />}
                Reset & WhatsApp
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
