(function () {
  const suggestions = [
    "Remboursement consultation",
    "BRSS",
    "Complementaire sante solidaire",
    "Capital deces",
    "Obseques",
  ];
  const mascotUrl = "/assets/coveo-mascot.png";
  let messagesEl;
  let inputEl;
  let sendButton;

  const escapeHtml = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const getTokenSafe = () =>
    typeof getToken === "function" ? getToken() : localStorage.getItem("token");

  const appendMessage = ({ role, text, sources = [] }) => {
    const item = document.createElement("div");
    item.className = `coveo-chatbot-message ${role}`;
    item.textContent = text;

    if (role === "bot" && sources.length) {
      const sourceList = document.createElement("div");
      sourceList.className = "coveo-chatbot-sources";
      sources.slice(0, 5).forEach((source) => {
        const badge = document.createElement("span");
        badge.className = "coveo-chatbot-source";
        badge.textContent = source.name || source.url || "Source";
        sourceList.appendChild(badge);
      });
      item.appendChild(sourceList);
    }

    messagesEl.appendChild(item);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const setLoading = (loading) => {
    inputEl.disabled = loading;
    sendButton.disabled = loading;
    sendButton.textContent = loading ? "..." : "➤";
  };

  const sendMessage = async (text) => {
    const message = String(text || inputEl.value || "").trim();
    if (!message) return;

    inputEl.value = "";
    appendMessage({ role: "user", text: message });
    setLoading(true);

    try {
      const response = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getTokenSafe()}`,
        },
        body: JSON.stringify({
          message,
          context: {
            page: window.location.pathname,
            role: typeof getUser === "function" ? getUser()?.role : null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur chatbot");
      }
      appendMessage({
        role: "bot",
        text: data.answer || "Je n'ai pas pu generer de reponse.",
        sources: data.sources || [],
      });
    } catch (err) {
      appendMessage({
        role: "bot",
        text:
          "Le chatbot n'est pas disponible pour le moment. Verifiez la configuration Gemma ou reessayez plus tard.",
        sources: [],
      });
    } finally {
      setLoading(false);
      inputEl.focus();
    }
  };

  const openPanel = () => {
    document.getElementById("coveo-chatbot-panel").classList.add("open");
    inputEl.focus();
  };

  const closePanel = () => {
    document.getElementById("coveo-chatbot-panel").classList.remove("open");
  };

  const createWidget = () => {
    if (document.getElementById("coveo-chatbot-launcher")) return;

    const launcher = document.createElement("button");
    launcher.id = "coveo-chatbot-launcher";
    launcher.type = "button";
    launcher.className = "coveo-chatbot-launcher";
    launcher.setAttribute("aria-label", "Ouvrir Coveo Assistant");
    launcher.innerHTML = `
      <img class="coveo-chatbot-mascot" src="${mascotUrl}" alt="" />
      <span>
        <span class="coveo-chatbot-title"><span class="coveo-chatbot-dot"></span>Coveo Assistant</span>
        <span class="coveo-chatbot-subtitle">Expert mutuelle</span>
      </span>
    `;
    launcher.addEventListener("click", openPanel);

    const panel = document.createElement("aside");
    panel.id = "coveo-chatbot-panel";
    panel.className = "coveo-chatbot-panel";
    panel.setAttribute("aria-label", "Coveo Assistant chatbot");
    panel.innerHTML = `
      <div class="coveo-chatbot-header">
        <img src="${mascotUrl}" alt="" />
        <div>
          <div class="coveo-chatbot-kicker">Assistant assurance</div>
          <div class="coveo-chatbot-heading">Coveo Assistant</div>
          <div class="coveo-chatbot-status">Sante, mutuelle, prevoyance, deces</div>
        </div>
        <button type="button" class="coveo-chatbot-close" aria-label="Fermer">×</button>
      </div>
      <div class="coveo-chatbot-messages" id="coveo-chatbot-messages"></div>
      <div class="coveo-chatbot-suggestions">
        ${suggestions
          .map(
            (suggestion) =>
              `<button type="button" class="coveo-chatbot-suggestion" data-suggestion="${escapeHtml(suggestion)}">${escapeHtml(suggestion)}</button>`,
          )
          .join("")}
      </div>
      <form class="coveo-chatbot-form" id="coveo-chatbot-form">
        <textarea class="coveo-chatbot-input" rows="1" placeholder="Posez une question mutuelle, BRSS, deces..."></textarea>
        <button type="submit" class="coveo-chatbot-send" aria-label="Envoyer">➤</button>
      </form>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    messagesEl = document.getElementById("coveo-chatbot-messages");
    inputEl = panel.querySelector(".coveo-chatbot-input");
    sendButton = panel.querySelector(".coveo-chatbot-send");

    panel.querySelector(".coveo-chatbot-close").addEventListener("click", closePanel);
    panel.querySelectorAll(".coveo-chatbot-suggestion").forEach((button) => {
      button.addEventListener("click", () => sendMessage(button.dataset.suggestion));
    });
    panel.querySelector("#coveo-chatbot-form").addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage();
    });
    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    appendMessage({
      role: "bot",
      text:
        "Bonjour, je suis Coveo Assistant. Posez une question sur la mutuelle, la Securite sociale, la prevoyance ou les obseques.",
      sources: [],
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
