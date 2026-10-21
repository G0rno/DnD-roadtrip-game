import { render } from 'preact';
import '@fontsource/cinzel/700.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/700.css';
import './ui/styles.css';
import { App } from './ui/App';
import { voice } from './audio/voice';

voice.init();

render(<App />, document.getElementById('app')!);

// One ticker drives every sprite's idle animation (4 frames).
let frame = 0;
setInterval(() => {
  frame = (frame + 1) % 4;
  document.documentElement.style.setProperty('--f', String(frame));
}, 170);

// Offline support (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
