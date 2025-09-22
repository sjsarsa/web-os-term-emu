import { blobToBase64 } from './file-util'

// Constants
const DEFAULT_STATE = { url: './init-state.bin' }
const DB_NAME = 'v86'
const DB_OBJECT_STORE_NAME = 'states'
const DB_STATE_KEY = 'linux-state'

const checkDefaultStateAvailability = async (): Promise<boolean> => {
    try {
        const response = await fetch(DEFAULT_STATE.url)
        return (
            response.ok &&
            response.headers.get('Content-Type') === 'application/octet-stream'
        )
    } catch (error) {
        console.error('Error checking default state existence:', error)
        return false
    }
}

const initDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        // Open IndexedDB

        // @ts-ignore
        const openDB = indexedDB.open(DB_NAME, 1)
        openDB.onupgradeneeded = (event: any) => {
            const db = event.target.result
            if (!db.objectStoreNames.contains(DB_OBJECT_STORE_NAME)) {
                db.createObjectStore(DB_OBJECT_STORE_NAME)
            }
        }

        openDB.onerror = function (event) {
            console.error(`Failed to open IndexedDB for ${DB_NAME}:`, event)
            reject(event)
        }

        openDB.onsuccess = async (event) => {
            // Load state from IndexedDB on page load
            // @ts-ignore
            const db = event.target.result
            resolve(db)
        }
    })
}

const storeTransaction = (
    db: IDBDatabase,
    mode: IDBTransactionMode = 'readwrite',
    transactionId = 'states'
) => {
    const transaction = db.transaction(transactionId, mode)
    transaction.onerror = (event: any) => {
        console.error('Transaction failed:', event)
    }
    transaction.oncomplete = () => {
        console.debug('Transaction completed successfully')
    }
    transaction.onabort = (event: any) => {
        console.error('Transaction aborted:', event)
    }
    return transaction.objectStore(transactionId)
}

const saveEmulatorStateToDB = async (
    emulator: any,
    db: IDBDatabase,
    stateKey = DB_STATE_KEY
) => {
    const state = await emulator.save_state()
    const stateBlob = new Blob([state], {
        type: 'application/octet-stream',
    })
    const new_state_b64 = await blobToBase64(stateBlob)
    const store = storeTransaction(db, 'readwrite')
    const request = store.put(new_state_b64, stateKey)

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            console.debug('State saved to IndexedDB successfully')
            resolve(new_state_b64)
        }

        request.onerror = (event: any) => {
            console.error('Failed to save state to IndexedDB:', event)
            reject(event)
        }
    })
}

const getInitURL = async (
    db: any,
    stateKey = DB_STATE_KEY
): Promise<string> => {
    const defaultStateAvailable = await checkDefaultStateAvailability()

    return new Promise((resolve, _reject) => {
        const store = storeTransaction(db, 'readonly')
        const getOSState = store.get(stateKey)

        getOSState.onerror = () => {
            console.error(
                'Failed to retrieve state from IndexedDB, using default state'
            )
            resolve(defaultStateAvailable ? DEFAULT_STATE.url : undefined)
        }

        // set saved state if exists for initialization
        getOSState.onsuccess = async () => {
            if (getOSState.result) {
                const state_b64 = getOSState.result
                const state_blob = await fetch(state_b64).then((res) =>
                    res.blob()
                )
                const stateAsArrayBuffer = await state_blob.arrayBuffer()
                const savedStateUrl = URL.createObjectURL(
                    new Blob([stateAsArrayBuffer], {
                        type: 'application/octet-stream',
                    })
                )
                console.debug(
                    'Saved state found in IndexedDB, using it for initialization'
                )
                resolve(savedStateUrl)
            } else {
                console.debug(
                    'No saved state found in IndexedDB, using default state'
                )
                resolve(defaultStateAvailable ? DEFAULT_STATE.url : undefined)
            }
        }
    })
}

const clearStateFromDB = async (db: IDBDatabase, stateKey = DB_STATE_KEY) => {
    return new Promise((resolve, reject) => {
        const store = storeTransaction(db, 'readwrite')
        const deleteRequest = store.delete(stateKey)

        deleteRequest.onsuccess = () => {
            console.debug('State cleared from IndexedDB')
            resolve(true)
        }

        deleteRequest.onerror = (event: any) => {
            console.error('Failed to clear state from IndexedDB:', event)
            reject(event)
        }
    })
}

export {
    DEFAULT_STATE as defaultState,
    getInitURL,
    initDB,
    saveEmulatorStateToDB,
    clearStateFromDB,
}
