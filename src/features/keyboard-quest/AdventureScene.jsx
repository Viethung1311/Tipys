export default function AdventureScene({ world, children }) {
  return (
    <section
      className="adventure-scene"
      style={{ '--adventure-background': `url("${world.background.src}")` }}
      aria-label={`Màn ${world.id}: ${world.title}`}
    >
      <aside className="adventure-guide">
        <img
          src={world.guide.src}
          alt={world.guideName}
          width="420"
          height="420"
          decoding="async"
        />
        <p>
          {world.guideName}
          <br />
          <strong>Cùng mình luyện tập nhé!</strong>
        </p>
      </aside>
      <div className="adventure-content">{children}</div>
    </section>
  );
}
