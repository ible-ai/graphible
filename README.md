# Graphible - Interactive Learning Graphs

> [!IMPORTANT]
> **[OUR *ONLINE* DEMO IS LIVE](https://ible-ai.github.io/graphible)**

Transform any topic into an interactive, AI-powered learning graph. Explore concepts through visual node-based interfaces with real-time LLM integration.

## 🚀 Features

- **Bring your own Google account**: sign in and generate on your own Gemini
  allowance — no API key to create, no Cloud project to configure, and nothing
  billed to whoever deployed the site
- **AI-Powered Graph Generation**: Google Gemini, a local Ollama model, a model
  running in your browser, or a demo graph that needs none of them
- **Interactive Visual Interface**: Navigate through interconnected learning nodes
- **Real-time Streaming**: Watch nodes generate in real-time as the LLM processes
- **Adaptive UI**: Interface learns and adapts to user preferences and feedback
- **Rich Navigation**: Mouse, keyboard, and touch controls for seamless exploration
- **Feedback System**: Rate and improve content through integrated feedback loops
- **Save and Load**: keep graphs for the rest of the browsing session

## 🎯 Quick Start

### Option 1: Live Demo (GitHub Pages)
Visit **[our *ONLINE* demo](http://ible-ai.github.io/graphible)**

### Option 2: Local Development

```bash
git clone https://github.com/ible-ai/graphible.git
cd graphible
npm install

# The dev server runs over HTTPS, which WebGPU and the local Ollama fetches
# both require. Generate certificates once, into the gitignored .env/:
mkdir -p .env && cd .env && mkcert localhost 127.0.0.1 ::1 && cd ..

npm run dev        # https://localhost:3000
```

Without those certificates `npm run dev` cannot start — it is the first thing
that trips up a fresh clone.

```bash
npm run test       # 261 unit tests (Vitest)
npm run test:e2e   # 68 end-to-end tests (Playwright, headless Chromium)
npm run lint
npm run build
```

The end-to-end suite drives a real build through the demo backend, so it needs
no model, API key or WebGPU.

### Option 3: Use your own Google account

Open the model menu, choose **External API → Google account**, and sign in.
Google shows a code; paste it back. That is the whole setup — the requests are
attributed to your account's own Gemini allowance.

### Option 4: Connect to Local LLM

1. **Install Ollama**: [https://ollama.ai](https://ollama.ai)
2. **Start Ollama with CORS**:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```
3. **Pull a model**:
   ```bash
   ollama pull gemma3:4b
   ollama pull gemma3:270m   # the lightweight option, 292MB
   ```
4. **Launch Graphible** and start exploring!

## 🎮 How to Use

1. **Enter a Topic**: Type what you want to learn about
2. **Watch Magic Happen**: AI generates interconnected learning nodes
3. **Navigate & Explore**: 
   - Click and drag to pan
   - Mouse wheel to zoom
   - Arrow keys to jump between nodes
   - Click nodes for detailed content
4. **Provide Feedback**: Use thumbs up/down to improve content
5. **Save Your Work**: graphs are kept in `sessionStorage`, so they survive
   reloads but not a browser restart

## 🛠 Technology Stack

- **Frontend**: React 19, Vite 6, Tailwind v4
- **Icons**: Lucide React
- **LLM Integration**: Google Gemini (Google sign-in or an API key), Ollama
  (local), WebLLM / transformers.js (in-browser), and a demo backend
- **Deployment**: GitHub Pages (live at [graph.ible.ai](https://graph.ible.ai))
- **Architecture**: Modular hooks-based React architecture

## 🎨 Key Components

- **Interactive Canvas**: Infinite zoom/pan graph visualization
- **Real-time Generation**: Streaming LLM integration with progress tracking
- **Adaptive UI**: Machine learning-enhanced interface personalization
- **Rich Node Types**: Root, concept, example, and detail node varieties
- **Feedback Loops**: Integrated learning and improvement system

## 🚀 Deployment

### Automatic GitHub Pages
Push to main branch - automatic deployment via GitHub Actions.

### Manual Build
```bash
npm run build    # Build for production
npm run preview  # Preview production build
npm run deploy   # Deploy to GitHub Pages
```

## 🔧 Configuration

### LLM Settings
Model catalogs live in `LLM_CONFIG` in `src/constants/graphConstants.jsx`, and
only there — they were once duplicated across the model selector, the setup
wizard and the installation guide, and drifted apart. Add or change a model in
one place.

```javascript
export const LLM_CONFIG = {
  LOCAL: { DEFAULT_BASE_URL: 'http://localhost:11434', ... },  // Ollama
  WEBLLM: { ... },                                             // in-browser
  EXTERNAL: { GOOGLE: { MODELS: { ... } } },                   // Gemini
};
```

### Styling & Themes
Modify `colorSchemes` in constants or use the adaptive UI system for dynamic theming.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Contact for licensing information.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) for local LLM infrastructure
- [Lucide](https://lucide.dev) for beautiful icons
- [TailwindCSS](https://tailwindcss.com) for styling system
- [Vite](https://vitejs.dev) for lightning-fast development

---

**Made with ❤️ for learners everywhere**
