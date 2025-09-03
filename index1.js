// solve.js
// Usage: node solve.js input.json
// Prints only the constant term c (i.e., f(0)).

import fs from "fs";

// ------------------ Utilities: BigInt fraction arithmetic ------------------
function bigIntAbs(x) { return x < 0n ? -x : x; }

function bigIntGcd(a, b) {
  a = bigIntAbs(a);
  b = bigIntAbs(b);
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a;
}

class Fraction {
  constructor(n, d = 1n) {
    if (d === 0n) throw new Error("Division by zero in Fraction");
    // normalize sign to denominator > 0
    if (d < 0n) { n = -n; d = -d; }
    const g = bigIntGcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }
  add(other) {
    return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d);
  }
  sub(other) {
    return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d);
  }
  mul(other) {
    return new Fraction(this.n * other.n, this.d * other.d);
  }
  div(other) {
    if (other.n === 0n) throw new Error("Division by zero in Fraction.div");
    // (a/b) / (c/d) = (a*d)/(b*c)
    let n = this.n * other.d;
    let d = this.d * other.n;
    if (d < 0n) { n = -n; d = -d; }
    return new Fraction(n, d);
  }
  isInteger() { return this.d === 1n; }
  toString() { return this.isInteger() ? this.n.toString() : `${this.n.toString()}/${this.d.toString()}`; }
}

// ------------------ Base decoder to BigInt (supports base 2..36) ------------------
function charToVal(ch) {
  const c = ch.toLowerCase();
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - '0'.charCodeAt(0);
  if (c >= 'a' && c <= 'z') return 10 + (c.charCodeAt(0) - 'a'.charCodeAt(0));
  throw new Error(`Invalid digit '${ch}'`);
}

function decodeBaseStringToBigInt(valueStr, baseNum) {
  const B = BigInt(baseNum);
  let acc = 0n;
  for (const ch of valueStr.trim()) {
    const v = charToVal(ch);
    if (v >= baseNum) throw new Error(`Digit '${ch}' not valid for base ${baseNum}`);
    acc = acc * B + BigInt(v);
  }
  return acc;
}

// ------------------ Lagrange interpolation at x = 0 ------------------
// f(0) = sum_i y_i * prod_{j != i} [ (-x_j) / (x_i - x_j) ]
function lagrangeAtZero(points /* array of [BigInt x, BigInt y] length = k */) {
  let secret = new Fraction(0n, 1n);

  for (let i = 0; i < points.length; i++) {
    const [xi, yi] = points[i];
    let term = new Fraction(yi, 1n); // start with y_i as a fraction

    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const [xj] = points[j];
      const num = new Fraction(-xj, 1n);             // (-x_j)
      const den = new Fraction(xi - xj, 1n);         // (x_i - x_j)
      term = term.mul(num).div(den);                 // multiply by ((-x_j)/(x_i - x_j))
    }

    secret = secret.add(term);
  }

  return secret; // Fraction
}

// ------------------ Main: read file, decode, compute, print c ------------------
function main() {
  const file = process.argv[2] || "input.json";
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));

  if (!data.keys || typeof data.keys.k === "undefined") {
    throw new Error("Invalid JSON: missing keys.k");
  }
  const k = Number(data.keys.k);
  if (!Number.isInteger(k) || k < 2) {
    throw new Error("Invalid k");
  }

  // Collect points as [x(BigInt), y(BigInt)]
  const points = [];
  for (const key of Object.keys(data)) {
    if (key === "keys") continue;
    const ent = data[key];
    if (!ent || typeof ent.base === "undefined" || typeof ent.value === "undefined") continue;
    const x = BigInt(key);
    const baseNum = Number(ent.base);
    if (!Number.isInteger(baseNum) || baseNum < 2 || baseNum > 36) {
      throw new Error(`Unsupported base ${ent.base} for x=${key}`);
    }
    const y = decodeBaseStringToBigInt(ent.value, baseNum);
    points.push([x, y]);
  }

  if (points.length < k) {
    throw new Error(`Not enough points. Have ${points.length}, need k=${k}`);
  }

  // Use any k points; here we choose the k smallest x to be deterministic
  points.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const kpoints = points.slice(0, k);

  const secretFrac = lagrangeAtZero(kpoints);

  // Print only c (integer if it is)
  if (secretFrac.isInteger()) {
    console.log(secretFrac.n.toString());
  } else {
    // In case it's not an integer (shouldn’t happen for valid integer-coefficient polynomials),
    // print reduced fraction to be explicit.
    console.log(secretFrac.toString());
  }
}

main();
