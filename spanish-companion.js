// Spanish Conversation Companion — frontend.
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

// ---------- Step 1: feedback ----------
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

function goToUnitPicker() {
  document.getElementById('feedbackPanel').style.display = 'none';
  document.getElementById('unitPicker').style.display = 'flex';
}

document.getElementById('submitFeedback').addEventListener('click', function () {
  var comment = document.getElementById('feedbackComment').value.trim();
  if (state.rating > 0 || comment) {
    fetch(WORKER_BASE_URL + '/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: state.rating || 0, comment: comment, unit: null })
    }).catch(function () { /* best-effort, don't block the student */ });
  }
  feedbackNote.textContent = '¡Gracias!';
  setTimeout(goToUnitPicker, 300);
});

document.getElementById('skipFeedback').addEventListener('click', goToUnitPicker);

// ---------- Step 2: unit picker ----------
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
  document.getElementById('unitPicker').style.display = 'none';
  document.getElementById('chatSection').classList.add('is-active');
  document.getElementById('currentUnitBadge').textContent = 'Unidad ' + unitNumber + ' — ' + UNIT_LABELS[unitNumber];
  document.getElementById('chatLog').innerHTML = '';
  document.getElementById('transcriptBody').innerHTML = '';
  kickoffConversation();
}

document.getElementById('changeUnitBtn').addEventListener('click', function () {
  document.getElementById('chatSection').classList.remove('is-active');
  document.getElementById('unitPicker').style.display = 'flex';
});

// ---------- Step 3: chat ----------
var chatLog = document.getElementById('chatLog');
var transcriptBody = document.getElementById('transcriptBody');
var transcriptDetails = document.getElementById('transcriptDetails');
var transcriptLabel = document.getElementById('transcriptLabel');
var transcriptChevron = document.getElementById('transcriptChevron');

transcriptDetails.addEventListener('toggle', function () {
  transcriptLabel.textContent = transcriptDetails.open ? 'Ocultar' : 'Mostrar';
  transcriptChevron.style.transform = transcriptDetails.open ? 'rotate(180deg)' : 'rotate(0deg)';
});

function appendMessage(role, text) {
  var bubble = document.createElement('div');
  bubble.className = 'sc-msg ' + (role === 'user' ? 'sc-msg--user' : 'sc-msg--bot');
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;

  var line = document.createElement('p');
  line.className = 'sc-transcript-line';
  line.innerHTML = '<b>' + (role === 'user' ? 'Estudiante' : 'Compañero') + ':</b> ' + escapeHtml(text);
  transcriptBody.appendChild(line);
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showTyping() {
  var el = document.createElement('div');
  el.className = 'sc-typing';
  el.id = 'typingIndicator';
  el.textContent = 'Escribiendo…';
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function hideTyping() {
  var el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function setInputDisabled(disabled) {
  document.getElementById('chatInput').disabled = disabled;
  document.getElementById('sendBtn').disabled = disabled;
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
    var audio = document.getElementById('botAudio');
    audio.src = URL.createObjectURL(blob);
    return audio.play();
  }).catch(function () { /* audio is a nice-to-have; ignore failures */ });
}

function kickoffConversation() {
  setInputDisabled(true);
  showTyping();
  var kickoffMessages = [{ role: 'user', content: 'EMPEZAR' }];
  callChat(kickoffMessages)
    .then(function (data) {
      hideTyping();
      state.history.push({ role: 'user', content: 'EMPEZAR' });
      state.history.push({ role: 'assistant', content: data.reply });
      appendMessage('bot', data.reply);
      playTts(data.reply);
    })
    .catch(function () {
      hideTyping();
      appendMessage('bot', 'Lo siento, hubo un problema de conexión. Inténtalo de nuevo en un momento.');
    })
    .finally(function () { setInputDisabled(false); });
}

function sendUserMessage() {
  var input = document.getElementById('chatInput');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';

  appendMessage('user', text);
  state.history.push({ role: 'user', content: text });

  setInputDisabled(true);
  showTyping();
  callChat(state.history)
    .then(function (data) {
      hideTyping();
      state.history.push({ role: 'assistant', content: data.reply });
      appendMessage('bot', data.reply);
      playTts(data.reply);
    })
    .catch(function () {
      hideTyping();
      appendMessage('bot', 'Lo siento, hubo un problema de conexión. Inténtalo de nuevo.');
    })
    .finally(function () { setInputDisabled(false); });
}

document.getElementById('sendBtn').addEventListener('click', sendUserMessage);
document.getElementById('chatInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') sendUserMessage();
});

// ---------- Optional voice input (progressive enhancement) ----------
var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
var micBtn = document.getElementById('micBtn');
if (!SpeechRecognitionCtor) {
  micBtn.style.display = 'none';
} else {
  var recognition = new SpeechRecognitionCtor();
  recognition.lang = 'es-ES';
  recognition.interimResults = false;

  recognition.addEventListener('result', function (e) {
    var transcript = e.results[0][0].transcript;
    document.getElementById('chatInput').value = transcript;
  });
  recognition.addEventListener('end', function () { micBtn.classList.remove('is-recording'); });

  micBtn.addEventListener('click', function () {
    if (micBtn.classList.contains('is-recording')) {
      recognition.stop();
    } else {
      micBtn.classList.add('is-recording');
      recognition.start();
    }
  });
}
