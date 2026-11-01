const test = require("node:test");
const assert = require("node:assert/strict");
const { decode } = require("../PolarPMDDecoder.js");

function packSigned(values, width) {
    const bytes = new Uint8Array(Math.ceil(values.length * width / 8));
    let bitOffset = 0;
    for (const value of values) {
        const encoded = value < 0 ? value + 2 ** width : value;
        for (let bit = 0; bit < width; bit++, bitOffset++) {
            if (Math.floor(encoded / 2 ** bit) % 2) bytes[bitOffset >> 3] |= 1 << (bitOffset & 7);
        }
    }
    return bytes;
}
function concat(...arrays) {
    const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
}

test("ECG signed 24-bit little-endian", () => {
    assert.deepEqual(decode(0, 0, Uint8Array.from([255,255,127, 255,255,255, 0,0,128])).channels,
        [[8388607, -1, -8388608]]);
});
test("ECG frame type 1 decodes 14-bit values and ignores status bits", () => {
    const payload = Uint8Array.from([0x34, 0x12, 0xFF, 0xFF, 0x3F, 0xA5]);
    assert.deepEqual(decode(0, 1, payload).channels, [[0x1234, 0x3FFF]]);
});
test("ECG frame type 2 decodes 22-bit values and ignores tag bits", () => {
    const payload = Uint8Array.from([0x34, 0x12, 0xFF, 0xFF, 0xFF, 0xFF]);
    assert.deepEqual(decode(0, 2, payload).channels, [[0x31234, 0x3FFFFF]]);
});
test("raw PPG type 0: four signed 24-bit channels", () => {
    const p = Uint8Array.from([1,2,3,4,5,6,255,255,127,0,0,0, 255,255,255,15,239,239,0,0,128,15,239,239]);
    assert.deepEqual(decode(1, 0, p).channels, [[197121,-1],[394500,-1052913],[8388607,-8388608],[0,-1052913]]);
});
test("raw ACC type 1: interleaved signed 16-bit axes", () => {
    const p = Uint8Array.from([247,255,255,255,231,3, 248,255,254,255,229,3]);
    assert.deepEqual(decode(2, 1, p).channels, [[-9,-8],[-1,-2],[999,997]]);
});
test("compressed ACC: signed 6-bit deltas and channel interleaving", () => {
    const ref = Uint8Array.from([0xAE,0xFF,0xC2,0xFF,0xE6,0x03]);
    const p = concat(ref, Uint8Array.from([6,2]), packSigned([15,-25,-10,-14,4,-1],6));
    assert.deepEqual(decode(2, 0x81, p).channels, [[-82,-67,-81],[-62,-87,-83],[998,988,987]]);
});
test("compressed ACC type 0 is accepted with 16-bit reference samples", () => {
    const ref = Uint8Array.from([0,0,0,0,0,0]);
    const payload = concat(ref, Uint8Array.from([2,1]), packSigned([1,-1,0],2));
    assert.deepEqual(decode(2, 0x80, payload).channels, [[0,1],[0,-1],[0,0]]);
});
test("compressed PPG type 0: four channels", () => {
    const ref = Uint8Array.from([10,0,0,20,0,0,30,0,0,40,0,0]);
    const p = concat(ref, Uint8Array.from([3,1]), packSigned([1,-1,2,-2],3));
    assert.deepEqual(decode(1, 0x80, p).channels, [[10,11],[20,19],[30,32],[40,38]]);
});
test("delta decoder accepts consecutive blocks with changing widths", () => {
    const ref = new Uint8Array(6);
    const b1 = concat(Uint8Array.from([3,1]), packSigned([1,1,1],3));
    const b2 = concat(Uint8Array.from([5,1]), packSigned([-2,3,-4],5));
    assert.deepEqual(decode(2,0x81,concat(ref,b1,b2)).channels, [[0,1,-1],[0,1,4],[0,1,-3]]);
});
test("malformed lengths and truncated delta blocks are rejected", () => {
    assert.throws(() => decode(0,0,Uint8Array.from([1,2])), /multiple/);
    assert.throws(() => decode(2,0x81,Uint8Array.from([0,0,0,0,0,0,8,2,0])), /Truncated/);
});
test("unsupported encodings are rejected rather than guessed", () => {
    assert.throws(() => decode(0,0x80,new Uint8Array(3)), /Unsupported ECG/);
    assert.throws(() => decode(1,4,new Uint8Array(12)), /Unsupported PPG/);
    assert.throws(() => decode(2,0x83,new Uint8Array(6)), /Unsupported compressed ACC/);
});
