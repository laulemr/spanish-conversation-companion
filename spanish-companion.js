// Charlie — Spanish speaking companion, frontend.
// All Claude/ElevenLabs calls go through the Cloudflare Worker backend so
// API keys never live in this file. Set WORKER_BASE_URL below once the
// worker is deployed (see worker/README.md).

var WORKER_BASE_URL = 'https://spanish-companion.lauralet.workers.dev';

var UNIT_LABELS = {
  0: 'Gente en clase',
  1: 'Gente que estudia español',
  2: 'Gente con gente',
  3: 'Gente de vacaciones',
  4: 'Gente de compras',
  5: 'Gente en forma',
  6: 'Gente que come bien'
};

var state = {
  rating: 0,
  unit: null,
  history: [] // {role: 'user'|'assistant', content: string}
};

function showScreen(id) {
  ['unitPicker', 'chatSection', 'feedbackPanel', 'doneSection'].forEach(function (screenId) {
    document.getElementById(screenId).classList.toggle('is-visible', screenId === id);
  });
}

// ---------- Step 1: unit picker (shown first, with the welcome instructions) ----------
var unitGrid = document.getElementById('unitGrid');
Object.keys(UNIT_LABELS).forEach(function (num) {
  var btn = document.createElement('button');
  btn.className = 'sc-unit-btn';
  btn.innerHTML = '<span class="sc-unit-num">Unidad ' + num + '</span><span class="sc-unit-name">' + UNIT_LABELS[num] + '</span>';
  btn.addEventListener('click', function () { selectUnit(Number(num)); });
  unitGrid.appendChild(btn);
});

function selectUnit(unitNumber) {
  state.unit = unitNumber;
  state.history = [];
  document.getElementById('currentUnitBadge').textContent = 'Unidad ' + unitNumber + ' — ' + UNIT_LABELS[unitNumber];
  document.getElementById('transcriptBody').innerHTML = '';
  showScreen('chatSection');
  kickoffConversation();
}

document.getElementById('changeUnitBtn').addEventListener('click', function () {
  stopListening();
  showScreen('unitPicker');
});

// ---------- Step 3: feedback (shown after the conversation ends) ----------
var starRow = document.getElementById('starRow');
var feedbackNote = document.getElementById('feedbackNote');

starRow.addEventListener('click', function (e) {
  var btn = e.target.closest('.sc-star');
  if (!btn) return;
  state.rating = Number(btn.dataset.value);
  Array.prototype.forEach.call(starRow.children, function (star, i) {
    star.classList.toggle('is-filled', i < state.rating);
  });
});

document.getElementById('submitFeedback').addEventListener('click', function () {
  var comment = document.getElementById('feedbackComment').value.trim();
  if (state.rating > 0 || comment) {
    fetch(WORKER_BASE_URL + '/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: state.rating || 0, comment: comment, unit: state.unit })
    }).catch(function () { /* best-effort, don't block the student */ });
  }
  feedbackNote.textContent = 'Thank you!';
  setTimeout(function () { showScreen('doneSection'); }, 300);
});

document.getElementById('skipFeedback').addEventListener('click', function () { showScreen('doneSection'); });

document.getElementById('endConversationBtn').addEventListener('click', function () {
  stopListening();
  state.rating = 0;
  document.getElementById('feedbackComment').value = '';
  feedbackNote.textContent = '';
  Array.prototype.forEach.call(starRow.children, function (star) { star.classList.remove('is-filled'); });
  showScreen('feedbackPanel');
});

document.getElementById('restartBtn').addEventListener('click', function () { showScreen('unitPicker'); });

// ---------- Step 2: conversation ----------
var transcriptBody = document.getElementById('transcriptBody');
var transcriptDetails = document.getElementById('transcriptDetails');
var transcriptLabel = document.getElementById('transcriptLabel');
var transcriptChevron = document.getElementById('transcriptChevron');
var companionOrb = document.getElementById('companionOrb');
var hudStatus = document.getElementById('hudStatus');
var errorNote = document.getElementById('errorNote');

transcriptDetails.addEventListener('toggle', function () {
  transcriptLabel.textContent = transcriptDetails.open ? 'Hide' : 'Show';
  transcriptChevron.style.transform = transcriptDetails.open ? 'rotate(180deg)' : 'rotate(0deg)';
});

function appendToTranscript(role, text) {
  var line = document.createElement('p');
  line.className = 'sc-transcript-line';
  line.innerHTML = '<b>' + (role === 'user' ? 'Student' : 'Charlie') + ':</b> ' + escapeHtml(text);
  transcriptBody.appendChild(line);
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showError(message) {
  errorNote.textContent = message;
  errorNote.hidden = false;
}
function hideError() {
  errorNote.hidden = true;
}

function setInputDisabled(disabled) {
  document.getElementById('micBtn').disabled = disabled;
}

function callChat(messagesForApi) {
  return fetch(WORKER_BASE_URL + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit: state.unit, messages: messagesForApi })
  }).then(function (res) {
    if (!res.ok) throw new Error('chat request failed');
    return res.json();
  });
}

