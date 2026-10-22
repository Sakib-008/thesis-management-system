// Placeholder used by every route stub until its phase is implemented.
export default function StubPage({ title, role, phase }: { title: string; role: string; phase: number }) {
  return (
    <section className="stub">
      <p className="stub-role">{role}</p>
      <h1>{title}</h1>
      <p className="stub-note">Not implemented yet — scheduled for Phase {phase}.</p>
    </section>
  );
}