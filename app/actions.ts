"use server"

import {
  getAppState,
  updateAppState,
  addHistoryEntry,
  removeHistoryEntry,
  type AppState,
  type Entry,
  type User,
} from "@/lib/database"

export async function loadAppState(): Promise<AppState> {
  return await getAppState()
}

export async function saveAppState(state: AppState): Promise<void> {
  await updateAppState(state)
}

export async function addEntry(entry: Entry): Promise<void> {
  await addHistoryEntry(entry)
}

export async function removeEntry(entryId: string): Promise<void> {
  await removeHistoryEntry(entryId)
}

export async function addMileageEntry(sessionUser: User, reading: number, currentState: AppState): Promise<AppState> {
  const OTHER: Record<User, User> = { Amit: "Ori", Ori: "Amit" }

  function nowId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  let newState = { ...currentState }
  let newEntry: Entry

  // First ever reading
  if (currentState.lastOdometer === null) {
    newEntry = {
      id: nowId(),
      type: "init",
      timestamp: Date.now(),
      reading,
      enteredBy: sessionUser,
      note: "Initial reading set",
    }

    newState = {
      ...currentState,
      startingOdometer: reading,
      lastOdometer: reading,
      lastEnteredBy: sessionUser,
    }
  } else {
    // Normal entry
    const delta = reading - currentState.lastOdometer

    if (delta < 0) {
      throw new Error("Mileage cannot decrease. Please check the value.")
    }

    if (delta === 0) {
      newEntry = {
        id: nowId(),
        type: "entry",
        timestamp: Date.now(),
        reading,
        deltaKm: 0,
        attributedTo: OTHER[sessionUser],
        enteredBy: sessionUser,
        note: "No change in km",
      }
    } else {
      const creditedUser = OTHER[sessionUser]
      newEntry = {
        id: nowId(),
        type: "entry",
        timestamp: Date.now(),
        reading,
        deltaKm: delta,
        attributedTo: creditedUser,
        enteredBy: sessionUser,
      }

      newState.kmBy = {
        ...newState.kmBy,
        [creditedUser]: newState.kmBy[creditedUser] + delta,
      }
    }

    newState.lastOdometer = reading
    newState.lastEnteredBy = sessionUser
  }

  // Save to database
  await addEntry(newEntry)
  await saveAppState(newState)

  // Return updated state with new entry in history
  return {
    ...newState,
    history: [...newState.history, newEntry],
  }
}

export async function undoLastEntry(currentState: AppState): Promise<AppState> {
  // Find last entry
  let lastEntry: Entry | null = null
  for (let i = currentState.history.length - 1; i >= 0; i--) {
    if (currentState.history[i].type === "entry") {
      lastEntry = currentState.history[i]
      break
    }
  }

  if (!lastEntry) {
    throw new Error("No entry to undo")
  }

  // Remove from database
  await removeEntry(lastEntry.id)

  // Update state
  const newHistory = currentState.history.filter((e) => e.id !== lastEntry!.id)

  // Find prior reading to restore lastOdometer
  let restoreTo: number | null = null
  for (let i = newHistory.length - 1; i >= 0; i--) {
    const e = newHistory[i]
    if (e.reading != null) {
      restoreTo = e.reading
      break
    }
  }

  const newKmBy = { ...currentState.kmBy }
  if ((lastEntry.deltaKm ?? 0) > 0 && lastEntry.attributedTo) {
    newKmBy[lastEntry.attributedTo] = Math.max(0, newKmBy[lastEntry.attributedTo] - (lastEntry.deltaKm ?? 0))
  }

  const newState = {
    ...currentState,
    kmBy: newKmBy,
    lastOdometer: restoreTo,
    history: newHistory,
  }

  await saveAppState(newState)
  return newState
}

export async function resetAndGetMessage(currentState: AppState): Promise<{ message: string; newState: AppState }> {
  function formatCurrency(n: number) {
    try {
      return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n)
    } catch {
      return `₪${n.toFixed(2)}`
    }
  }

  const totalKm = currentState.kmBy.Amit + currentState.kmBy.Ori
  const totalAmount = totalKm * currentState.pricePerKm
  const amounts = {
    Amit: currentState.kmBy.Amit * currentState.pricePerKm,
    Ori: currentState.kmBy.Ori * currentState.pricePerKm,
  }

  const ts = Date.now()
  const dateStr = new Date(ts).toLocaleString()
  const message = [
    `Fuel split reset (${dateStr})`,
    `Price per km: ${formatCurrency(currentState.pricePerKm)}`,
    `Totals since last reset:`,
    `- Amit: ${currentState.kmBy.Amit} km => ${formatCurrency(amounts.Amit)}`,
    `- Ori: ${currentState.kmBy.Ori} km => ${formatCurrency(amounts.Ori)}`,
    `Total: ${totalKm} km => ${formatCurrency(totalAmount)}`,
    currentState.lastOdometer != null ? `Odometer: ${currentState.lastOdometer} km` : undefined,
    `Please settle accordingly.`,
  ]
    .filter(Boolean)
    .join("\n")

  // Create reset entry
  const resetEntry: Entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "reset",
    timestamp: ts,
    note: "Reset & share",
    snapshot: {
      kmBy: { ...currentState.kmBy },
      pricePerKm: currentState.pricePerKm,
      totalKm,
      totalAmount,
    },
  }

  const newState = {
    ...currentState,
    startingOdometer: currentState.lastOdometer ?? currentState.startingOdometer,
    kmBy: { Amit: 0, Ori: 0 },
    history: [...currentState.history, resetEntry],
  }

  // Save to database
  await addEntry(resetEntry)
  await saveAppState(newState)

  return { message, newState }
}

export async function updateSettings(
  pricePerKm: number,
  startingOdometer: number,
  currentState: AppState,
): Promise<AppState> {
  if (pricePerKm <= 0) {
    throw new Error("Price per km must be greater than 0.")
  }
  if (startingOdometer < 0) {
    throw new Error("Starting mileage must be >= 0.")
  }

  const newState = {
    ...currentState,
    pricePerKm,
    startingOdometer: currentState.lastOdometer == null ? startingOdometer : currentState.startingOdometer,
  }

  await saveAppState(newState)
  return newState
}
