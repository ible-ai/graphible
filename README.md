
## Getting Started

0. Installs.

```shell
 npm install vite @vitejs/plugin-react vite-plugin-node-polyfills eslint-plugin-react-hooks eslint-plugin-react-refresh globals @eslint/js react react-dom lucide-react  tailwindcss @tailwindcss/vite
 ```


1. Start a local LLM server.

Install ollama from https://ollama.com/download if you have not already.

Download model weights. Current configuration calls for Gemma3:4b.

```shell
ollama run gemma3:4b
```

In a separate terminal from your NPM app:

```shell
ollama serve
```

2. Start `graphible`

```
npm run dev
```