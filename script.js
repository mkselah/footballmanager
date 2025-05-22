import { supabase } from "./setup.js";

const topicListEl = document.getElementById("topicList");
const addTopicBtn = document.getElementById("addTopicBtn");
const topicTitleInput = document.getElementById("topicTitle");
const renameTopicBtn = document.getElementById("renameTopicBtn");
const deleteTopicBtn = document.getElementById("deleteTopicBtn");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");

// Auth elements
const authSection = document.getElementById("authSection");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const authStatus = document.getElementById("authStatus");
const logoutBtn = document.getElementById("logoutBtn");

let topics = [];
let messages = [];
let activeTopicIdx = 0;
let user = null; // Supabase user object

// AUTH LOGIC
loginBtn.onclick = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail.value,
    password: authPassword.value,
  });
  if (error) {
    authStatus.textContent = error.message;
    return;
  }
  user = data.user;
  loadData();
};

signupBtn.onclick = async () => {
  const { data, error } = await supabase.auth.signUp({
    email: authEmail.value,
    password: authPassword.value,
  });
  if (error) {
    authStatus.textContent = error.message;
    return;
  }
  user = data.user;
  authStatus.textContent = "Check your email to confirm!";
};

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  user = null;
  topics = [];
  messages = [];
  renderAll();
  updateAuthUI();
};

function updateAuthUI() {
  if (user) {
    authSection.style.display = "block";
    authForm.style.display = "none";
    logoutBtn.style.display = "inline";
    document.getElementById("app").style.display = "";
  } else {
    authSection.style.display = "block";
    authForm.style.display = "";
    logoutBtn.style.display = "none";
    document.getElementById("app").style.display = "none";
  }
}

// TOPICS/MESSAGES SYNC FROM/TO SUPABASE
async function loadData() {
  if (!user) return;

  // Save current topic id if exists
  let oldTopicId = topics[activeTopicIdx]?.id;

  let { data: topicRows } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true });
  topics = topicRows || [];

  // Try to stay on current topic after reload, if it still exists
  if (oldTopicId) {
    let idx = topics.findIndex(t => t.id === oldTopicId);
    activeTopicIdx = idx >= 0 ? idx : 0;
  } else {
    activeTopicIdx = 0;
  }

  await loadMessages();
  renderAll();
}

async function loadMessages() {
  if (!topics[activeTopicIdx]) { messages = []; return; }
  let { data: messageRows } = await supabase
    .from('messages')
    .select('*')
    .eq('topic_id', topics[activeTopicIdx].id)
    .order('created_at', { ascending: true });
  messages = messageRows || [];
}

async function saveTopic(name) {
  if (!user) return;
  // Insert into topics table
  let { data, error } = await supabase
    .from('topics')
    .insert({ name, user_id: user.id })
    .select();
  if (error) return alert(error.message);
  topics.push(data[0]);
  activeTopicIdx = topics.length - 1;
  await loadMessages();
  renderAll();
}

async function renameTopic(idx, name) {
  if (!user || !topics[idx]) return;
  let id = topics[idx].id;
  let { error } = await supabase
    .from('topics')
    .update({ name })
    .eq('id', id);
  if (error) alert(error.message);
  // Instead of updating the local copy and re-rendering,
  // reload data from Supabase to ensure up-to-date state!
  await loadData();
}

async function deleteTopic(idx) {
  if (!user || !topics[idx]) return;
  let topicId = topics[idx].id;
  await supabase.from('messages').delete().eq('topic_id', topicId);
  await supabase.from('topics').delete().eq('id', topicId);
  topics.splice(idx, 1);
  if (activeTopicIdx >= topics.length) activeTopicIdx = topics.length - 1;
  await loadMessages();
  renderAll();
}

async function addMessage(role, content) {
  if (!user || !topics[activeTopicIdx]) return;
  let { data, error } = await supabase
    .from('messages')
    .insert({
      topic_id: topics[activeTopicIdx].id,
      role,
      content,
    });
  if (error) alert(error.message);
  await loadMessages();
  renderAll();
}


// --------- UI RENDERING ---------
function renderTopics() {
  topicListEl.innerHTML = '';
  topics.forEach((t, idx) => {
    const li = document.createElement('li');
    li.textContent = t.name;
    if (idx === activeTopicIdx) li.className = 'active';
    li.onclick = async () => {
      activeTopicIdx = idx;
      await loadMessages();
      renderAll();
    };
    topicListEl.appendChild(li);
  });
}

function renderChat() {
  chatWindow.innerHTML = '';
  if (!topics[activeTopicIdx]) return;
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = msg.role;
    // AI styling: render Markdown (basic), or at least <br> for newlines
    if(msg.role === "assistant") {
      div.innerHTML = msg.content.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
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
addTopicBtn.onclick = async () => {
  const name = prompt("Topic name?");
  if (name) await saveTopic(name);
};
renameTopicBtn.onclick = async () => {
  if (!topics[activeTopicIdx]) return;
  const name = prompt("Rename topic?", topics[activeTopicIdx].name);
  if (name) await renameTopic(activeTopicIdx, name);
};
deleteTopicBtn.onclick = async () => {
  if (!topics[activeTopicIdx]) return;
  if (confirm("Delete this topic?")) await deleteTopic(activeTopicIdx);
};

chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;
  if (!topics[activeTopicIdx]) return;
  await addMessage("user", text);
  userInput.value = '';
  chatWindow.innerHTML += "<div class='system'>Thinking…</div>";
  chatWindow.scrollTop = chatWindow.scrollHeight;
  // Build context messages
  const contextMessages = messages.concat([{ role: "user", content: text }]);

  // Call Netlify LLM function
  const resp = await fetch("/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: contextMessages }),
  });
  const json = await resp.json();
  if (json.reply) {
    await addMessage("assistant", json.reply);
  } else {
    chatWindow.innerHTML += "<div class='system'>Error: "+(json.error||"Unknown")+"</div>";
  }
};

// ---------- INIT: check auth ----------
window.onload = async () => {
  let { data: { user: u }} = await supabase.auth.getUser();
  user = u;
  updateAuthUI();
  if (user) await loadData();
};