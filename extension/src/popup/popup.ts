const logEl = document.getElementById("log");

const render = (events: unknown[]): void => {
  if (!logEl) {
    return;
  }
  if (events.length === 0) {
    logEl.textContent = "No events yet.";
    return;
  }
  logEl.innerHTML = events
    .slice(-20)
    .reverse()
    .map((event) => {
      const json = JSON.stringify(event);
      return `<div class="item">${json}</div>`;
    })
    .join("");
};

const refresh = async (): Promise<void> => {
  const data = await chrome.storage.local.get("eventLog");
  const events = Array.isArray(data.eventLog) ? data.eventLog : [];
  render(events);
};

refresh();
setInterval(refresh, 1000);
