/* Polar PMD payload decoder. The caller retains responsibility for parsing the 10-byte PMD header. */
(function (root) {
    "use strict";

    function asBytes(value) {
        if (value instanceof Uint8Array) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        throw new TypeError("Payload must be an ArrayBuffer or an ArrayBuffer view");
    }

    function signedLE(bytes, offset, width) {
        var value = 0;
        for (var i = 0; i < width; i++) value += bytes[offset + i] * Math.pow(256, i);
        var modulus = Math.pow(2, width * 8);
        return value >= modulus / 2 ? value - modulus : value;
    }

    function signExtend(value, width) {
        var modulus = Math.pow(2, width);
        return value >= modulus / 2 ? value - modulus : value;
    }

    function decodeRaw(bytes, channels, bytesPerValue) {
        var sampleBytes = channels * bytesPerValue;
        if (!bytes.length || bytes.length % sampleBytes) {
            throw new RangeError("Raw frame length " + bytes.length + " is not a non-zero multiple of " + sampleBytes);
        }
        var output = Array.from({ length: channels }, function () { return []; });
        for (var offset = 0; offset < bytes.length; offset += sampleBytes) {
            for (var ch = 0; ch < channels; ch++) {
                output[ch].push(signedLE(bytes, offset + ch * bytesPerValue, bytesPerValue));
            }
        }
        return output;
    }

    function readPackedUnsigned(bytes, bitOffset, width) {
        var value = 0;
        for (var bit = 0; bit < width; bit++) {
            var sourceBit = bitOffset + bit;
            value += ((bytes[sourceBit >> 3] >> (sourceBit & 7)) & 1) * Math.pow(2, bit);
        }
        return value;
    }

    // Reference sample, then any number of [bit width, sample count, packed deltas] blocks.
    // Delta fields are interleaved by sample/channel and packed continuously LSB-first.
    function decodeDelta(bytes, channels, referenceBytes) {
        var referenceSize = channels * referenceBytes;
        if (bytes.length < referenceSize + 2) {
            throw new RangeError("Delta frame is shorter than its reference sample and first block header");
        }
        var output = Array.from({ length: channels }, function () { return []; });
        for (var ch = 0; ch < channels; ch++) {
            output[ch].push(signedLE(bytes, ch * referenceBytes, referenceBytes));
        }

        var offset = referenceSize;
        while (offset < bytes.length) {
            if (bytes.length - offset < 2) throw new RangeError("Truncated delta block header at byte " + offset);
            var bitWidth = bytes[offset++];
            var sampleCount = bytes[offset++];
            if (bitWidth < 1 || bitWidth > 24) throw new RangeError("Unsupported delta width " + bitWidth);
            if (sampleCount < 1) throw new RangeError("Invalid zero-length delta block");
            var valueCount = sampleCount * channels;
            var blockBytes = Math.ceil(valueCount * bitWidth / 8);
            if (bytes.length - offset < blockBytes) {
                throw new RangeError("Truncated delta block: expected " + blockBytes +
                    " packed bytes, found " + (bytes.length - offset));
            }

            var packed = bytes.subarray(offset, offset + blockBytes);
            var bitOffset = 0;
            for (var sample = 0; sample < sampleCount; sample++) {
                for (var channel = 0; channel < channels; channel++) {
                    var raw = readPackedUnsigned(packed, bitOffset, bitWidth);
                    var delta = signExtend(raw, bitWidth);
                    var previous = output[channel][output[channel].length - 1];
                    output[channel].push(previous + delta);
                    bitOffset += bitWidth;
                }
            }
            offset += blockBytes;
        }
        return output;
    }

    function decode(measurementType, frameTypeByte, payload) {
        if (!Number.isInteger(measurementType) || measurementType < 0 || measurementType > 2) {
            throw new RangeError("Unsupported PMD measurement type " + measurementType);
        }
        if (!Number.isInteger(frameTypeByte) || frameTypeByte < 0 || frameTypeByte > 255) {
            throw new RangeError("Frame type must be an unsigned byte");
        }

        var bytes = asBytes(payload);
        var compressed = (frameTypeByte & 0x80) !== 0;
        var frameType = frameTypeByte & 0x7F;
        var channels;

        if (measurementType === 0) { // ECG frame types 0, 1 and 2
            if (compressed) throw new Error("Compressed ECG frames are not supported");
            if (frameType === 0) {
                channels = decodeRaw(bytes, 1, 3); // signed 24-bit microvolts
            } else if (frameType === 1 || frameType === 2) {
                var bytesPerSample = 3;
                if (!bytes.length || bytes.length % bytesPerSample) {
                    throw new RangeError("ECG frame length is not a non-zero multiple of 3");
                }
                channels = [[]];
                for (var offset = 0; offset < bytes.length; offset += 3) {
                    if (frameType === 1) {
                        // 14-bit unsigned ECG value; third byte contains contact/status flags.
                        channels[0].push(bytes[offset] | ((bytes[offset + 1] & 0x3F) << 8));
                    } else {
                        // 22-bit unsigned ECG value; upper two bits carry ECG/pace tags.
                        channels[0].push(bytes[offset] | (bytes[offset + 1] << 8) |
                            ((bytes[offset + 2] & 0x03) << 16));
                    }
                }
            } else {
                throw new Error("Unsupported ECG raw frame type " + frameType);
            }
        } else if (measurementType === 1) { // PPG type 0: three PPG channels plus ambient
            if (frameType !== 0) throw new Error("Unsupported PPG frame type " + frameType);
            channels = compressed ? decodeDelta(bytes, 4, 3) : decodeRaw(bytes, 4, 3);
        } else { // ACC: x, y, z
            if (compressed) {
                if (frameType !== 0 && frameType !== 1) {
                    throw new Error("Unsupported compressed ACC frame type " + frameType);
                }
                channels = decodeDelta(bytes, 3, 2);
            } else {
                if (frameType > 2) throw new Error("Unsupported raw ACC frame type " + frameType);
                channels = decodeRaw(bytes, 3, frameType + 1);
            }
        }

        return {
            channels: channels,
            sampleCount: channels.length ? channels[0].length : 0,
            frameType: frameType,
            compressed: compressed
        };
    }

    var api = { decode: decode };
    root.PolarPMDDecoder = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
