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
  history: [], // {role: 'user'|'assistant', content: string}
  passcode: ''
};

function showScreen(id) {
  ['passcodeScreen', 'unitPicker', 'chatSection', 'feedbackPanel', 'doneSection'].forEach(function (screenId) {
    document.getElementById(screenId).classList.toggle('is-visible', screenId === id);
  });
}

// ---------- Step 0: class passcode ----------
document.getElementById('passcodeSubmit').addEventListener('click', submitPasscode);
document.getElementById('passcodeInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') submitPasscode();
});
function submitPasscode() {
  var value = document.getElementById('passcodeInput').value.trim();
  if (!value) return;
  state.passcode = value;
  document.getElementById('passcodeError').hidden = true;
  showScreen('unitPicker');
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
  stopSpeaking();
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
  stopSpeaking();
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

function authHeaders() {
  return { 'Content-Type': 'application/json', 'x-class-passcode': state.passcode };
}

function callChat(messagesForApi) {
  return fetch(WORKER_BASE_URL + '/api/chat', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ unit: state.unit, messages: messagesForApi })
  }).then(function (res) {
    if (res.status === 401) throw new Error('passcode');
    if (!res.ok) throw new Error('chat request failed');
    return res.json();
  });
}

function playTts(text) {
  return fetch(WORKER_BASE_URL + '/api/tts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text: text })
  }).then(function (res) {
    if (res.status === 401) throw new Error('passcode');
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

function stopSpeaking() {
  var audio = document.getElementById('botAudio');
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.currentTime = 0;
  companionOrb.classList.remove('is-speaking');
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
    .catch(function (err) {
      hudStatus.textContent = 'LISTO';
      setInputDisabled(false);
      handleChatError(err);
    });
}

function handleChatError(err) {
  if (err && err.message === 'passcode') {
    state.passcode = '';
    document.getElementById('passcodeInput').value = '';
    document.getElementById('passcodeError').hidden = false;
    showScreen('passcodeScreen');
    return;
  }
  showError('Connection problem — please try again.');
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
    .catch(function (err) {
      hudStatus.textContent = 'LISTO';
      setInputDisabled(false);
      handleChatError(err);
    });
}

// ---------- Voice: push-to-talk. The student presses and holds the mic
// button while speaking, and releases it when done. ----------
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
    hudStatus.textContent = 'LISTO';
  });
  recognition.addEventListener('error', function (e) {
    if (e.error === 'no-speech' || e.error === 'aborted') {
      // The student released the button before saying anything, or too
      // briefly to catch — not worth alarming them about.
      return;
    }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      showError('Microphone access is blocked. Please allow microphone permission for this site (check the icon in your address bar) and reload the page.');
    } else if (e.error === 'audio-capture') {
      showError('No microphone was found. Please connect one and reload the page.');
    } else if (e.error === 'network') {
      showError('Voice recognition lost its connection. Try holding the microphone again.');
    } else {
      showError('Voice recognition had a problem ("' + e.error + '"). Try holding the microphone again.');
    }
  });

  micBtn.addEventListener('mousedown', function (e) { e.preventDefault(); startListening(); });
  micBtn.addEventListener('mouseup', stopListening);
  micBtn.addEventListener('mouseleave', stopListening);
  micBtn.addEventListener('touchstart', function (e) { e.preventDefault(); startListening(); }, { passive: false });
  micBtn.addEventListener('touchend', function (e) { e.preventDefault(); stopListening(); });
}

function startListening() {
  if (!recognition || isListening || micBtn.disabled) return;
  var chatSection = document.getElementById('chatSection');
  if (!chatSection.classList.contains('is-visible')) return;
  hideError();
  try {
    isListening = true;
    micBtn.classList.add('is-recording');
    companionOrb.classList.add('is-listening');
    hudStatus.textContent = 'ESCUCHANDO';
    listenStatus.hidden = false;
    listenStatus.innerHTML = '<span class="sc-listen-dot"></span> Escuchando… (hold and speak)';
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
