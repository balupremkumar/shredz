export function pickRecogniserConstructor(scope) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function createSpeechSession({ recogniser, schedule, onTranscript = () => {}, onState = () => {} }) {
  let state = 'idle';
  let final = '';
  let interim = '';
  let restarts = 0;
  let pendingRestart;
  function cancelRestart() {
    if (!pendingRestart) return;
    pendingRestart.cancelled = true;
    pendingRestart.cancel?.();
    pendingRestart = undefined;
  }
  const change = next => {
    if (next !== 'listening') cancelRestart();
    state = next; onState(state);
  };
  function launch() {
    if (state !== 'listening') return;
    try { recogniser.start(); }
    catch (error) {
      change(['not-allowed', 'service-not-allowed', 'NotAllowedError'].includes(error.error || error.name) ? 'denied' : 'error');
    }
  }
  if (recogniser) {
    recogniser.onresult = event => {
      if (state !== 'listening') return;
      restarts = 0;
      const committed = [];
      const pending = [];
      for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        (result.isFinal ? committed : pending).push(result[0].transcript.trim());
      }
      final = [final, ...committed].filter(Boolean).join(' ');
      interim = pending.filter(Boolean).join(' ');
      onTranscript({ final, interim });
    };
    recogniser.onend = () => {
      if (state !== 'listening' || pendingRestart) return;
      if (restarts >= 20) { change('error'); return; }
      restarts += 1;
      onState(state);
      const pending = { cancelled: false };
      pendingRestart = pending;
      pending.cancel = schedule(() => {
        if (pending.cancelled) return;
        pendingRestart = undefined;
        launch();
      }, 250);
    };
    recogniser.onerror = event => {
      if (state !== 'listening') return;
      if (['not-allowed', 'service-not-allowed'].includes(event.error)) change('denied');
      else if (!['no-speech', 'aborted'].includes(event.error)) change('error');
    };
  }
  return {
    get state() { return state; },
    get restarts() { return restarts; },
    start() {
      if (state === 'listening') return;
      if (!recogniser) { change('unsupported'); return; }
      recogniser.lang = 'en-NZ';
      recogniser.interimResults = true;
      recogniser.continuous = true;
      restarts = 0;
      change('listening');
      launch();
    },
    stop() {
      const wasListening = state === 'listening';
      cancelRestart();
      change('stopped');
      if (recogniser && wasListening) {
        try { recogniser.stop(); } catch { /* Already ended on the phone. */ }
      }
    },
    reset() { final = ''; interim = ''; onTranscript({ final, interim }); },
  };
}

export function shouldAutoSave({ typing, finalText, draftPreview, finalPreview }) {
  const preview = typing ? draftPreview : finalPreview;
  return Boolean(preview?.save && (typing || finalText.trim())
    && !draftPreview.unmatched.length && !preview.unmatched.length
    && preview.meals.some(meal => meal.items.length));
}

const leading = /^(?:(?:\d+(?:[.,]\d+)*|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an|couple|of|servings?|serves?|grams?|g|kilograms?|kg|millilitres?|milliliters?|mils?|ml|litres?|liters?|l|items?|scoops?|slices?|pieces?)\b[\s\p{P}]*)+/iu;
export function foodName(raw) {
  return String(raw).replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').replace(leading, '').trim();
}
export function isFoodName(raw) { return foodName(raw) !== ''; }
