export default function EmptyState({
  compact = false,
  message = "No upcoming buses right now.",
}) {
  return (
    <section className={`empty-state ${compact ? "compact" : ""}`}>
      <p>{message}</p>
    </section>
  );
}
