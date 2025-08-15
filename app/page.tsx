"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Fuel, Settings, History, Undo2, LogOut, Send } from "lucide-react"
import { cn } from "@/lib/utils"

type User = "Amit" | "Ori"

const CODES_TO_USER: Record<string, User> = {
  "8237592": "Amit",
  "1491023": "Ori",
}
const OTHER: Record<User, User> = { Amit: "Ori", Ori: "Amit" }

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

const STORAGE_KEY = "fuel-split-state-v1"
const SESSION_KEY = "fuel-split-session-user"

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

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
  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = window.localStorage.getItem(SESSION_KEY)
    if (saved) setSessionUser(saved as User)
  }, [])

  // App State
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === "undefined") {
      return {
        version: 1,
        pricePerKm: 0.5,
        startingOdometer: 0,
        lastOdometer: null,
        kmBy: { Amit: 0, Ori: 0 },
        history: [],
        lastEnteredBy: null,
      }
    }
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved) as AppState
      } catch {
        // fallthrough
      }
    }
    return {
      version: 1,
      pricePerKm: 0.5,
      startingOdometer: 0,
      lastOdometer: null,
      kmBy: { Amit: 0, Ori: 0 },
      history: [],
      lastEnteredBy: null,
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Derived
  const totalKm = state.kmBy.Amit + state.kmBy.Ori
  const totalAmount = totalKm * state.pricePerKm
  const amounts = {
    Amit: state.kmBy.Amit * state.pricePerKm,
    Ori: state.kmBy.Ori * state.pricePerKm,
  }

  // UI State
  const [code, setCode] = useState("")
  const [mileageValue, setMileageValue] = useState<string>("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Undo stack (only last mileage entry)
  const lastEntry = useMemo(() => {
    for (let i = state.history.length - 1; i >= 0; i--) {
      if (state.history[i].type === "entry") return state.history[i]
    }
    return null
  }, [state.history])

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
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY)
  }

  function addMileage() {
    if (!sessionUser) return
    const reading = Number(mileageValue)
    if (!Number.isFinite(reading) || reading < 0) {
      alert("Please enter a valid mileage (km).")
      return
    }
    setState((prev) => {
      // first ever reading
      if (prev.lastOdometer === null) {
        const entry: Entry = {
          id: nowId(),
          type: "init",
          timestamp: Date.now(),
          reading,
          enteredBy: sessionUser,
          note: "Initial reading set",
        }
        return {
          ...prev,
          startingOdometer: reading,
          lastOdometer: reading,
          lastEnteredBy: sessionUser,
          history: [...prev.history, entry],
        }
      }
      // normal entry
      const delta = reading - prev.lastOdometer
      if (delta < 0) {
        alert("Mileage cannot decrease. Please check the value.")
        return prev
      }
      if (delta === 0) {
        const entry: Entry = {
          id: nowId(),
          type: "entry",
          timestamp: Date.now(),
          reading,
          deltaKm: 0,
          attributedTo: OTHER[sessionUser],
          enteredBy: sessionUser,
          note: "No change in km",
        }
        return {
          ...prev,
          lastOdometer: reading,
          lastEnteredBy: sessionUser,
          history: [...prev.history, entry],
        }
      }
      const creditedUser = OTHER[sessionUser]
      const entry: Entry = {
        id: nowId(),
        type: "entry",
        timestamp: Date.now(),
        reading,
        deltaKm: delta,
        attributedTo: creditedUser,
        enteredBy: sessionUser,
      }
      return {
        ...prev,
        kmBy: { ...prev.kmBy, [creditedUser]: prev.kmBy[creditedUser] + delta },
        lastOdometer: reading,
        lastEnteredBy: sessionUser,
        history: [...prev.history, entry],
      }
    })
    setMileageValue("")
  }

  function undoLast() {
    if (!lastEntry) return
    setState((prev) => {
      const idx = prev.history.findIndex((e) => e.id === lastEntry.id)
      if (idx === -1) return prev
      const newHistory = prev.history.slice(0, idx).concat(prev.history.slice(idx + 1))
      // find prior reading to restore lastOdometer
      let restoreTo: number | null = null
      for (let i = newHistory.length - 1; i >= 0; i--) {
        const e = newHistory[i]
        if (e.reading != null) {
          restoreTo = e.reading
          break
        }
      }
      const newKmBy = { ...prev.kmBy }
      if ((lastEntry.deltaKm ?? 0) > 0 && lastEntry.attributedTo) {
        newKmBy[lastEntry.attributedTo] = Math.max(0, newKmBy[lastEntry.attributedTo] - (lastEntry.deltaKm ?? 0))
      }
      return {
        ...prev,
        kmBy: newKmBy,
        lastOdometer: restoreTo,
        history: newHistory,
      }
    })
  }

  function openWhatsAppWithMessage(msg: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank")
  }

  function doResetAndShare() {
    const ts = Date.now()
    const dateStr = new Date(ts).toLocaleString()
    const msg = [
      `Fuel split reset (${dateStr})`,
      `Price per km: ${formatCurrency(state.pricePerKm)}`,
      `Totals since last reset:`,
      `- Amit: ${state.kmBy.Amit} km => ${formatCurrency(amounts.Amit)}`,
      `- Ori: ${state.kmBy.Ori} km => ${formatCurrency(amounts.Ori)}`,
      `Total: ${totalKm} km => ${formatCurrency(totalAmount)}`,
      state.lastOdometer != null ? `Odometer: ${state.lastOdometer} km` : undefined,
      `Please settle accordingly.`,
    ]
      .filter(Boolean)
      .join("\n")

    // Open Whatsapp
    openWhatsAppWithMessage(msg)

    // Record reset
    setState((prev) => {
      const entry: Entry = {
        id: nowId(),
        type: "reset",
        timestamp: ts,
        note: "Reset & share",
        snapshot: {
          kmBy: { ...prev.kmBy },
          pricePerKm: prev.pricePerKm,
          totalKm: prev.kmBy.Amit + prev.kmBy.Ori,
          totalAmount: (prev.kmBy.Amit + prev.kmBy.Ori) * prev.pricePerKm,
        },
      }
      return {
        ...prev,
        startingOdometer: prev.lastOdometer ?? prev.startingOdometer,
        kmBy: { Amit: 0, Ori: 0 },
        history: [...prev.history, entry],
      }
    })
  }

  function saveSettings(newPricePerKm: number, newStartingOdo: number) {
    if (newPricePerKm <= 0) {
      alert("Price per km must be greater than 0.")
      return
    }
    if (newStartingOdo < 0) {
      alert("Starting mileage must be >= 0.")
      return
    }
    setState((prev) => ({
      ...prev,
      pricePerKm: newPricePerKm,
      startingOdometer: prev.lastOdometer == null ? newStartingOdo : prev.startingOdometer,
    }))
    setSettingsOpen(false)
  }

  // Forms controlled state for settings
  const [priceInput, setPriceInput] = useState<string>("")
  const [startOdoInput, setStartOdoInput] = useState<string>("")
  useEffect(() => {
    setPriceInput(String(state.pricePerKm))
    setStartOdoInput(String(state.startingOdometer))
  }, [settingsOpen, state.pricePerKm, state.startingOdometer])

  // Dark mode wrapper for entire page
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
                  Enter your one-time code. Only Amit and Ori can access.
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
                      <span>{"Use 8237592 (Amit) or 1491023 (Ori)"}</span>
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
                                  <span>Ori</span>
                                  <span>
                                    {e.snapshot
                                      ? `${e.snapshot.kmBy.Ori} km • ${formatCurrency(
                                          e.snapshot.kmBy.Ori * e.snapshot.pricePerKm,
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
                      >
                        Close
                      </Button>
                      <Button
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white border-0"
                        onClick={() => saveSettings(Number(priceInput), Number(startOdoInput))}
                      >
                        Save
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
                    state.lastEnteredBy === "Ori"
                      ? sessionUser === "Ori"
                        ? "border-zinc-600 bg-zinc-900 shadow-sm" // Current user - subtle grey/white
                        : "border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/20" // Other user - purple glow
                      : "border-zinc-800 bg-zinc-950",
                  )}
                >
                  <div className="text-xs text-zinc-400">Ori</div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-zinc-100">{formatCurrency(amounts.Ori)}</div>
                    <div className="text-xs text-zinc-500">{state.kmBy.Ori} km</div>
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
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undoLast}
                  disabled={!lastEntry}
                  className={cn(
                    "shrink-0",
                    "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800",
                    !lastEntry && "opacity-50 cursor-not-allowed",
                  )}
                  aria-label="Undo last"
                  title="Undo last entry"
                >
                  <Undo2 className="h-5 w-5" />
                </Button>
              </div>
              <Button onClick={addMileage} className="h-12 bg-purple-600 hover:bg-purple-500 text-white border-0">
                Add mileage
              </Button>
              <Button
                onClick={doResetAndShare}
                className="h-12 bg-purple-900 hover:bg-purple-800 text-purple-50 border-0"
              >
                <Send className="mr-2 h-5 w-5" />
                Reset & WhatsApp
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
