import {
    initDB,
    getInitURL,
    saveEmulatorStateToDB,
    defaultState,
    clearStateFromDB,
} from './state.ts'
import {
    initXterm,
    resetTerminal,
    setTerminalFocus,
    setXtermEmulator,
} from './terminal.ts'

// Disable debugging messages in production
// @ts-ignore: import.meta.env is available in Vite
if (import.meta.env.PROD) {
    console.debug = () => {}
}

// Globals (TODO: refactor, we probably don't need all of these as globals)
const DIST_ID = 'alpine'
const DIST_NAME = 'Alpine'
const AUTO_SAVE_INTERVAL_SECONDS = 60 // seconds

let db: IDBDatabase
let emulator: any // V86 WASM OS emulator from libv86.js

// ------------------------------
// Misc utils
// ------------------------------

const hideElementById = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
        element.style.display = 'none'
    }
}

// -----------------------------
// Init utils
// -----------------------------

const initEmulator = (initState: { url: string } | undefined) => {
    // @ts-ignore: V86 is provided from build/libv86.js in index.html
    const v86Emulator = new V86({
        wasm_path: 'v86/build/v86.wasm',
        memory_size: 256 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: document.getElementById('v86-screen-container'),
        bios: { url: 'v86/bios/seabios.bin' }, // TODO: add bios? Are these even needed with filesystem?
        vga_bios: { url: 'v86/bios/vgabios.bin' },
        // cdrom: {
        //     url: `/v86-linux.iso`,
        // },
        filesystem: {
            baseurl: `v86/images/${DIST_ID}-rootfs-flat`,
            basefs: `v86/images/${DIST_ID}-fs.json`,
        },
        bzimage_initrd_from_filesystem: true,
        autostart: true,
        cmdline:
            'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable',
        initial_state: initState,
    })
    return v86Emulator
}

// ----------------------------
// Main execution
// ----------------------------
const startup = async () => {
    // disable action buttons
    const actionButtonInputs = document.querySelectorAll(
        // '.button:not(#restore_from_file)'
        'input[type="button"], input[type="file"]'
    )
    actionButtonInputs.forEach((input) => {
        if (input instanceof HTMLInputElement) {
            input.disabled = true
        }
    })

    // Initialize xterm.js
    let xterm = initXterm()
    console.debug('xterm initialized')
    xterm.reset()
    xterm.write(`\x1B[1;3;32m${DIST_NAME} Linux loading...\x1B[0m\r\n`)

    // Initialize IndexedDB for state management
    db = await initDB()

    const osStateInitURL = await getInitURL(db)

    // Initialize the v86 emulator
    emulator = initEmulator(
        osStateInitURL ? { url: osStateInitURL } : undefined
    )
    console.debug('emulator initialized')

    if (osStateInitURL === undefined) {
        xterm.reset()
        xterm.clear()
        xterm.write(`booting... this may take a minute\r\n`)

        let seconds = 0
        const bootWaitLogger = setInterval(() => {
            seconds += 5
            console.debug(`Waiting for boot... ${seconds} seconds`)
        }, 5 * 1000)

        let serial_text = ''

        const waitForBoot = new Promise<void>((resolve) => {
            const listenerFunction = (byte: any) => {
                const c = String.fromCharCode(byte)
                serial_text += c

                if (serial_text.endsWith('localhost:~# ')) {
                    console.debug('Boot complete')
                    xterm.write(serial_text)
                    emulator.remove_listener(
                        'serial0-output-byte',
                        listenerFunction
                    )
                    clearInterval(bootWaitLogger)
                    resolve()
                }
            }
            emulator.add_listener('serial0-output-byte', listenerFunction)
        })

        await waitForBoot
    } else {
        const waitForEmulatorReady = new Promise<void>((resolve) => {
            emulator.add_listener('emulator-ready', () => {
                resetTerminal()
                console.debug('Emulator is ready')
                resolve()
            })
        })

        await waitForEmulatorReady
    }

    await setXtermEmulator(emulator)
    hideElementById('term-loader')
    setTerminalFocus()

    // enable action buttons
    actionButtonInputs.forEach((input) => {
        if (input instanceof HTMLInputElement) {
            input.disabled = false
        }
    })

    // Save state to IndexedDB every 60 seconds
    setInterval(async () => {
        await saveEmulatorStateToDB(emulator, db)
    }, AUTO_SAVE_INTERVAL_SECONDS * 1000)
}

