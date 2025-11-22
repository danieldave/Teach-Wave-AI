/* app.js — TeachWave AI (persona upgrade + PDF/DOCX fixes + magic switch)
   - Enhanced persona-driven prompts (Teacher/Student/Parent)
   - Magic Switch floating UI: Deep Reasoning + Creative Mode
   - Robust PDF export (append to DOM, wait for images)
   - Clean, fast DOC/DOCX export
   - Preserves all existing IDs / firebase usage
*/

console.log("TeachWave AI — upgraded app.js loaded");

// ----- CONFIG -----
const AI_ENDPOINT = "https://teach-wave-ai.vercel.app/api/generate";
const COVER_ENDPOINT = "https://teach-wave-ai.vercel.app/api/cover";
let useMock = false; // set true to use a mock response while testing offline

// ----- DOM -----
const personaEl = document.getElementById("persona");
const subjectEl = document.getElementById("subject");
const topicEl = document.getElementById("topic");
const gradeEl = document.getElementById("grade");
const durationEl = document.getElementById("duration");
const teachingStyleEl = document.getElementById("teachingStyle");
const presetEl = document.getElementById("preset");
const languageEl = document.getElementById("language");
const notesEl = document.getElementById("notes");

const generateBtn = document.getElementById("generateBtn");
const genLoader = document.getElementById("genLoader");
const clearBtn = document.getElementById("clearBtn");
const output = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");
const saveBtn = document.getElementById("saveBtn");
const downloadBtn = document.getElementById("downloadBtn");
const docxBtn = document.getElementById("docxBtn");
const simplifyBtn = document.getElementById("simplifyBtn");
const savedList = document.getElementById("savedList");
const noSaved = document.getElementById("noSaved");
const pdfExportArea = document.getElementById("pdf-export-area");

// ----- LANG MAP -----
const LANG = {
  "English":"English","French":"French","Spanish":"Spanish","Arabic":"Arabic",
  "German":"German","Chinese":"Chinese","Yoruba":"Yoruba","Igbo":"Igbo","Hausa":"Hausa"
};

// ----- FLOATING MAGIC SWITCH (inject) -----
(function injectMagicSwitch(){
  const panel = document.createElement('div');
  panel.id = 'tw-magic-switch';
  panel.innerHTML = `
    <style>
      #tw-magic-switch {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 99999;
        background: rgba(255,255,255,0.86);
        backdrop-filter: blur(6px);
        border-radius: 12px;
        box-shadow: 0 8px 28px rgba(10,10,30,0.12);
        padding: 8px 10px;
        font-family: Inter, sans-serif;
        display:flex;
        gap:8px;
        align-items:center;
        border: 1px solid rgba(0,0,0,0.06);
      }
      #tw-magic-switch label { font-size:12px; color:#222; margin-right:6px; }
      #tw-magic-switch select, #tw-magic-switch input[type="checkbox"] { transform:scale(0.96); }
      #tw-magic-switch .hint { font-size:11px; color:#666; margin-left:6px; }
    </style>
    <select id="tw-detail" title="Detail level">
      <option value="standard">Standard</option>
      <option value="detailed">Detailed</option>
      <option value="concise">Concise</option>
    </select>
  `;
  document.body.appendChild(panel);
})();

// small helper to read switch values
function magicSettings() {
  const deep = document.getElementById('tw-deep')?.checked || false;
  const creative = document.getElementById('tw-creative')?.checked || false;
  const detail = document.getElementById('tw-detail')?.value || 'standard';
  return { deep, creative, detail };
}

// ----- PROMPT TEMPLATES (persona-aware, reasoning + magic actions) -----
function teacherPrompt(form, magic) {
  return `
You are a master classroom teacher and curriculum designer.
Language: ${LANG[form.language]}
Detail level: ${magic.detail}

Write a professional, curriculum-aligned lesson plan for:
Topic: ${form.topic}
Subject: ${form.subject}
Grade: ${form.grade}
Duration: ${form.duration}
Style: ${form.teachingStyle}
Preset: ${form.preset}

Include:
1) Title
2) 3-5 Learning objectives (measurable)
3) Prerequisites
4) Warm-up (5-10 mins)
5) Step-by-step teaching guide (with estimated minutes)
6) Differentiation strategies (support & enrichment)
7) Assessment (rubrics / success criteria)
8) Materials & resources
9) Student activities & extension
10) Suggested homework
11) Brief teacher tips and safety notes

Also provide:
- Estimated time per step
- Suggested modifications for low-resource settings
- "Magic Actions": 3 short creative hooks or formulas to spice the lesson

${magic.deep ? "When appropriate, show step-by-step reasoning and explain WHY each activity supports the objectives." : ""}
${magic.creative ? "Use creative metaphors, classroom games, and cross-curricular links." : ""}

Respond ONLY in ${LANG[form.language]}.
`.trim();
}

