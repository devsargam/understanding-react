import type { ReactNode } from "react";

const topics = ["JSX", "components", "reconciliation", "hooks"];

function Badge({ tone }: { tone: "new" | "core" }) {
  return <span data-tone={tone}>{tone.toUpperCase()}</span>;
}

function Card({
  title,
  highlight = false,
  children,
}: {
  title: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={highlight ? "card card--highlight" : "card"}>
      <header>
        <h2>{title}</h2>
        <Badge tone="core" />
      </header>

      <div>{children}</div>
    </article>
  );
}

function App() {
  const isLearning = true;
  const score = 3;

  return (
    <>
      <section id="ast-playground" data-mode="explore">
        <h1>{"Understanding React through the AST"}</h1>
        <p>{isLearning ? "Tracing JSX nodes" : "Waiting for examples"}</p>

        <Card title="Concepts" highlight={score > 2}>
          <ul>
            {topics.map((topic, index) => (
              <li key={topic}>
                <strong>{index + 1}.</strong> {topic}
              </li>
            ))}
          </ul>
        </Card>

        {isLearning && <footer>Open src/App.tsx and change this tree.</footer>}
      </section>
    </>
  );
}

export default App;
