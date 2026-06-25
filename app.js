"use strict";

const state = {
  workbook: null,
  worksheetName: "",
  rows: [],
  matriculeKey: "",
  headerCodeKey: "",
  fileName: "",
  year: "24",
  currentCode: 1,
  codeWidth: 3,
  processed: 0,
  history: [],
  undo: [],
  recognition: null,
  voiceActive: false,
};

const els = {
  setupPanel: document.querySelector("#setupPanel"),
  workPanel: document.querySelector("#workPanel"),
  fileInput: document.querySelector("#fileInput"),
  yearInput: document.querySelector("#yearInput"),
  startCodeInput: document.querySelector("#startCodeInput"),
  autoYearInput: document.querySelector("#autoYearInput"),
  startButton: document.querySelector("#startButton"),
  searchInput: document.querySelector("#searchInput"),
  saveButton: document.querySelector("#saveButton"),
  clearButton: document.querySelector("#clearButton"),
  undoButton: document.querySelector("#undoButton"),
  exportButton: document.querySelector("#exportButton"),
  voiceToggle: document.querySelector("#voiceToggle"),
  voiceStatus: document.querySelector("#voiceStatus"),
  statusText: document.querySelector("#statusText"),
  statusCard: document.querySelector(".status-card"),
  matchPreview: document.querySelector("#matchPreview"),
  matchesList: document.querySelector("#matchesList"),
  historyList: document.querySelector("#historyList"),
  metricYear: document.querySelector("#metricYear"),
  metricCode: document.querySelector("#metricCode"),
  metricProcessed: document.querySelector("#metricProcessed"),
  metricRemaining: document.querySelector("#metricRemaining"),
  metricCoded: document.querySelector("#metricCoded"),
  choiceDialog: document.querySelector("#choiceDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMessage: document.querySelector("#dialogMessage"),
  dialogChoices: document.querySelector("#dialogChoices"),
};

const matriculeAliases = ["matricule", "studentmatricule", "matricules", "studentid", "studentnumber"];
const headerCodeAliases = ["headercode", "header", "code"];

function normalizeText(value) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatCode(number) {
  return String(number).padStart(Math.max(state.codeWidth, 1), "0");
}

function extractYear(matricule) {
  const normalized = normalizeText(matricule);
  const cMatch = normalized.match(/(^|\D)(\d{2})C\d+/);
  if (cMatch) return cMatch[2];
  const anyMatch = normalized.match(/(^|\D)(\d{2})(\D|$)/);
  return anyMatch ? anyMatch[2] : "";
}

function extractSuffix(matricule) {
  const normalized = normalizeText(matricule);
  const match = normalized.match(/C?(\d+)$/);
  return match ? match[1] : normalized;
}

function parseCode(value) {
  const cleaned = String(value).trim();
  if (!/^\d+$/.test(cleaned)) throw new Error("Starting code must contain only digits.");
  return { number: Number(cleaned), width: cleaned.length };
}

function setStatus(message, tone = "success") {
  els.statusText.textContent = message;
  els.statusCard.classList.toggle("warning", tone === "warning");
  els.statusCard.classList.toggle("success", tone === "success");
}

function detectColumns(rows) {
  const firstRow = rows[0] || {};
  const keys = Object.keys(firstRow);
  const matriculeKey = keys.find((key) => matriculeAliases.includes(normalizeHeader(key)));
  const headerCodeKey = keys.find((key) => headerCodeAliases.includes(normalizeHeader(key)));
  if (!matriculeKey) throw new Error("Missing Matricule column.");
  if (!headerCodeKey) throw new Error("Missing Header Code column.");
  return { matriculeKey, headerCodeKey };
}

function makeRecords() {
  return state.rows
    .map((row, index) => {
      const matricule = String(row[state.matriculeKey] ?? "").trim();
      return {
        index,
        rowNumber: index + 2,
        matricule,
        headerCode: String(row[state.headerCodeKey] ?? "").trim(),
        normalized: normalizeText(matricule),
        year: extractYear(matricule),
        suffix: extractSuffix(matricule),
      };
    })
    .filter((record) => record.matricule);
}

function findMatches(query) {
  const cleaned = normalizeText(query);
  if (!cleaned) return [];
  return makeRecords().filter((record) => (
    record.normalized === cleaned ||
    record.normalized.endsWith(cleaned) ||
    (/^\d+$/.test(cleaned) && record.suffix.endsWith(cleaned))
  ));
}

function renderDashboard() {
  const records = makeRecords();
  const coded = records.filter((record) => record.headerCode).length;
  els.metricYear.textContent = state.year;
  els.metricCode.textContent = formatCode(state.currentCode);
  els.metricProcessed.textContent = String(state.processed);
  els.metricRemaining.textContent = String(records.length - coded);
  els.metricCoded.textContent = `${coded} / ${records.length}`;
  renderHistory();
  previewSearch();
}

function renderHistory() {
  els.historyList.innerHTML = "";
  if (!state.history.length) {
    els.historyList.innerHTML = `<div class="empty">No assignments yet.</div>`;
    return;
  }
  for (const item of state.history.slice(0, 20)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span>${item.code}</span><strong>${item.matricule}</strong><span>${item.note || ""}</span>`;
    els.historyList.append(row);
  }
}

function renderMatches(matches) {
  els.matchesList.innerHTML = "";
  if (!matches.length) {
    els.matchesList.innerHTML = `<div class="empty">No matches.</div>`;
    return;
  }
  for (const match of matches.slice(0, 100)) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = "76px 1fr 90px 72px";
    row.innerHTML = `<span>Row ${match.rowNumber}</span><strong>${match.matricule}</strong><span>${match.headerCode || ""}</span>`;
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = "Use";
    button.addEventListener("click", () => assignRecord(match));
    row.append(button);
    els.matchesList.append(row);
  }
}

function previewSearch() {
  const query = els.searchInput.value.trim();
  const matches = findMatches(query);
  renderMatches(matches);
  if (!query) {
    els.matchPreview.textContent = "Type a matricule or say the digits.";
  } else if (matches.length === 1) {
    els.matchPreview.textContent = `Found: ${matches[0].matricule} | Assign Code: ${formatCode(state.currentCode)}`;
  } else if (matches.length > 1) {
    els.matchPreview.textContent = `${matches.length} possible records found. Press Enter, click Save, or say save.`;
  } else {
    els.matchPreview.textContent = "No matching matricule found.";
  }
}

async function loadWorkbook(file) {
  if (typeof XLSX === "undefined") {
    throw new Error("Excel library failed to load. Check your internet connection or use a local SheetJS copy.");
  }
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const worksheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[worksheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  if (!rows.length) throw new Error("The first worksheet has no data rows.");
  const columns = detectColumns(rows);
  state.workbook = workbook;
  state.worksheetName = worksheetName;
  state.rows = rows;
  state.matriculeKey = columns.matriculeKey;
  state.headerCodeKey = columns.headerCodeKey;
  state.fileName = file.name;
}

async function startSession() {
  const file = els.fileInput.files[0];
  if (!file) {
    setStatus("Choose an Excel file first.", "warning");
    return;
  }
  try {
    const parsedCode = parseCode(els.startCodeInput.value);
    state.year = String(els.yearInput.value).trim().slice(-2).padStart(2, "0");
    state.currentCode = parsedCode.number;
    state.codeWidth = parsedCode.width;
    state.processed = 0;
    state.history = [];
    state.undo = [];
    await loadWorkbook(file);
    els.setupPanel.classList.add("hidden");
    els.workPanel.classList.remove("hidden");
    renderDashboard();
    setStatus(`Loaded ${makeRecords().length} records from ${file.name}.`);
    focusSearch(true);
  } catch (error) {
    setStatus(error.message, "warning");
  }
}

function focusSearch(clear = false) {
  if (clear) els.searchInput.value = "";
  window.setTimeout(() => {
    els.searchInput.focus();
    els.searchInput.select();
    previewSearch();
  }, 30);
}

function duplicateRecords(normalized) {
  return makeRecords().filter((record) => record.normalized === normalized);
}

function chooseRecord(title, message, records) {
  return new Promise((resolve) => {
    els.dialogTitle.textContent = title;
    els.dialogMessage.textContent = message;
    els.dialogChoices.innerHTML = "";
    for (const record of records) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dialog-choice";
      button.innerHTML = `<span>Row ${record.rowNumber}</span><strong>${record.matricule}</strong><span>${record.headerCode || ""}</span>`;
      button.addEventListener("click", () => {
        els.choiceDialog.close();
        resolve(record);
      });
      els.dialogChoices.append(button);
    }
    els.choiceDialog.addEventListener("close", () => {
      if (els.choiceDialog.returnValue === "cancel") resolve(null);
    }, { once: true });
    els.choiceDialog.showModal();
  });
}

async function resolveMatch(query, matches) {
  const sameYear = matches.filter((record) => record.year === state.year);
  const otherYear = matches.filter((record) => record.year && record.year !== state.year);
  const isShortSearch = normalizeText(query).length < Math.max(...matches.map((record) => record.normalized.length));

  if (matches.length === 1) {
    const duplicates = duplicateRecords(matches[0].normalized);
    if (duplicates.length > 1) return chooseRecord("Duplicate matricule detected", "Choose the row to update.", duplicates);
  }

  if (els.autoYearInput.checked && sameYear.length === 1) return sameYear[0];

  if (otherYear.length && isShortSearch) {
    const expected = sameYear.length ? sameYear.map((record) => `${record.matricule} row ${record.rowNumber}`).join(", ") : `academic year ${state.year}`;
    const alsoFound = otherYear.map((record) => `${record.matricule} row ${record.rowNumber}`).join(", ");
    const ok = window.confirm(`Similar matricule exists in another academic year.\n\nExpected: ${expected}\nAlso found: ${alsoFound}\n\nContinue?`);
    if (!ok) return chooseRecord("Choose record", "Select the correct student record.", matches);
    if (sameYear.length === 1) return sameYear[0];
    if (sameYear.length > 1) return chooseRecord("Multiple expected-year records", "Choose the row to update.", sameYear);
    return chooseRecord("No exact year match", "Choose the row to code.", matches);
  }

  if (matches.length === 1) return matches[0];
  return chooseRecord("Multiple matches", "Choose the row to update.", matches);
}

async function saveCurrentMatch() {
  const query = els.searchInput.value.trim();
  if (!query) {
    setStatus("Search is empty.", "warning");
    focusSearch();
    return;
  }
  const matches = findMatches(query);
  if (!matches.length) {
    setStatus("No matching matricule found.", "warning");
    focusSearch(true);
    return;
  }
  const record = await resolveMatch(query, matches);
  if (record) assignRecord(record);
}

function assignRecord(record) {
  const existing = String(state.rows[record.index][state.headerCodeKey] ?? "").trim();
  const nextCode = formatCode(state.currentCode);
  if (existing && !window.confirm(`This matricule already has code ${existing}.\n\nReplace it with ${nextCode}?`)) {
    setStatus("Skipped already coded record.", "warning");
    focusSearch(true);
    return;
  }

  state.undo.push({ index: record.index, matricule: record.matricule, previousCode: existing, assignedCode: nextCode, previousCurrentCode: state.currentCode });
  state.rows[record.index][state.headerCodeKey] = nextCode;
  state.currentCode += 1;
  state.processed += 1;
  state.history.unshift({ matricule: record.matricule, code: nextCode });
  state.history = state.history.slice(0, 20);
  setStatus(`Assigned ${nextCode} to ${record.matricule}.`);
  renderDashboard();
  focusSearch(true);
}

function undoLast() {
  const action = state.undo.pop();
  if (!action) {
    setStatus("Nothing to undo.", "warning");
    focusSearch();
    return;
  }
  state.rows[action.index][state.headerCodeKey] = action.previousCode;
  state.currentCode = action.previousCurrentCode;
  state.processed = Math.max(0, state.processed - 1);
  state.history.unshift({ matricule: action.matricule, code: action.assignedCode, note: "undone" });
  setStatus(`Undid assignment for ${action.matricule}.`);
  renderDashboard();
  focusSearch();
}

function exportWorkbook() {
  if (!state.workbook) return;
  const worksheet = XLSX.utils.json_to_sheet(state.rows);
  state.workbook.Sheets[state.worksheetName] = worksheet;
  const base = state.fileName.replace(/\.[^.]+$/, "");
  XLSX.writeFile(state.workbook, `${base}_Coded.xlsx`);
  setStatus("Exported updated Excel file.");
  focusSearch();
}

function wordsToDigits(text) {
  const map = new Map([
    ["zero", "0"], ["oh", "0"], ["o", "0"],
    ["one", "1"], ["won", "1"],
    ["two", "2"], ["to", "2"], ["too", "2"],
    ["three", "3"], ["tree", "3"],
    ["four", "4"], ["for", "4"],
    ["five", "5"], ["six", "6"], ["seven", "7"],
    ["eight", "8"], ["ate", "8"], ["nine", "9"],
  ]);
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map((word) => /^\d+$/.test(word) ? word : map.get(word) || "").join("");
}

function handleVoicePhrase(phrase) {
  const lower = phrase.toLowerCase().trim();
  els.voiceStatus.textContent = `Heard: ${phrase}`;
  if (/\b(save|saved|code|enter|okay|ok)\b/.test(lower)) {
    saveCurrentMatch();
    return;
  }
  if (/\b(clear|reset)\b/.test(lower)) {
    focusSearch(true);
    return;
  }
  if (/\b(undo|back)\b/.test(lower)) {
    undoLast();
    return;
  }
  const digits = wordsToDigits(lower);
  if (digits) {
    els.searchInput.value = digits;
    previewSearch();
    return;
  }
  setStatus("Voice command not recognized. Say digits, save, clear, or undo.", "warning");
}

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.voiceToggle.disabled = true;
    els.voiceStatus.textContent = "Voice recognition is not supported in this browser. Use Chrome or Edge.";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.addEventListener("result", (event) => {
    const result = event.results[event.results.length - 1];
    if (result.isFinal) handleVoicePhrase(result[0].transcript);
  });
  recognition.addEventListener("end", () => {
    if (state.voiceActive) {
      try { recognition.start(); } catch (_error) { window.setTimeout(() => recognition.start(), 250); }
    }
  });
  recognition.addEventListener("error", (event) => {
    els.voiceStatus.textContent = `Voice error: ${event.error}`;
  });
  state.recognition = recognition;
}

function toggleVoice() {
  if (!state.recognition) return;
  state.voiceActive = els.voiceToggle.checked;
  try {
    if (state.voiceActive) {
      state.recognition.start();
      els.voiceStatus.textContent = "Voice on. Say digits, then say save.";
    } else {
      state.recognition.stop();
      els.voiceStatus.textContent = "Voice off.";
    }
  } catch (error) {
    els.voiceStatus.textContent = error.message;
  }
}

els.startButton.addEventListener("click", startSession);
els.searchInput.addEventListener("input", previewSearch);
els.searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") saveCurrentMatch(); });
els.saveButton.addEventListener("click", saveCurrentMatch);
els.clearButton.addEventListener("click", () => focusSearch(true));
els.undoButton.addEventListener("click", undoLast);
els.exportButton.addEventListener("click", exportWorkbook);
els.voiceToggle.addEventListener("change", toggleVoice);
setupVoice();
