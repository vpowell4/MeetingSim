document.addEventListener("DOMContentLoaded", () => {
  // State


  const form = document.getElementById("sim-form");
  const dialogueBox = document.getElementById("dialogue");
  const summaryBox = document.getElementById("summary");
  const paramsBox = document.getElementById("params");

  const versionsList = document.getElementById("versions-list");
  const saveBtn = document.getElementById("save-versions");
  const loadInput = document.getElementById("load-versions");

  const agentList = document.getElementById("agent-list");
  const addAgentBtn = document.getElementById("add-agent");

  // Modal elements
  const modal = document.getElementById("agent-modal");
  const saveModal = document.getElementById("save-modal");
  const closeModal = document.getElementById("close-modal");

  // State

  let versions = [];

  let agents = [
    {
      name: "Alice",
      stance: "neutral",
      dominance: 1.0,
      persona: "Chair; brisk, diplomatic, outcome-oriented. Prefers structure.",
      traits: { interrupt: 0.2, conflict_avoid: 0.3, persuasion: 0.7 }
    },
    {
      name: "Bob",
      stance: "neutral",
      dominance: 1.5,
      persona: "Finance-minded; cost/risk focused; skeptical but pragmatic.",
      traits: { interrupt: 0.5, conflict_avoid: 0.2, persuasion: 0.6 }
    },
    {
      name: "Charlie",
      stance: "neutral",
      dominance: 0.7,
      persona: "Consensus-seeker; careful with language; asks for evidence.",
      traits: { interrupt: 0.05, conflict_avoid: 0.8, persuasion: 0.4 }
    },
    {
      name: "Dana",
      stance: "neutral",
      dominance: 1.2,
      persona: "Innovation-first; optimistic; pushes for bold options.",
      traits: { interrupt: 0.25, conflict_avoid: 0.3, persuasion: 0.65 }
    }
  ];


  function renderAgents() {
    agentList.innerHTML = "";
    agents.forEach((a, idx) => {
      const div = document.createElement("div");
      div.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
      div.innerHTML = `
          <span>
            <strong>${a.name}</strong> | 
            Stance: ${a.stance} | 
            Dominance: ${a.dominance} | 
            Traits: Int=${a.traits.interrupt}, CA=${a.traits.conflict_avoid}, Pers=${a.traits.persuasion} <br>
            <em>Persona: ${a.persona}</em>
          </span>
          <button type="button" class="bg-cyan-500 text-white px-2 py-1 rounded edit-btn" data-index="${idx}">Edit</button>
        `;
      agentList.appendChild(div);
    });

    document.querySelectorAll(".edit-btn").forEach(btn =>
      btn.addEventListener("click", (e) => openModal(parseInt(e.target.dataset.index)))
    );
  }

  function openModal(index) {
    const a = agents[index];
    document.getElementById("modal-agent-index").value = index;
    document.getElementById("modal-name").value = a.name;
    document.getElementById("modal-stance").value = a.stance;
    document.getElementById("modal-dominance").value = a.dominance;
    document.getElementById("modal-interrupt").value = a.traits.interrupt;
    document.getElementById("modal-conflict").value = a.traits.conflict_avoid;
    document.getElementById("modal-persuasion").value = a.traits.persuasion;
    document.getElementById("modal-persona").value = a.persona || "";
    modal.classList.remove("hidden");
  }

  // Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    modal.classList.add("hidden");
  }
});


  saveModal.addEventListener("click", () => {
    const idx = parseInt(document.getElementById("modal-agent-index").value);
    agents[idx] = {
      name: document.getElementById("modal-name").value,
      stance: document.getElementById("modal-stance").value,
      dominance: parseFloat(document.getElementById("modal-dominance").value),
      persona: document.getElementById("modal-persona").value,
      traits: {
        interrupt: parseFloat(document.getElementById("modal-interrupt").value),
        conflict_avoid: parseFloat(document.getElementById("modal-conflict").value),
        persuasion: parseFloat(document.getElementById("modal-persuasion").value)
      }
    };

    modal.classList.add("hidden");
    renderAgents();
  });

  closeModal.addEventListener("click", () => modal.classList.add("hidden"));

  addAgentBtn.addEventListener("click", () => {
    agents.push({ name: "NewAgent", stance: "neutral", dominance: 1.0, traits: { interrupt: 0.2, conflict_avoid: 0.5, persuasion: 0.5 } });
    renderAgents();
  });

  const deleteModal = document.getElementById("delete-agent");

  deleteModal.addEventListener("click", () => {
    const idx = parseInt(document.getElementById("modal-agent-index").value);
    if (!isNaN(idx)) {
      // remove agent from array
      agents.splice(idx, 1);
      renderAgents();
      modal.classList.add("hidden");
    }
  });

  loadInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      versions = JSON.parse(evt.target.result);
      renderVersions();
      if (versions.length > 0) {
        restoreVersion(versions.length - 1);
      }
    } catch (err) {
      alert("Failed to load versions: " + err.message);
    }
  };
  reader.readAsText(file);
});

  // Submit form
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    dialogueBox.textContent = "";
    summaryBox.textContent = "";
     const runBtn = form.querySelector("button[type='submit']");
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.classList.add("button-flash");
    runBtn.textContent = "Running...";
  }

    const issue = document.getElementById("issue").value;

    // Build structured params
    const params = {
      issue,
      agents: agents.map(a => a.name),
      stances: Object.fromEntries(agents.map(a => [a.name, a.stance])),
      dominance: Object.fromEntries(agents.map(a => [a.name, a.dominance])),
      traits: Object.fromEntries(agents.map(a => [a.name, a.traits])),
      personas: Object.fromEntries(agents.map(a => [a.name, a.persona]))
    };
    paramsBox.textContent = JSON.stringify(params, null, 2);

    // SSE
    const url = `/run/stream?issue=${encodeURIComponent(issue)}&agents=${encodeURIComponent(params.agents.join(","))}`
      + `&stances=${encodeURIComponent(JSON.stringify(params.stances))}`
      + `&dominance=${encodeURIComponent(JSON.stringify(params.dominance))}`
      + `&traits=${encodeURIComponent(JSON.stringify(params.traits))}`
      + `&personas=${encodeURIComponent(JSON.stringify(params.personas))}`;


    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "line") {
          // Dialogue line
          dialogueBox.textContent += data.line + "\n";
          dialogueBox.scrollTop = dialogueBox.scrollHeight;

        } else if (data.type === "final") {
          summaryBox.innerHTML = "";

          if (data.summary) {
            summaryBox.innerHTML += `
      <div class="mb-4 p-4 bg-white shadow rounded">
        <h3 class="text-lg font-bold mb-2">📝 Meeting Summary</h3>
        <p class="whitespace-pre-line text-gray-800">${data.summary}</p>
      </div>`;
          }

          if (data.decision) {
            summaryBox.innerHTML += `
      <div class="mb-4 p-4 bg-green-50 border border-green-300 shadow rounded">
        <h3 class="text-lg font-bold mb-2">✅ Final Decision</h3>
        <p class="font-semibold text-green-800">${data.decision}</p>
      </div>`;
          }

          if (data.options_summary) {
            summaryBox.innerHTML += `
      <div class="mb-4 p-4 bg-white shadow rounded">
        <h3 class="text-lg font-bold mb-2">📊 Options</h3>
        <pre class="whitespace-pre-wrap text-sm text-gray-700">${data.options_summary}</pre>
      </div>`;
          }

          if (data.metrics) {
            summaryBox.innerHTML += `
      <div class="mb-4 p-4 bg-white shadow rounded">
        <h3 class="text-lg font-bold mb-2">📈 Metrics</h3>
        <pre class="whitespace-pre-wrap text-sm text-gray-700">${JSON.stringify(data.metrics, null, 2)}</pre>
      </div>`;
          }

          eventSource.close();
                  if (runBtn) {
          runBtn.disabled = false;
          runBtn.classList.remove("button-flash");
          runBtn.textContent = "Run Simulation";
        }

          // Save to versions history
          versions.push({
            timestamp: new Date().toLocaleString(),
            params,
            result: {
              decision: data.decision,
              summary: data.summary,
              dialogue: dialogueBox.textContent.split("\n").filter(Boolean),
              options_summary: data.options_summary,
              metrics: data.metrics
            }
          });
          renderVersions();
        }
        else {
          console.warn("Unhandled SSE payload:", data);
        }
      } catch (err) {
        console.error("Failed to parse SSE data:", event.data, err);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE failed.");
      eventSource.close();
       if (runBtn) {
      runBtn.disabled = false;
      runBtn.classList.remove("button-flash");
      runBtn.textContent = "Run Simulation";
    }
    };
  });

  function renderVersions() {
    const container = document.getElementById("versions");
    container.innerHTML = "";

    if (versions.length === 0) {
      container.innerHTML = `<p class="text-gray-500">No simulations saved yet.</p>`;
      return;
    }

    versions.forEach((v, idx) => {
      const div = document.createElement("div");
      div.className = "bg-white shadow rounded p-4";

      div.innerHTML = `
      <details class="space-y-3">
        <summary class="cursor-pointer flex justify-between items-center">
          <span class="font-semibold">Version ${idx + 1} — ${v.timestamp}</span>
          <span class="text-sm text-gray-500">Decision: ${v.result.decision || "Pending"}</span>
        </summary>

        <div class="mt-3 space-y-3">
          <div>
            <h4 class="font-semibold">Issue</h4>
            <p class="text-sm text-gray-700">${v.params.issue}</p>
          </div>

          <div>
            <h4 class="font-semibold">Dialogue</h4>
            <pre class="bg-gray-50 text-gray-800 p-2 rounded text-sm h-40 overflow-y-scroll whitespace-pre-wrap">
${v.result.dialogue.join("\n")}
            </pre>
          </div>

          <div>
            <h4 class="font-semibold">Summary</h4>
            <p class="text-sm whitespace-pre-line text-gray-800">${v.result.summary}</p>
          </div>

          <div>
            <h4 class="font-semibold">Options</h4>
            <pre class="bg-gray-50 text-sm text-gray-700 p-2 rounded whitespace-pre-wrap">${v.result.options_summary}</pre>
          </div>

          <div>
            <h4 class="font-semibold">Metrics</h4>
            <pre class="bg-gray-50 text-sm text-gray-700 p-2 rounded whitespace-pre-wrap">${JSON.stringify(v.result.metrics, null, 2)}</pre>
          </div>

          <div class="pt-2">
            <button type="button" class="restore-btn bg-cyan-600 text-white px-3 py-1 rounded hover:bg-cyan-700" data-index="${idx}">
              Restore This Version
            </button>
          </div>
        </div>
      </details>
    `;
      container.appendChild(div);
    });

    // attach restore button events
    document.querySelectorAll(".restore-btn").forEach(btn =>
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.target.dataset.index);
        restoreVersion(idx);
      })
    );
  }
  function restoreVersion(idx) {
    const v = versions[idx];
    if (!v) return;

    // Restore issue
    document.getElementById("issue").value = v.params.issue;

    // Rebuild agents array from saved params
    agents = v.params.agents.map(name => ({
      name,
      stance: v.params.stances[name],
      dominance: v.params.dominance[name],
      persona: v.params.personas[name],
      traits: v.params.traits[name]
    }));

    renderAgents();

    // Scroll to top of form so user sees restored settings
    document.getElementById("sim-form").scrollIntoView({ behavior: "smooth" });
  }

      saveBtn.addEventListener("click", async () => {
  try {
    // Open Save As dialog
    const handle = await window.showSaveFilePicker({
      suggestedName: "meeting_versions.json",
      types: [
        {
          description: "JSON Files",
          accept: { "application/json": [".json"] }
        }
      ]
    });

    // Create a writable stream
    const writable = await handle.createWritable();

    // Write the JSON content
    await writable.write(JSON.stringify(versions, null, 2));

    // Close the file
    await writable.close();

    alert("Versions saved successfully!");
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Save failed:", err);
      alert("Save failed: " + err.message);
    }
  }
});


    // Load button → read JSON file
    loadInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          versions = JSON.parse(evt.target.result);
          renderVersions();
        } catch (err) {
          alert("Failed to load versions: " + err.message);
        }
      };
      reader.readAsText(file);
    });

  // Initial render
  renderAgents();
  renderVersions();

});
