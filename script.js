const topicListEl = document.getElementById("topicList");
const addTopicBtn = document.getElementById("addTopicBtn");
const topicTitleInput = document.getElementById("topicTitle");
const renameTopicBtn = document.getElementById("renameTopicBtn");
const deleteTopicBtn = document.getElementById("deleteTopicBtn");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const md = window.markdownit({ breaks: true, linkify: true });

let topics = JSON.parse(localStorage.getItem('topics') || '[]');
let activeTopicIdx = 0;

function saveTopics() {
  localStorage.setItem('topics', JSON.stringify(topics));
}

function renderTopics() {
  topicListEl.innerHTML = '';
  topics.forEach((t, idx) => {
    const li = document.createElement('li');
    li.textContent = t.name;
    if (idx === activeTopicIdx) li.className = 'active';
    li.onclick = () => { activeTopicIdx = idx; renderAll(); };
    topicListEl.appendChild(li);
  });
}

function renderChat() {
  chatWindow.innerHTML = '';
  if (!topics[activeTopicIdx]) return;
  topics[activeTopicIdx].messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = msg.role;
    if (msg.role === "assistant") {
      // Render markdown
      div.innerHTML = md.render(msg.content);
    } else {
      div.textContent = msg.content;
    }
    chatWindow.appendChild(div);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
  topicTitleInput.value = topics[activeTopicIdx]?.name || '';
}

function renderAll() {
  renderTopics();
  renderChat();
}

addTopicBtn.onclick = () => {
  const name = prompt("Topic name?");
  if (name) {
    topics.push({ name, messages: [] });
    activeTopicIdx = topics.length - 1;
    saveTopics();
    renderAll();
  }
};

renameTopicBtn.onclick = () => {
  if (!topics[activeTopicIdx]) return;
  const name = prompt("Rename topic?", topics[activeTopicIdx].name);
  if (name) {
    topics[activeTopicIdx].name = name;
    saveTopics();
    renderAll();
  }
};

deleteTopicBtn.onclick = () => {
  if (!topics[activeTopicIdx]) return;
  if (confirm("Delete this topic?")) {
    topics.splice(activeTopicIdx, 1);
    activeTopicIdx = Math.max(0, activeTopicIdx - 1);
    saveTopics();
    renderAll();
  }
};

chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;
  if (!topics[activeTopicIdx]) return;
  topics[activeTopicIdx].messages.push({ role: "user", content: text });
  saveTopics();
  renderAll();
  userInput.value = '';

  chatWindow.innerHTML += "<div class='system'>Thinking…</div>";
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Call Netlify LLM function
  const resp = await fetch("/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: topics[activeTopicIdx].messages }),
  });
  const json = await resp.json();
  if (json.reply) {
    topics[activeTopicIdx].messages.push({ role: "assistant", content: json.reply });
    saveTopics();
    renderAll();
  } else {
    chatWindow.innerHTML += "<div class='system'>Error: "+(json.error||"Unknown")+"</div>";
  }
};

window.onload = renderAll;