function playTts(text) {
  return fetch(WORKER_BASE_URL + '/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  }).then(function (res) {
    if (!res.ok) throw new Error('tts request failed');
    return res.blob();
  }).then(function (blob) {
    return new Promise(function (resolve) {
      var audio = document.getElementById('botAudio');
      audio.src = URL.createObjectURL(blob);
      companionOrb.classList.add('is-speaking');
      hudStatus.textContent = 'HABLANDO';
      function done() {
        companionOrb.classList.remove('is-speaking');
        hudStatus.textContent = 'LISTO';
        resolve();
      }
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    });
  }).catch(function () {
    companionOrb.classList.remove('is-speaking');
    hudStatus.textContent = 'LISTO';
    /* audio is a nice-to-have; ignore failures */
  });
}

function kickoffConversation() {
  setInputDisabled(true);
  hudStatus.textContent = 'PENSANDO';
  var kickoffMessages = [{ role: 'user', content: 'EMPEZAR' }];
  callChat(kickoffMessages)
    .then(function (data) {
      state.history.push({ role: 'user', content: 'EMPEZAR' });
      state.history.push({ role: 'assistant', content: data.reply });
      appendToTranscript('bot', data.reply);
      setInputDisabled(false);
      return playTts(data.reply);
    })
    .then(function () { setTimeout(startListening, 250); })
    .catch(function () {
      hudStatus.textContent = 'LISTO';
      showError('Connection problem — please try again in a moment.');
      setInputDisabled(false);
    });
}

function sendUserMessage(text) {
  stopListening();
  if (!text) return;

  appendToTranscript('user', text);
  state.history.push({ role: 'user', content: text });

  setInputDisabled(true);
  hudStatus.textContent = 'PENSANDO';
  callChat(state.history)
    .then(function (data) {
      state.history.push({ role: 'assistant', content: data.reply });
      appendToTranscript('bot', data.reply);
      setInputDisabled(false);
      return playTts(data.reply);
    })
    .then(function () { setTimeout(startListening, 250); })
    .catch(function () {
      hudStatus.textContent = 'LISTO';
      showError('Connection problem — please try again.');
      setInputDisabled(false);
    });
}

// ---------- Voice: this is oral-only practice — Charlie listens
// automatically after it speaks, and the student answers by talking. ----------
var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
var micBtn = document.getElementById('micBtn');
var listenStatus = document.getElementById('listenStatus');
var recognition = null;
var isListening = false;

if (!SpeechRecognitionCtor) {
  micBtn.style.display = 'none';
  document.getElementById('unsupportedNote').hidden = false;
} else {
  recognition = new SpeechRecognitionCtor();
  recognition.lang = 'es-ES';
  recognition.interimResults = false;

  var retryOnEnd = false;

  recognition.addEventListener('result', function (e) {
    hideError();
    var transcript = e.results[0][0].transcript;
    sendUserMessage(transcript);
  });
  recognition.addEventListener('end', function () {
    isListening = false;
    micBtn.classList.remove('is-recording');
    companionOrb.classList.remove('is-listening');
    listenStatus.hidden = true;
    var chatSection = document.getElementById('chatSection');
    if (retryOnEnd && chatSection.classList.contains('is-visible')) {
      retryOnEnd = false;
      setTimeout(startListening, 300);
    } else {
      hudStatus.textContent = 'LISTO';
    }
  });
  recognition.addEventListener('error', function (e) {
    if (e.error === 'no-speech' || e.error === 'aborted') {
      // Nothing was heard in time — this is normal while waiting for the
      // student to start talking. Just listen again, no need to alarm them.
      retryOnEnd = true;
      return;
    }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      showError('Microphone access is blocked. Please allow microphone permission for this site (check the icon in your address bar) and reload the page.');
    } else if (e.error === 'audio-capture') {
      showError('No microphone was found. Please connect one and reload the page.');
    } else if (e.error === 'network') {
      showError('Voice recognition lost its connection. Tap the microphone to try again.');
    } else {
      showError('Voice recognition had a problem ("' + e.error + '"). Tap the microphone to try again.');
    }
  });

  micBtn.addEventListener('click', function () {
    hideError();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
}

function startListening() {
  if (!recognition || isListening) return;
  var chatSection = document.getElementById('chatSection');
  if (!chatSection.classList.contains('is-visible')) return;
  try {
    isListening = true;
    micBtn.classList.add('is-recording');
    companionOrb.classList.add('is-listening');
    hudStatus.textContent = 'ESCUCHANDO';
    listenStatus.hidden = false;
    listenStatus.innerHTML = '<span class="sc-listen-dot"></span> Escuchando…';
    recognition.start();
  } catch (e) {
    isListening = false;
    companionOrb.classList.remove('is-listening');
  }
}

function stopListening() {
  companionOrb.classList.remove('is-listening');
  if (!recognition || !isListening) return;
  recognition.stop();
}
