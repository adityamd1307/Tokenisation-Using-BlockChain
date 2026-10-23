// Phase 4 will implement full dashboards (spec-v1 §7):
//   /admin   — platform admin: authorise/deauthorise issuers
//   /issuer  — issuer: create assets, whitelist investors, allocate, withdraw
//   /investor — investor: browse assets, buy tokens, transfer holdings

export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>RWA Tokenisation Platform</h1>
      <p>Campus Property Fund &amp; Digital Licensing Revenue Pool</p>
      <nav>
        <a href="/admin">Admin</a> |{" "}
        <a href="/issuer">Issuer</a> |{" "}
        <a href="/investor">Investor</a>
      </nav>
    </div>
  );
}