function studentPrompt(form, magic) {
  return `
You are a friendly, clever peer in the same grade as the learner.
Language: ${LANG[form.language]}
Detail level: ${magic.detail}

Explain the lesson content for:
Topic: ${form.topic}
Subject: ${form.subject}
Grade: ${form.grade}
Duration: ${form.duration}
Style: ${form.teachingStyle}

Include:
- A short, exciting title
- 3 simple learning objectives (I can understand)
- A short warm-up or hook that gets me curious
- Step-by-step guide to understand the main idea (use simple language)
- Highlight 3 things students usually find difficult and how to tackle each (with micro-tasks)
- "Magic Actions": quick tricks, memory mnemonics, or a tiny hands-on challenge
- 2 practice questions with simple solutions

Make it encouraging, creative and practical.
${magic.deep ? "Show how you'd reason through one example, thinking aloud." : ""}
Respond ONLY in ${LANG[form.language]}.
`.trim();
}

function parentPrompt(form, magic) {
  return `
You are a helpful parent coach who assumes the parent has little to no knowledge of the topic.
Language: ${LANG[form.language]}
Detail level: ${magic.detail}

Explain:
Topic: ${form.topic}
Subject: ${form.subject}
Grade: ${form.grade}
Duration: ${form.duration}

Include:
- A clear, plain-language explanation of the main idea (start from basics)
- Simple analogies and home examples
- What the parent can do to help at home (step-by-step)
- 3 likely questions a child may ask and suggested ways to respond
- "Magic Actions": easy demonstrations or gestures parents can use to make the idea click
- Short practice tasks parents can do with the child (5–10 minutes)

Use the simplest language and assume no prior subject knowledge.
${magic.deep ? "If needed, show the simple reasoning steps so the parent can follow." : ""}
Respond ONLY in ${LANG[form.language]}.
`.trim();
}

// wrapper to choose persona template
function createPrompt(form) {
  const magic = magicSettings();
  if (form.persona === "Teacher") return teacherPrompt(form, magic);
  if (form.persona === "Student") return studentPrompt(form, magic);
  return parentPrompt(form, magic); // default Parent
}

// ----- MOCK (optional) -----
function mockLessonPlan(form) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(`### MOCK Lesson — ${form.topic}\nThis is mock content. Replace useMock=false to use real AI.`);
    }, 700);
  });
}

// ----- CALL AI -----
async function callAI(prompt, language) {
  if (useMock) return await mockLessonPlan({topic: prompt});
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ prompt, language })
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>res.statusText);
      throw new Error(`AI backend ${res.status} — ${txt}`);
    }
    const data = await res.json();
    return data.output || data.output_text || "⚠ No AI content returned.";
  } catch (err) {
    console.error("callAI error:", err);
    return `❌ AI Error: ${err.message || err}`;
  }
}

// ----- COVER GENERATOR (unchanged, robust) -----
async function generateCover(subject, topic, style="modern") {
  try {
    const res = await fetch(COVER_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ subject, topic, style })
    });
    if (!res.ok) throw new Error("Cover generation failed");
    const data = await res.json();
    return data.dataUrl || "";
  } catch (err) {
    console.warn("generateCover:", err);
    return "";
  }
}

// ----- UI HELPERS -----
function setGenerating(on) {
  generateBtn.disabled = on;
  if (genLoader) genLoader.hidden = !on;
  generateBtn.innerText = on ? "Generating..." : "Generate Lesson Plan";
}

function showToast(msg, ms=1400) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', right:'18px', bottom: '18px', background:'#111', color:'#fff',
    padding:'8px 12px', borderRadius:'10px', zIndex: 999999, boxShadow: '0 10px 34px rgba(0,0,0,0.2)'
  });
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), ms);
}

