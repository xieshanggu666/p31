class GIFEncoder {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.delay = 10;
        this.repeat = 0;
        this.frames = [];
        this.transparent = null;
        this.transIndex = 0;
        this.useDithering = true;
    }

    setDelay(ms) {
        this.delay = Math.round(ms / 10);
    }

    setFrameRate(fps) {
        this.delay = Math.round(100 / fps);
    }

    setDispose(code) {
        this.dispose = code;
    }

    setDithering(enabled) {
        this.useDithering = enabled;
    }

    addFrame(imageData) {
        this.frames.push(new Uint8Array(imageData.data));
    }

    finish() {
        const pixelCount = this.width * this.height;
        const totalFrames = this.frames.length;

        const allPixels = new Uint8Array(totalFrames * pixelCount * 4);
        for (let f = 0; f < totalFrames; f++) {
            allPixels.set(this.frames[f], f * pixelCount * 4);
        }

        const palette = this._medianCutPalette(allPixels, 256);
        const palSize = palette.length / 3;

        let palBits = 1;
        let palSizePow = 2;
        while (palSizePow < palSize) {
            palSizePow *= 2;
            palBits++;
        }

        const fullPalette = new Uint8Array(palSizePow * 3);
        for (let i = 0; i < palette.length; i++) {
            fullPalette[i] = palette[i];
        }

        const stream = [];
        const writeByte = (b) => stream.push(b & 0xff);
        const writeShort = (s) => { writeByte(s & 0xff); writeByte((s >> 8) & 0xff); };
        const writeString = (s) => { for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i)); };

        writeString('GIF89a');
        writeShort(this.width);
        writeShort(this.height);

        const gctSize = palBits - 1;
        const packedFields = 0x80 | 0x70 | gctSize;
        writeByte(packedFields);

        writeByte(0);
        writeByte(0);

        for (let i = 0; i < fullPalette.length; i++) {
            writeByte(fullPalette[i]);
        }

        writeByte(0x21);
        writeByte(0xff);
        writeByte(11);
        writeString('NETSCAPE2.0');
        writeByte(3);
        writeByte(1);
        writeShort(this.repeat);
        writeByte(0);

        const paletteRGB = [];
        for (let i = 0; i < palSize; i++) {
            paletteRGB.push({
                r: fullPalette[i * 3],
                g: fullPalette[i * 3 + 1],
                b: fullPalette[i * 3 + 2],
                idx: i
            });
        }

        const colorCache = new Map();
        const findClosestColor = (r, g, b) => {
            const key = (r << 16) | (g << 8) | b;
            if (colorCache.has(key)) return colorCache.get(key);

            let minDist = Infinity;
            let bestIdx = 0;

            for (let i = 0; i < paletteRGB.length; i++) {
                const p = paletteRGB[i];
                const dr = r - p.r;
                const dg = g - p.g;
                const db = b - p.b;
                const d = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
                if (d < minDist) {
                    minDist = d;
                    bestIdx = i;
                }
            }

            colorCache.set(key, bestIdx);
            return bestIdx;
        };

        for (let f = 0; f < totalFrames; f++) {
            const framePixels = this.frames[f];
            let indexedPixels;

            if (this.useDithering) {
                indexedPixels = this._floydSteinbergDither(framePixels, paletteRGB, colorCache);
            } else {
                indexedPixels = new Uint8Array(pixelCount);
                for (let i = 0; i < pixelCount; i++) {
                    const idx = i * 4;
                    indexedPixels[i] = findClosestColor(
                        framePixels[idx],
                        framePixels[idx + 1],
                        framePixels[idx + 2]
                    );
                }
            }

            writeByte(0x21);
            writeByte(0xf9);
            writeByte(4);
            const disposal = this.dispose || 2;
            writeByte(disposal << 2);
            writeShort(this.delay);
            writeByte(this.transIndex);
            writeByte(0);

            writeByte(0x2c);
            writeShort(0);
            writeShort(0);
            writeShort(this.width);
            writeShort(this.height);
            writeByte(0);

            this._lzwEncode(indexedPixels, palBits, writeByte);
        }

        writeByte(0x3b);
        this.stream = stream;
    }

    _medianCutPalette(pixels, maxColors) {
        const totalPixels = pixels.length / 4;
        const colorMap = new Map();

        for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const key = (r << 16) | (g << 8) | b;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }

        let colors = [];
        for (const [key, count] of colorMap) {
            colors.push({
                r: (key >> 16) & 0xff,
                g: (key >> 8) & 0xff,
                b: key & 0xff,
                count
            });
        }

        if (colors.length <= maxColors) {
            const palette = [];
            for (const c of colors) {
                palette.push(c.r, c.g, c.b);
            }
            return palette;
        }

        const getBounds = (colorList) => {
            let minR = 255, maxR = 0;
            let minG = 255, maxG = 0;
            let minB = 255, maxB = 0;
            for (const c of colorList) {
                if (c.r < minR) minR = c.r;
                if (c.r > maxR) maxR = c.r;
                if (c.g < minG) minG = c.g;
                if (c.g > maxG) maxG = c.g;
                if (c.b < minB) minB = c.b;
                if (c.b > maxB) maxB = c.b;
            }
            return {
                rangeR: maxR - minR,
                rangeG: maxG - minG,
                rangeB: maxB - minB
            };
        };

        const buckets = [colors];
        while (buckets.length < maxColors) {
            let maxRange = -1;
            let maxIdx = -1;

            for (let i = 0; i < buckets.length; i++) {
                const bounds = getBounds(buckets[i]);
                const range = Math.max(bounds.rangeR, bounds.rangeG, bounds.rangeB);
                if (range > maxRange) {
                    maxRange = range;
                    maxIdx = i;
                }
            }

            if (maxRange <= 0) break;

            const bucket = buckets[maxIdx];
            const bounds = getBounds(bucket);
            let sortChannel;
            if (bounds.rangeR >= bounds.rangeG && bounds.rangeR >= bounds.rangeB) {
                sortChannel = 'r';
            } else if (bounds.rangeG >= bounds.rangeB) {
                sortChannel = 'g';
            } else {
                sortChannel = 'b';
            }

            bucket.sort((a, b) => a[sortChannel] - b[sortChannel]);

            let totalCount = 0;
            for (const c of bucket) totalCount += c.count;
            const halfCount = totalCount / 2;

            let currentCount = 0;
            let splitIdx = 0;
            for (let i = 0; i < bucket.length; i++) {
                currentCount += bucket[i].count;
                if (currentCount >= halfCount) {
                    splitIdx = i + 1;
                    break;
                }
            }

            if (splitIdx <= 0 || splitIdx >= bucket.length) {
                splitIdx = Math.floor(bucket.length / 2);
            }

            const bucket1 = bucket.slice(0, splitIdx);
            const bucket2 = bucket.slice(splitIdx);

            if (bucket1.length === 0 || bucket2.length === 0) break;

            buckets.splice(maxIdx, 1, bucket1, bucket2);
        }

        const palette = [];
        for (const bucket of buckets) {
            let totalR = 0, totalG = 0, totalB = 0, totalW = 0;
            for (const c of bucket) {
                totalR += c.r * c.count;
                totalG += c.g * c.count;
                totalB += c.b * c.count;
                totalW += c.count;
            }
            palette.push(
                Math.round(totalR / totalW),
                Math.round(totalG / totalW),
                Math.round(totalB / totalW)
            );
        }

        return palette;
    }

    _floydSteinbergDither(pixels, paletteRGB, colorCache) {
        const w = this.width;
        const h = this.height;
        const pixelCount = w * h;
        const indexed = new Uint8Array(pixelCount);

        const buffer = new Float32Array(pixelCount * 3);
        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            const bidx = i * 3;
            buffer[bidx] = pixels[idx];
            buffer[bidx + 1] = pixels[idx + 1];
            buffer[bidx + 2] = pixels[idx + 2];
        }

        const findClosest = (r, g, b) => {
            const ri = Math.max(0, Math.min(255, Math.round(r)));
            const gi = Math.max(0, Math.min(255, Math.round(g)));
            const bi = Math.max(0, Math.min(255, Math.round(b)));
            const key = (ri << 16) | (gi << 8) | bi;
            if (colorCache.has(key)) return colorCache.get(key);

            let minDist = Infinity;
            let bestIdx = 0;
            for (let i = 0; i < paletteRGB.length; i++) {
                const p = paletteRGB[i];
                const dr = ri - p.r;
                const dg = gi - p.g;
                const db = bi - p.b;
                const d = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
                if (d < minDist) {
                    minDist = d;
                    bestIdx = i;
                }
            }
            colorCache.set(key, bestIdx);
            return bestIdx;
        };

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const bidx = i * 3;

                const oldR = buffer[bidx];
                const oldG = buffer[bidx + 1];
                const oldB = buffer[bidx + 2];

                const palIdx = findClosest(oldR, oldG, oldB);
                indexed[i] = palIdx;

                const newR = paletteRGB[palIdx].r;
                const newG = paletteRGB[palIdx].g;
                const newB = paletteRGB[palIdx].b;

                const errR = oldR - newR;
                const errG = oldG - newG;
                const errB = oldB - newB;

                if (x + 1 < w) {
                    const nidx = bidx + 3;
                    buffer[nidx] += errR * 7 / 16;
                    buffer[nidx + 1] += errG * 7 / 16;
                    buffer[nidx + 2] += errB * 7 / 16;
                }

                if (y + 1 < h) {
                    if (x > 0) {
                        const nidx = (i + w - 1) * 3;
                        buffer[nidx] += errR * 3 / 16;
                        buffer[nidx + 1] += errG * 3 / 16;
                        buffer[nidx + 2] += errB * 3 / 16;
                    }

                    const nidx = (i + w) * 3;
                    buffer[nidx] += errR * 5 / 16;
                    buffer[nidx + 1] += errG * 5 / 16;
                    buffer[nidx + 2] += errB * 5 / 16;

                    if (x + 1 < w) {
                        const nidx2 = (i + w + 1) * 3;
                        buffer[nidx2] += errR * 1 / 16;
                        buffer[nidx2 + 1] += errG * 1 / 16;
                        buffer[nidx2 + 2] += errB * 1 / 16;
                    }
                }
            }
        }

        return indexed;
    }

    getBlob() {
        if (!this.stream) this.finish();
        return new Blob([new Uint8Array(this.stream)], { type: 'image/gif' });
    }

    getDataURL() {
        if (!this.stream) this.finish();
        let binary = '';
        for (let i = 0; i < this.stream.length; i++) {
            binary += String.fromCharCode(this.stream[i]);
        }
        return 'data:image/gif;base64,' + btoa(binary);
    }

    _lzwEncode(pixels, colorDepth, writeByte) {
        const initCodeSize = Math.max(2, colorDepth);
        writeByte(initCodeSize);

        const clear = 1 << initCodeSize;
        const eof = clear + 1;
        let codeSize = initCodeSize + 1;
        let maxCode = 1 << codeSize;
        let nextCode = eof + 1;

        const dict = new Map();
        let dictSize = 1 << initCodeSize;

        const resetDict = () => {
            dict.clear();
            for (let i = 0; i < dictSize; i++) {
                dict.set(String(i), i);
            }
            nextCode = eof + 1;
            codeSize = initCodeSize + 1;
            maxCode = 1 << codeSize;
        };
        resetDict();

        let cur = String(pixels[0]);
        let bits = 0;
        let bitBuf = 0;
        let blockSize = 0;
        const block = [];

        const output = [];

        const writeCode = (code) => {
            bitBuf |= code << bits;
            bits += codeSize;
            while (bits >= 8) {
                block.push(bitBuf & 0xff);
                blockSize++;
                if (blockSize === 255) {
                    output.push(blockSize);
                    for (let i = 0; i < block.length; i++) {
                        output.push(block[i]);
                    }
                    block.length = 0;
                    blockSize = 0;
                }
                bitBuf >>= 8;
                bits -= 8;
            }
        };

        writeCode(clear);

        for (let i = 1; i < pixels.length; i++) {
            const pixel = pixels[i];
            const key = cur + ',' + pixel;

            if (dict.has(key)) {
                cur = key;
            } else {
                writeCode(dict.get(cur));

                if (nextCode < 4096) {
                    dict.set(key, nextCode++);
                    if (nextCode > maxCode && codeSize < 12) {
                        codeSize++;
                        maxCode = 1 << codeSize;
                    }
                } else {
                    writeCode(clear);
                    resetDict();
                }

                cur = String(pixel);
            }
        }

        writeCode(dict.get(cur));
        writeCode(eof);

        if (bits > 0) {
            block.push(bitBuf & 0xff);
            blockSize++;
            if (blockSize === 255) {
                output.push(blockSize);
                for (let i = 0; i < block.length; i++) {
                    output.push(block[i]);
                }
                block.length = 0;
                blockSize = 0;
            }
        }

        if (blockSize > 0) {
            output.push(blockSize);
            for (let i = 0; i < block.length; i++) {
                output.push(block[i]);
            }
        }

        output.push(0);

        for (let i = 0; i < output.length; i++) {
            writeByte(output[i]);
        }
    }
}
