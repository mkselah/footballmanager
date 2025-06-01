import { supabase } from "./setup.js";

const topicDropdown = document.getElementById("topicDropdown");
const addTopicBtn = document.getElementById("addTopicBtn");
const renameTopicBtn = document.getElementById("renameTopicBtn");
const deleteTopicBtn = document.getElementById("deleteTopicBtn");
const logoutBtn = document.getElementById("logoutBtn"); // Only one logoutBtn now!

const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");

const authSection = document.getElementById("authSection");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const authStatus = document.getElementById("authStatus");
const authForm = document.getElementById("authForm");

let topics = [];
let messages = [];
let activeTopicIdx = 0;
let user = null;

// ==== NEW: Store last suggested questions ====
let lastSuggestions = []; // ADDED

// =======================
// AUTH LOGIC
// ... [NO CHANGES in this block]
// =======================

// =======================
// TOPICS/MESSAGES SYNC
// ... [NO CHANGES in this block]
// =======================

// =======================
// UI RENDERING
// =======================
function renderTopicsDropdown() {
  // ... [no changes]
  topicDropdown.innerHTML = '';
  topics.forEach((t, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = t.name;
    topicDropdown.appendChild(opt);
  });
  topicDropdown.value = activeTopicIdx;
  renameTopicBtn.disabled = deleteTopicBtn.disabled = topics.length === 0;
  if(topics[activeTopicIdx]) {
    document.getElementById('currentTopicLabel').textContent = "  (" + topics[activeTopicIdx].name + ")";
  } else {
    document.getElementById('currentTopicLabel').textContent = '';
  }
}
topicDropdown.onchange = async function () {
  activeTopicIdx = parseInt(this.value);
  await loadMessages();
  renderAll();
};

addTopicBtn.onclick = async () => { /* ...as before... */ };
renameTopicBtn.onclick = async () => { /* ...as before... */ };
deleteTopicBtn.onclick = async () => { /* ...as before... */ };

// === MODIFIED: Chat area w/ SUGGESTED QUESTIONS ===
function renderChat() {
  chatWindow.innerHTML = '';
  if (!topics[activeTopicIdx]) return;
  messages.forEach((msg, idx) => {
    const div = document.createElement('div');
    div.className = msg.role;

    const container = document.createElement('div');
    container.className = "message-container";
    container.style.display = 'flex';
    container.style.alignItems = 'flex-start';

    if (msg.role === "assistant") {
      if (window.markdownit) {
        div.innerHTML = window.markdownit().render(msg.content);
      } else {
        div.innerHTML = msg.content.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
      }
    } else {
      div.textContent = msg.content;
    }

    // Delete button logic unchanged
    const delBtn = document.createElement('button');
    delBtn.textContent = "🗑️";
    delBtn.title = "Delete this message";
    delBtn.className = "msg-delete-btn";
    delBtn.style.marginLeft = "8px";
    delBtn.style.fontSize = "1em";
    delBtn.style.background = "none";
    delBtn.style.border = "none";
    delBtn.style.cursor = "pointer";
    delBtn.style.opacity = "0.6";
    delBtn.style.transition = "opacity 0.2s";
    delBtn.onmouseenter = () => delBtn.style.opacity = "1";
    delBtn.onmouseleave = () => delBtn.style.opacity = "0.6";
    delBtn.onclick = () => deleteMessage(msg.id);

    container.appendChild(div);
    container.appendChild(delBtn);
    chatWindow.appendChild(container);

    // ==== ADD SUGGESTED QUESTIONS BLOCK to LAST assistant message only ===
    // If this is the LAST message and role is 'assistant' and lastSuggestions exist
    if (msg.role === 'assistant' && idx === messages.length - 1 && lastSuggestions.length > 0) {
      const suggBox = document.createElement('div');
      suggBox.className = "suggestions-box";
      suggBox.style.marginTop = "4px";
      suggBox.style.marginLeft = "16px";
      suggBox.style.display = "flex";
      suggBox.style.flexDirection = "column";
      suggBox.style.gap = "6px";

      const label = document.createElement('span');
      label.textContent = "💡 Suggested next questions:";
      label.style.fontSize = "0.98em";
      label.style.color = "#555";
      suggBox.appendChild(label);

      const btns = document.createElement('div');
      btns.style.display = "flex";
      btns.style.gap = "8px";
      lastSuggestions.forEach(question => {
        const qBtn = document.createElement('button');
        qBtn.textContent = question;
        qBtn.className = "suggestion-btn";
        qBtn.style.fontSize = "0.97em";
        qBtn.style.padding = "0.12em 0.5em";
        qBtn.style.borderRadius = "7px";
        qBtn.style.border = "1px solid #8db8ff";
        qBtn.style.background = "#edf4ff";
        qBtn.style.cursor = "pointer";
        qBtn.onmouseenter = () => qBtn.style.background = "#e5f0ff";
        qBtn.onmouseleave = () => qBtn.style.background = "#edf4ff";
        qBtn.onclick = async () => {
          userInput.value = question;
          userInput.focus();
          // Optionally: auto-submit
          chatForm.requestSubmit();
        };
        btns.appendChild(qBtn);
      });
      suggBox.appendChild(btns);
      chatWindow.appendChild(suggBox);
    }
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderAll() {
  renderTopicsDropdown();
  renderChat();
  autoGrow(userInput);
  if (user) userInput.focus();
}

// ===== Textarea Auto-expanding =====
function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = (textarea.scrollHeight) + "px";
}
userInput.addEventListener("input", function() {
  autoGrow(this);
});

// ===== Chat Submit =====
chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;
  if (!topics[activeTopicIdx]) return;
  await addMessage("user", text);
  userInput.value = '';
  autoGrow(userInput);
  chatWindow.innerHTML += "<div class='system'>Thinking…</div>";
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Build context messages
  const contextMessages = messages.concat([{ role: "user", content: text }]);
  // Call Netlify function
  const resp = await fetch("/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: contextMessages }),
  });
  const json = await resp.json();
  // === ADDED: suggested questions support
  lastSuggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
  if (json.reply) {
    await addMessage("assistant", json.reply);
    // when addMessage runs and we get to chat render, it will use lastSuggestions
  } else {
    chatWindow.innerHTML += "<div class='system'>Error: "+(json.error||"Unknown")+"</div>";
    lastSuggestions = [];
    renderAll();
  }
};

// ==== INIT ===
window.onload = async () => {
  let { data: { user: u }} = await supabase.auth.getUser();
  user = u;
  updateAuthUI();
  if (user) await loadData();
};