// ----- GENERATE FLOW -----
generateBtn.addEventListener("click", async () => {
  setGenerating(true);
  output.innerHTML = "<em>Generating lesson plan…</em>";

  const formData = {
    persona: personaEl.value,
    subject: subjectEl.value,
    topic: topicEl.value,
    grade: gradeEl.value,
    duration: durationEl.value,
    teachingStyle: teachingStyleEl.value,
    preset: presetEl.value,
    language: languageEl.value,
    notes: notesEl.value
  };

  try {
    const prompt = createPrompt(formData);
    const result = await callAI(prompt, formData.language);
    // result may be markdown — parse with marked
    output.innerHTML = marked.parse(result || "No response from AI.");
    // optionally inject "Magic Actions" block extracted from prompts (client-side)
    // if model didn't include them, offer a small automatic magic-actions suggestion
    setGenerating(false);
    showToast("Lesson generated");
  } catch (err) {
    setGenerating(false);
    console.error(err);
    output.innerHTML = `<p style="color:crimson;">Error generating lesson — see console.</p>`;
  }
});

// ----- CLEAR -----
clearBtn.addEventListener("click", () => {
  topicEl.value = "";
  notesEl.value = "";
  output.innerHTML = "Your lesson plan will appear here...";
});

// ----- COPY -----
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(output.innerText).then(() => {
    copyBtn.innerText = "Copied!";
    setTimeout(()=> copyBtn.innerText = "Copy", 1400);
  });
});

// ----- SAVE to Firestore (keeps your behavior) -----
saveBtn.addEventListener("click", async () => {
  const user = TW.auth.currentUser;
  if (!user) {
    alert("Connecting to Firebase... please wait and try again.");
    return;
  }
  const html = output.innerHTML;
  if (!html || html.trim().length < 5) return alert("No content to save.");

  const coverDataUrl = await generateCover(subjectEl.value, topicEl.value, "modern");

  const doc = {
    uid: user.uid,
    persona: personaEl.value,
    subject: subjectEl.value,
    topic: topicEl.value,
    grade: gradeEl.value,
    language: languageEl.value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    html,
    text: output.innerText,
    cover: coverDataUrl
  };

  try {
    const ref = await TW.db.collection("saved_lessons").add(doc);
    showToast("Saved!");
    loadSaved(); // refresh UI
  } catch (e) {
    console.error("Save failed:", e);
    alert("Save failed: " + (e.message || e));
  }
});

