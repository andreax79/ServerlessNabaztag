import assert from "node:assert/strict";
import test from "node:test";
import { signTicket, verifyTicket } from "../lib/tickets.js";

test("signed audio tickets reject tampering and expiry", () => {
  const secret = "test-secret";
  const expires = Date.now() + 10_000;
  const signature = signTicket(secret, "ticket", expires);
  assert.equal(verifyTicket(secret, "ticket", expires, signature), true);
  assert.equal(verifyTicket(secret, "other", expires, signature), false);
  assert.equal(verifyTicket(secret, "ticket", expires, `${signature.slice(0, -1)}0`), false);
  assert.equal(verifyTicket(secret, "ticket", expires, signature, expires + 1), false);
});
