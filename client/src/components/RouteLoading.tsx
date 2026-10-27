export default function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "30vh",
        padding: "2rem",
        color: "#64748b",
        fontSize: "0.95rem",
      }}
    >
      Loading page...
    </div>
  );
}