// ----- ROBUST PDF EXPORT (fixed blank issues) -----
// Ensures wrapper is appended to DOM, waits for images to load and small delay.
downloadBtn.addEventListener("click", async () => {
  if (!output.innerHTML || !output.innerHTML.trim()) {
    return alert("Nothing to export — generate a lesson first.");
  }

  const title = (topicEl.value || 'Lesson Plan').replace(/[^\w-_ ]+/g,'').trim();
  const cover = await generateCover(subjectEl.value, topicEl.value, "modern");

  // Build wrapper and append to pdfExportArea (so styles are applied)
  const wrapper = document.createElement('div');
  wrapper.style.fontFamily = "Inter, sans-serif";
  wrapper.style.padding = "28px";
  wrapper.style.color = "#111";
  wrapper.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      ${cover ? `<img src="${cover}" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:18px;" />` : ''}
      <h1 style="text-align:center;color:#4b00ff;margin-bottom:6px;">${(topicEl.value || 'Lesson Plan')}</h1>
      <div style="text-align:center;color:#444;margin-bottom:12px;">${subjectEl.value} • ${gradeEl.value} • ${durationEl.value}</div>
      <div>${output.innerHTML}</div>
      <div style="font-size:11px;color:#777;text-align:center;margin-top:18px;">Generated with TeachWave AI • ${new Date().toLocaleString()}</div>
    </div>
  `;

  pdfExportArea.appendChild(wrapper);

  // Wait for images to load (if any) and let the browser paint
  const imgs = wrapper.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(img => {
    return new Promise(res => {
      if (img.complete) return res();
      img.onload = img.onerror = res;
      // set a timeout fallback in case of CORS or slow load
      setTimeout(res, 1500);
    });
  }));

  // small delay to ensure rendering
  await new Promise(r => setTimeout(r, 260));

  try {
    await html2pdf().from(wrapper).set({
      margin: 12,
      filename: `TeachWave_${title.replace(/\s+/g,'_')}.pdf`,
      html2canvas: { scale: 2, useCORS: true, allowTaint: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
    showToast("PDF downloaded");
  } catch (err) {
    console.error("PDF generation error:", err);
    alert("PDF generation failed. See console for details.");
  } finally {
    // cleanup wrapper to keep the DOM tidy
    if (pdfExportArea.contains(wrapper)) pdfExportArea.removeChild(wrapper);
  }
});

// ----- CLEAN & FAST DOC/DOCX EXPORT -----
// Produces a clean HTML wrapper and exports as a .doc file Word can open quickly.
docxBtn.addEventListener("click", () => {
  if (!output.innerHTML || !output.innerHTML.trim()) {
    return alert("Nothing to export.");
  }

  const coverDataUrl = ""; // optional: we could generate and inline cover here
  let cleaned = output.innerHTML
    // remove script/style tags, inline heavy attributes
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/ class="[^"]*"/g, '')
    .replace(/ style="[^"]*"/g, '');

  const docTitle = topicEl.value || "Lesson";
  const headerHtml = `<div style="text-align:center;margin-bottom:12px;">
    <h1 style="color:#4b00ff;">${docTitle}</h1>
    <div style="color:#444;">${subjectEl.value} • ${gradeEl.value}</div>
    <hr style="margin:12px 0 18px 0;"/>
  </div>`;

  const full = `<!doctype html><html><head><meta charset="utf-8"></head><body>${headerHtml}${cleaned}</body></html>`;

  const blob = new Blob(["\ufeff", full], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docTitle.replace(/\s+/g,'_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("DOC exported");
});

// ----- SIMPLIFY (re-run AI to simplify for persona) -----
simplifyBtn.addEventListener("click", async () => {
  if (!output.innerText || !output.innerText.trim()) return alert("No content to simplify.");
  simplifyBtn.disabled = true;
  simplifyBtn.innerText = "Simplifying...";

  const persona = personaEl.value || "Student";
  // Add instruction to keep formatting
  const prompt = `Please simplify the following for a ${persona} but keep headings and bullets. Make it clear and short:\n\n${output.innerText}`;

  const result = await callAI(prompt, languageEl.value);
  output.innerHTML = marked.parse(result || "No response");
  simplifyBtn.disabled = false;
  simplifyBtn.innerText = "Make Simpler";
  showToast("Simplified");
});

// ----- LOAD SAVED (keeps your function) -----
async function loadSaved() {
  savedList.innerHTML = "";
  const user = TW.auth.currentUser;
  if (!user) {
    noSaved.style.display = 'block';
    return;
  }
  const snapshot = await TW.db.collection("saved_lessons")
    .where("uid", "==", user.uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  if (snapshot.empty) {
    noSaved.style.display = 'block';
    return;
  }
  noSaved.style.display = 'none';
  snapshot.forEach(doc => {
    const data = doc.data();
    const li = document.createElement('li');
    li.className = 'saved-item';
    const title = data.topic ? `${data.topic} — ${data.subject}` : "Saved Lesson";
    li.innerHTML = `
      <div style="flex:1">
        <strong>${title}</strong>
        <div class="muted" style="font-size:0.85rem">${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : ''}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="small" onclick="viewSaved('${doc.id}')"><i class="fas fa-eye"></i></button>
        <button class="small" onclick="downloadSaved('${doc.id}')"><i class="fas fa-download"></i></button>
        <button class="small" onclick="deleteSaved('${doc.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    savedList.appendChild(li);
  });
}

// expose helper functions for saved list actions (unchanged)
window.viewSaved = async function(id) {
  const doc = await TW.db.collection("saved_lessons").doc(id).get();
  if (!doc.exists) return alert("Not found");
  output.innerHTML = doc.data().html || doc.data().text || "Empty";
};

window.downloadSaved = async function(id) {
  const doc = await TW.db.collection("saved_lessons").doc(id).get();
  if (!doc.exists) return alert("Not found");
  const html = doc.data().html || doc.data().text;

  pdfExportArea.innerHTML = `
    <div style="font-family:Inter; padding:20px;">
      <h1 style="color:#4b00ff;text-align:center;">Saved Lesson</h1>
      <div>${html}</div>
    </div>
  `;

  const wrapper = pdfExportArea.firstElementChild;
  setTimeout(() => {
    html2pdf().set({ margin: 12, filename: `SavedLesson_${id}.pdf`, html2canvas: { scale: 2 } }).from(wrapper).save()
      .then(() => { pdfExportArea.innerHTML = ''; });
  }, 300);
};

window.deleteSaved = async function(id) {
  if (!confirm("Delete this saved lesson?")) return;
  await TW.db.collection("saved_lessons").doc(id).delete();
  loadSaved();
};

// ----- AUTH WATCH -----
TW.auth.onAuthStateChanged(user => {
  if (user) loadSaved();
});

// ----- INIT UI -----
if (genLoader) genLoader.hidden = true;
if (noSaved) noSaved.style.display = 'block';

// keyboard shortcut to download PDF: Ctrl/Cmd + D (convenience)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    downloadBtn.click();
  }
});
