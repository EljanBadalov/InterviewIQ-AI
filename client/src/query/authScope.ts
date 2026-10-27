let epoch = 0;
let controller = new AbortController();
const listeners = new Set<() => void>();
const resetListeners = new Set<() => void>();

export function accountId(): string | null {
  try {
    if (!localStorage.getItem("interviewiq_token")) return null;
    const user = JSON.parse(localStorage.getItem("interviewiq_user") || "null");
    const id = user?.id || user?._id;
    return typeof id === "string" && id ? id : null;
  } catch { return null; }
}

let observedOwner = accountId();
let observedCredential = localStorage.getItem("interviewiq_token");

export const sessionEpoch = () => epoch;
export const sessionSignal = () => controller.signal;
export const sessionSnapshot = () => JSON.stringify([accountId(), epoch]);
export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const onSessionReset = (listener: () => void) => { resetListeners.add(listener); return () => { resetListeners.delete(listener); }; };

// Abort before credentials change; late responses must never enter a new session.
export function beginSessionChange() {
  epoch++;
  controller.abort();
  controller = new AbortController();
  resetListeners.forEach(listener => listener());
}

export function publishSessionChange() {
  observedOwner = accountId();
  observedCredential = localStorage.getItem("interviewiq_token");
  listeners.forEach(listener => listener());
  window.dispatchEvent(new Event("interviewiq-auth-change"));
}

window.addEventListener("storage", event => {
  if (event.key === null || event.key === "interviewiq_token" || event.key === "interviewiq_user") {
    if (accountId() !== observedOwner || localStorage.getItem("interviewiq_token") !== observedCredential) {
      beginSessionChange();
      publishSessionChange();
    }
  }
});
