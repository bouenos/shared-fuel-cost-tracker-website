import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export type User = "Amit" | "John"

export type Entry = {
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

export type AppState = {
  version: number
  pricePerKm: number
  startingOdometer: number
  lastOdometer: number | null
  kmBy: Record<User, number>
  history: Entry[]
  lastEnteredBy: User | null
}

export async function getAppState(): Promise<AppState> {
  try {
    // Get current state
    const stateResult = await sql`
      SELECT version, price_per_km, starting_odometer, last_odometer, 
             amit_km, john_km, last_entered_by
      FROM fuel_split_state 
      ORDER BY updated_at DESC 
      LIMIT 1
    `

    // Get history entries
    const historyResult = await sql`
      SELECT id, type, timestamp, reading, delta_km, attributed_to, 
             entered_by, note, snapshot_data
      FROM fuel_split_entries 
      ORDER BY timestamp ASC
    `

    const state = stateResult[0]
    if (!state) {
      throw new Error("No state found in database")
    }

    const history: Entry[] = historyResult.map((row: any) => ({
      id: row.id,
      type: row.type,
      timestamp: Number(row.timestamp),
      reading: row.reading,
      deltaKm: row.delta_km,
      attributedTo: row.attributed_to,
      enteredBy: row.entered_by,
      note: row.note,
      snapshot: row.snapshot_data,
    }))

    return {
      version: state.version,
      pricePerKm: Number(state.price_per_km),
      startingOdometer: state.starting_odometer,
      lastOdometer: state.last_odometer,
      kmBy: {
        Amit: state.amit_km,
        John: state.john_km,
      },
      history,
      lastEnteredBy: state.last_entered_by as User | null,
    }
  } catch (error) {
    console.error("Error getting app state:", error)
    throw error
  }
}

export async function updateAppState(newState: AppState): Promise<void> {
  try {
    // Update main state
    await sql`
      UPDATE fuel_split_state 
      SET version = ${newState.version},
          price_per_km = ${newState.pricePerKm},
          starting_odometer = ${newState.startingOdometer},
          last_odometer = ${newState.lastOdometer},
          amit_km = ${newState.kmBy.Amit},
          john_km = ${newState.kmBy.John},
          last_entered_by = ${newState.lastEnteredBy},
          updated_at = NOW()
      WHERE id = (SELECT id FROM fuel_split_state ORDER BY updated_at DESC LIMIT 1)
    `
  } catch (error) {
    console.error("Error updating app state:", error)
    throw error
  }
}

export async function addHistoryEntry(entry: Entry): Promise<void> {
  try {
    await sql`
      INSERT INTO fuel_split_entries 
      (id, type, timestamp, reading, delta_km, attributed_to, entered_by, note, snapshot_data)
      VALUES (
        ${entry.id},
        ${entry.type},
        ${entry.timestamp},
        ${entry.reading || null},
        ${entry.deltaKm || null},
        ${entry.attributedTo || null},
        ${entry.enteredBy || null},
        ${entry.note || null},
        ${entry.snapshot ? JSON.stringify(entry.snapshot) : null}
      )
      ON CONFLICT (id) DO NOTHING
    `
  } catch (error) {
    console.error("Error adding history entry:", error)
    throw error
  }
}

export async function removeHistoryEntry(entryId: string): Promise<void> {
  try {
    await sql`
      DELETE FROM fuel_split_entries 
      WHERE id = ${entryId}
    `
  } catch (error) {
    console.error("Error removing history entry:", error)
    throw error
  }
}
