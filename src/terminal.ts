import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'

let xterm: Terminal
let xtermFit: FitAddon
let outputEnabled = false

export const setTerminalFocus = () => {
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

export const resetTerminal = () => {
    // Clear the xterm display
    xterm.reset()
    // Resize the terminal
    xtermFit.fit()
    // Write the initial message
    xterm.write('localhost:~# ')
    // Focus the terminal input
    setTerminalFocus()
}

// Resize terminal on window resize
window.addEventListener('resize', () => {
    xtermFit.fit()
})

const onTerminalInput = (
    emulator: any,
    key: { key: string; domEvent: KeyboardEvent }
) => {
    console.debug('key: ' + key.key)
    // Paste (Ctrl+Alt+V)
    if (
        key.domEvent.ctrlKey &&
        (((key.domEvent.altKey || key.domEvent.shiftKey) && key.domEvent.key == 'v') ||
            key.domEvent.key == 'V')
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
        (key.domEvent.altKey || key.domEvent.shiftKey) &&
        key.domEvent.key == 'c'
    ) {
        console.debug('copy')
        document.execCommand('copy')
        return
    }

    // Send keys from xterm to v86
    emulator.serial0_send(key.key)
}

const onTerminalOutput = (char: string) => {
    console.debug('output: ' + char)
    if (!outputEnabled) {
        return
    }

    xterm.write(char)
}

export const initXterm = () => {
    if (xterm === undefined) {
        xterm = new Terminal({ allowProposedApi: true })
        // xterm.loadAddon(new Unicode11Addon())
        // xterm.unicode.activeVersion = '11'

        const termcontainer = document.getElementById('xterm')
        xterm.open(termcontainer)
        xtermFit = new FitAddon()
        xterm.loadAddon(xtermFit)
    }

    // Initialize the xterm-fit addon
    xtermFit.fit()

    return xterm
}

// listen to tilde

export const setXtermEmulator = async (emulator: any) => {
    // Sync the terminal size with the emulator
    outputEnabled = false
    emulator.serial0_send(`stty rows ${xterm.rows}\r\n`)

    // Forward keystrokes from xterm to v86
    // special characters (e.g. ä, ö) aren't registered on FireFox
    xterm.onKey((key) => onTerminalInput(emulator, key))

    console.debug('xterm output handler set up')
    // Forward output from v86 to xterm and other functions
    let byteBuffer: number[] = []
    let byteBufferTimeout: number | undefined = undefined
    const flushByteBuffer = () => {
        if (byteBuffer.length > 0) {
            const text = new Uint8Array(byteBuffer)
            const chars = new TextDecoder().decode(text)
            onTerminalOutput(chars)
            byteBuffer = []
        }
        if (byteBufferTimeout !== undefined) {
            clearTimeout(byteBufferTimeout)
            byteBufferTimeout = undefined
        }
    }

    emulator.add_listener('serial0-output-byte', (byte: any) => {
        if (!outputEnabled) {
            return
        }

        // Buffer bytes to handle multi-byte characters
        byteBuffer.push(byte)
        if (byteBufferTimeout === undefined) {
            byteBufferTimeout = window.setTimeout(() => {
                flushByteBuffer()
            }, 100) // Adjust timeout as needed
        }
        // flush immediately on newline
        if (byte === 10) {
            flushByteBuffer()
        }
        // flush immediately on carriage return
        if (byte === 13) {
            flushByteBuffer()
        }
        // flush immediately on backspace
        if (byte === 8) {
            flushByteBuffer()
        }
        // flush immediately on tab
        if (byte === 9) {
            flushByteBuffer()
        }
        // flush immediately on escape
        if (byte === 27) {
            flushByteBuffer()
        }

        // const char = byte && String.fromCharCode(byte)
        // char && onTerminalOutput(char)
    })

    let prevRows = xterm.rows

    xterm.onResize(() => {
        if (prevRows === xterm.rows) {
            return
        }

        prevRows = xterm.rows
        outputEnabled = false
        emulator.serial0_send(`stty rows ${xterm.rows}\r\n`)
        setTimeout(() => {
            outputEnabled = true
        }, 1000)
    })

    let composing = false
    document.addEventListener('input', (event) => {
        console.debug(event)
        // Handle input events for composition text
        if (
            event instanceof InputEvent &&
            event.inputType === 'insertCompositionText' // &&
            // event.isComposing === false  // does not work in chromium
        ) {
            if (composing) {
                emulator.serial0_send(event.data)
                composing = false
            } else {
                composing = true
            }
        } else {
            composing = false
        }

        // Handle paste events
        if (
            event instanceof InputEvent &&
            event.inputType === 'insertFromPaste'
        ) {
            emulator.serial0_send(event.data)
        }
    })

    // enable output after a short delay
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            outputEnabled = true
            resolve()
        }, 500)
    })
}
