// Development-only test harness; excluded from the production application entry.
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useApiQuery } from "../src/query/apiQueries";
import { queryClient } from "../src/query/queryClient";

export async function verifyParallelObservers() {
  function ReadObserver() {
    const query = useApiQuery<{ success: boolean }>("/resume/history");
    return <span data-query-ready={query.isSuccess ? "yes" : "no"} />;
  }

  const host = document.createElement("div");
  host.hidden = true;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(<QueryClientProvider client={queryClient}><ReadObserver /><ReadObserver /></QueryClientProvider>);
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 5000;
      const timer = window.setInterval(() => {
        if (host.querySelectorAll('[data-query-ready="yes"]').length === 2) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() > deadline) {
          window.clearInterval(timer);
          reject(new Error("Parallel observers did not finish"));
        }
      }, 20);
    });
  } finally {
    root.unmount();
    host.remove();
  }
}
