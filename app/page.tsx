export default function Home() {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
        <h1>Start</h1>
        <p>Alles läuft. Teste die API oder gehe zur Ergebnis-Seite:</p>
        <ul>
          <li><a href="/api/test" target="_blank" rel="noreferrer">/api/test</a></li>
          <li><a href="/ergebnis.html">/ergebnis.html</a></li>
        </ul>
      </main>
    );
  }