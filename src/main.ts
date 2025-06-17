import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

import {
    initDB,
    getInitURL,
    saveStateToDB,
    defaultState,
    clearStateFromDB,
} from './state.ts'

// Disable debugging messages in production
// @ts-ignore: import.meta.env is available in Vite
if (import.meta.env.PROD) {
    console.debug = () => {}
}

// Globals (TODO: refactor, we probably don't need all of these as globals)
let db: IDBDatabase
let xterm: Terminal
let xtermFit: FitAddon
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

const setTerminalFocus = () => {
    const xtermInputEl = document
        .getElementById('xterm')
        ?.getElementsByTagName('textarea')
        .item(0)
    if (xtermInputEl) {
        xtermInputEl.focus()
        xtermInputEl.select()
        xtermInputEl.click()
        console.debug('Focused xterm input element')
    } else {
        console.warn('Could not find xterm input element to focus')
    }
}

const resetTerminal = () => {
    // Clear the xterm display
    xterm.reset()
    // Resize the terminal
    xtermFit.fit()
    // Write the initial message
    xterm.write('localhost:~# ')
    // Focus the terminal input
    setTerminalFocus()
}

// -----------------------------
// Init utils
// -----------------------------

const initEmulator = (initState: { url: string }) => {
    // @ts-ignore: V86 is provided from build/libv86.js in index.html
    const v86Emulator = new V86({
        wasm_path: 'v86/build/v86.wasm',
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: document.getElementById('v86-screen-container'),
        bios: { url: 'v86/bios/seabios.bin' }, // TODO: add bios? Are these even needed with filesystem?
        vga_bios: { url: 'v86/bios/vgabios.bin' },
        filesystem: {
            baseurl: 'v86/images/alpine-rootfs-flat',
            basefs: 'v86/images/alpine-fs.json',
        },
        bzimage_initrd_from_filesystem: true,
        autostart: true,
        cmdline:
            'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable',
        initial_state: initState,
    })
    return v86Emulator
}

const initXterm = () => {
    xterm = new Terminal()
    const termcontainer = document.getElementById('xterm')
    xterm.open(termcontainer)

    // Initialize the xterm-fit addon
    xtermFit = new FitAddon()
    xterm.loadAddon(xtermFit)
    xtermFit.fit()
    return xterm
}

// Resize terminal on window resize
window.addEventListener('resize', () => {
    xtermFit.fit()
})

// ----------------------------
// Event handlers
// ----------------------------

const onTerminalInput = (key: { key: string; domEvent: KeyboardEvent }) => {
    // Paste (Ctrl+Alt+V)
    if (
        key.domEvent.ctrlKey &&
        key.domEvent.altKey &&
        key.domEvent.key == 'v'
    ) {
        console.debug('paste')
        navigator.clipboard.readText().then((text) => {
            emulator.serial0_send(text)
        })
        return
    }

    // Copy (Ctrl+Alt+C)
    if (
        key.domEvent.ctrlKey &&
        key.domEvent.altKey &&
        key.domEvent.key == 'c'
    ) {
        console.debug('copy')
        document.execCommand('copy')
        return
    }

    // Send keys from xterm to v86
    emulator.serial0_send(key.key)

    console.debug('sent key: ' + key.key)
}

const onTerminalOutput = (char: string) => {
    console.debug('output: ' + char)
    xterm.write(char)
}

// ----------------------------
// Main execution
// ----------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize xterm.js
    xterm = initXterm()
    console.debug('xterm initialized')
    xterm.write(`\x1B[1;3;32mAlpine Linux loading...\x1B[0m\r\n`)

    // Initialize IndexedDB for state management
    db = await initDB()

    const osStateInitURL = await getInitURL(db)

    // Initialize the v86 emulator
    emulator = initEmulator({ url: osStateInitURL })
    console.debug('emulator initialized')

    // Save state to IndexedDB every 60 seconds
    setInterval(async () => {
        const new_state = await emulator.save_state()
        await saveStateToDB(new_state, db)
    }, 60 * 1000)

    // Forward keystrokes from xterm to v86
    xterm.onKey((key) => onTerminalInput(key))

    // Forward output from v86 to xterm and other functions
    emulator.add_listener('serial0-output-byte', (byte: any) => {
        const char = byte && String.fromCharCode(byte)
        char && onTerminalOutput(char)
    })

    emulator.add_listener('emulator-ready', () => {
        resetTerminal()
        hideElementById('term-loader')
    })
})

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

    const new_state = await emulator.save_state()
    await saveStateToDB(new_state, db).catch((error) => {
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

    await emulator.restore_state(defaultStateAsArrayBuffer)
    emulator.run()

    await clearStateFromDB(db)
    setButtonActionDone(resetButtonId)
    resetTerminal()
}

// TODO: refactor huge function (to its own file?)
const saveToFileButtonId = 'save_to_file'
document.getElementById(saveToFileButtonId).onclick = async function () {
    const new_state = await emulator.save_state()
    var a = document.createElement('a')
    a.download = 'v86state.bin'
    a.href = window.URL.createObjectURL(new Blob([new_state]))
    a.dataset.downloadurl =
        'application/octet-stream:' + a.download + ':' + a.href
    a.click()
}

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
