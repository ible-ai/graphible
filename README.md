# Graphible - Interactive Learning Graphs

> [!IMPORTANT]
> **[OUR *ONLINE* DEMO IS LIVE](http://ible-ai.github.io/graphible)**

> [!IMPORTANT]
> **Also accessible from any browser via [http://graph.ible.ai](http://graph.ible.ai)**

Transform any topic into an interactive, AI-powered learning graph. Explore concepts through visual node-based interfaces with real-time LLM integration.

## 🚀 Features

- **AI-Powered Graph Generation**: Connect to local LLM (Ollama) for dynamic content creation
- **Interactive Visual Interface**: Navigate through interconnected learning nodes
- **Real-time Streaming**: Watch nodes generate in real-time as the LLM processes
- **Adaptive UI**: Interface learns and adapts to user preferences and feedback
- **Rich Navigation**: Mouse, keyboard, and touch controls for seamless exploration
- **Feedback System**: Rate and improve content through integrated feedback loops
- **Persistent State**: Save and load learning graphs for continued exploration

## 🎯 Quick Start

### Option 1: Live Demo (GitHub Pages)
Visit **[our *ONLINE* demo](http://ible-ai.github.io/graphible)**

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/ible-ai/graphible.git
cd graphible

# Install dependencies  
npm install

# Start development server
npm run dev
```

### Option 3: Connect to Local LLM

1. **Install Ollama**: [https://ollama.ai](https://ollama.ai)
2. **Start Ollama with CORS**:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```
3. **Pull a model**:
   ```bash
   ollama pull gemma3:4b
   ollama pull gemma3:270M
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
5. **Save Your Work**: Graphs persist between sessions

## 🛠 Technology Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Icons**: Lucide React
- **LLM Integration**: Ollama (local) or OpenAI API
- **Deployment**: GitHub Pages, Vercel, Netlify compatible
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
Edit `src/constants/graphConstants.jsx`:
```javascript
export const LLM_CONFIG = {
  BASE_URL: 'http://localhost:11434',  // Ollama endpoint
  MODEL: 'gemma3:4b',  // Model name
  // ... other settings
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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) for local LLM infrastructure
- [Lucide](https://lucide.dev) for beautiful icons
- [TailwindCSS](https://tailwindcss.com) for styling system
- [Vite](https://vitejs.dev) for lightning-fast development

---

**Made with ❤️ for learners everywhere**
