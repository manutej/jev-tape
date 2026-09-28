#!/usr/bin/env node
// A deterministic login site for live runs: the same three pages the recorded fixtures came from,
// served locally so the loop is not at the mercy of a sleeping demo host behind a 30 s proxy.
//   node scripts/fixture-site.mjs [port]        default 8787
// Pages: /login (form) · POST /login → /secure on tomsmith / SuperSecretPassword!, else /login with a flash
//        /secure (Logout link) · /logout → /login · /checkout (C10 fixture: Apply coupon, Place order)
// No dependencies. In-memory session via one cookie. Nothing persists.
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? process.env.FIXTURE_PORT ?? 8787);
const USER = "tomsmith";
const PASS = "SuperSecretPassword!";
const sessions = new Set();

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}
<footer><a href="http://elementalselenium.com/" target="_blank">Elemental Selenium</a></footer></body></html>`;

const flash = (msg) => (msg ? `<div id="flash">${msg}<a href="#" class="close">×</a></div>` : "");

const loginPage = (msg) => page("The Internet", `${flash(msg)}
<h2>Login Page</h2>
<p>This is where you can log into the secure area. Enter ${USER} for the username and ${PASS} for the password. If the information is wrong you should see error messages.</p>
<form method="post" action="/login">
  <label for="username">Username</label><input type="text" name="username" id="username">
  <label for="password">Password</label><input type="password" name="password" id="password">
  <button type="submit">Login</button>
</form>`);

const securePage = () => page("The Internet", `${flash("You logged into a secure area!")}
<h2>Secure Area</h2>
<p>Welcome to the Secure Area. When you are done click logout below.</p>
<a href="/logout">Logout</a>`);

const checkoutPage = () => page("Checkout", `<h2>Checkout</h2>
<p>Order summary</p><p>1 × Battery Pack 89.99</p>
<label for="coupon">Coupon code</label><input type="text" id="coupon" name="coupon">
<button type="button" id="apply">Apply coupon</button>
<form method="post" action="/order"><button type="submit">Place order</button></form>
<p>By placing your order you agree to the <a href="/terms">terms</a>.</p>`);

const cookie = (req) => (req.headers.cookie ?? "").split(";").map((s) => s.trim()).find((s) => s.startsWith("sid="))?.slice(4);

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, html, headers = {}) => {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
    res.end(html);
  };
  if (req.method === "GET" && url.pathname === "/login") return send(200, loginPage(url.searchParams.get("m")));
  if (req.method === "POST" && url.pathname === "/login") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const p = new URLSearchParams(body);
      if (p.get("username") === USER && p.get("password") === PASS) {
        const sid = Math.random().toString(36).slice(2);
        sessions.add(sid);
        return send(302, "", { location: "/secure", "set-cookie": `sid=${sid}; Path=/; HttpOnly` });
      }
      return send(302, "", { location: "/login?m=" + encodeURIComponent("Your password is invalid!") });
    });
    return;
  }
  if (url.pathname === "/secure") return sessions.has(cookie(req)) ? send(200, securePage()) : send(302, "", { location: "/login?m=" + encodeURIComponent("You must login to view the secure area!") });
  if (url.pathname === "/logout") {
    sessions.delete(cookie(req));
    return send(302, "", { location: "/login?m=" + encodeURIComponent("You logged out of the secure area!") });
  }
  if (url.pathname === "/checkout") return send(200, checkoutPage());
  if (url.pathname === "/order") return send(200, page("Order placed", "<h2>Order placed</h2><p>This fixture never charges anything.</p>"));
  if (url.pathname === "/terms") return send(200, page("Terms", "<h2>Terms</h2><p>Fixture terms.</p>"));
  if (url.pathname === "/") return send(302, "", { location: "/login" });
  send(404, page("Not found", "<h2>404</h2>"));
}).listen(PORT, "127.0.0.1", () => console.log(`fixture site on http://127.0.0.1:${PORT}/login`));