document.addEventListener('DOMContentLoaded', startup)

// ----------------------------
// Button actions
// ----------------------------

const setButtonActionInProgress = (buttonId: string) => {
    const button = document.getElementById(buttonId) as HTMLButtonElement
    if (!button) {
        console.error(`Button with id ${buttonId} not found`)
        return
    }
    button.disabled = true

    const loader = document.createElement('span')
    loader.className = 'loader'
    button.parentElement?.appendChild(loader)
}

const setButtonActionDone = (buttonId: string) => {
    const button = document.getElementById(buttonId) as HTMLButtonElement
    if (!button) {
        console.error(`Button with id ${buttonId} not found`)
        return
    }
    button.disabled = false

    const loader = button.parentElement?.querySelector('.loader')
    if (loader) {
        button.parentElement.removeChild(loader)
    }
}

const saveButtonId = 'save_to_idb'
document.getElementById(saveButtonId).onclick = async (event) => {
    event.preventDefault()
    setButtonActionInProgress(saveButtonId)

    await saveEmulatorStateToDB(emulator, db).catch((error) => {
        console.error('Failed to save state to IndexedDB:', error)
        alert('Failed to save state to IndexedDB. Please try again later.')
    })
    setButtonActionDone(saveButtonId)
}

const resetButtonId = 'reset_state'
document.getElementById(resetButtonId).onclick = async () => {
    console.debug('Resetting state to default')
    setButtonActionInProgress(resetButtonId)
    // stop the emulator
    emulator.stop()

    // load the default state from url
    const defaultStateAsArrayBuffer = await fetch(defaultState.url).then(
        (res) => res.arrayBuffer()
    )

    await emulator
        .restore_state(defaultStateAsArrayBuffer)
        .then(async () => {
            await clearStateFromDB(db)
        })
        .catch(async (error: any) => {
            console.debug('Failed to restore default state:', error)
            const answer = confirm(
                'Default state not found. Do you want to reboot the system?'
            )

            if (!answer) {
                setButtonActionDone(resetButtonId)
                return
            }

            await clearStateFromDB(db)
            location.reload()
        })

    emulator.run()

    setButtonActionDone(resetButtonId)
    resetTerminal()
}

const saveToFileButtonId = 'save_to_file'
document.getElementById(saveToFileButtonId).onclick = async function () {
    // wait for the emulator to finish processing the command
    setTimeout(async () => {
        const new_state = await emulator.save_state()
        var a = document.createElement('a')
        a.download = 'v86state.bin'
        a.href = window.URL.createObjectURL(new Blob([new_state]))
        a.dataset.downloadurl =
            'application/octet-stream:' + a.download + ':' + a.href
        a.click()
    }, 3000)
}

// TODO: refactor huge function (to its own file?)
const restoreFromFileButtonId = 'restore_from_file'
document
    .getElementById(restoreFromFileButtonId)
    .addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement
        if (input.files.length) {
            // Add a spinner to the button
            setButtonActionInProgress('restore_from_file')

            var filereader = new FileReader()
            filereader.onerror = (e) => {
                console.error('Error reading file', e)
                alert('Error reading file: ' + e.target.error.message)
                setButtonActionDone(restoreFromFileButtonId)
            }
            filereader.onabort = () => {
                console.warn('File reading aborted')
                alert('File reading aborted')
                setButtonActionDone(restoreFromFileButtonId)
            }

            filereader.onloadstart = () => {
                console.debug('File reading started')
            }

            filereader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentLoaded = (e.loaded / e.total) * 100
                    console.debug(
                        `File reading progress: ${percentLoaded.toFixed(2)}%`
                    )
                } else {
                    console.debug('File reading progress: unknown size')
                }
            }

            filereader.onloadend = () => {
                console.debug('File reading completed')
            }

            filereader.onload = async (e) => {
                console.debug('File reading finished successfully')
                console.debug('Stopping emulator before restoring state')
                // Stop the emulator before restoring state
                emulator.stop()

                await emulator.restore_state(e.target.result)
                emulator.run()
                console.debug('State restored from file successfully')

                setButtonActionDone(restoreFromFileButtonId)
            }

            filereader.readAsArrayBuffer(input.files[0])

            input.value = ''
            resetTerminal()
        }
    })
