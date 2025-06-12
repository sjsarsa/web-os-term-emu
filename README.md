# 🕸️ OS Term 𓅦

Online full OS and terminal emulator through WASM

- Everything runs on your local browser
- Powered by TypeScript, [copy-v86](https://github.com/copy/v86) (WASM OS) and [xtermjs](https://github.com/xtermjs/xterm.js/) (terminal view) and [Vite](https://vite.dev/).
- OS state saving with IndexedDB or as a downloadable file

## Setup

### Docker

1. Build docker image:

```sh
docker build -t web-os-term-emu .
```

2. Run docker container:

```sh
docker run --rm -p 3000:3000 web-os-term-emu
```

3. Open your browser and go to `http://localhost:3000`

### Local

1. Install [Node and npm](https://nodejs.org/en/download) (if not already installed):

2. Install dependencies:

```sh
npm install
```

#### Dev mode with hot reload

3. Start the development server:

```sh
npm run dev
```

#### Build for production

3. Build the project:

```sh
npm run build
```

4. Serve the production build using a static file server, e.g., Python's builtin http.server: `python -m http.server 3000 -d ./dist/` or [serve](https://www.npmjs.com/package/serve) for Node.
