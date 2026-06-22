class GIFEncoder {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.delay = 10;
        this.repeat = 0;
        this.frames = [];
    }

    setDelay(ms) {
        this.delay = Math.round(ms / 10);
    }

    addFrame(imageData) {
        this.frames.push(new Uint8Array(imageData.data));
    }

    finish() {
        const pixelCount = this.width * this.height;
        const allPixels = new Uint8Array(this.frames.length * pixelCount * 4);
        for (let f = 0; f < this.frames.length; f++) {
            allPixels.set(this.frames[f], f * pixelCount * 4);
        }

        const palette = this._buildGlobalPalette(allPixels);
        const colorMap = this._buildColorMap(palette);

        const stream = [];
        const writeByte = (b) => stream.push(b & 0xff);
        const writeShort = (s) => { writeByte(s & 0xff); writeByte((s >> 8) & 0xff); };
        const writeString = (s) => { for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i)); };

        writeString('GIF89a');
        writeShort(this.width);
        writeShort(this.height);
        writeByte(0xf7);
        writeByte(0);
        writeByte(0);

        for (let i = 0; i < 768; i++) writeByte(palette[i]);

        writeByte(0x21);
        writeByte(0xff);
        writeByte(11);
        const netscape = [78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48];
        for (const c of netscape) writeByte(c);
        writeByte(3);
        writeByte(1);
        writeShort(this.repeat);
        writeByte(0);

        for (let f = 0; f < this.frames.length; f++) {
            const framePixels = this.frames[f];
            const indexedPixels = new Uint8Array(pixelCount);
            for (let i = 0; i < pixelCount; i++) {
                const idx = i * 4;
                const r = framePixels[idx] >> 3;
                const g = framePixels[idx + 1] >> 3;
                const b = framePixels[idx + 2] >> 3;
                const mapIdx = (r << 10) | (g << 5) | b;
                indexedPixels[i] = colorMap[mapIdx];
            }

            writeByte(0x21);
            writeByte(0xf9);
            writeByte(4);
            writeByte(4);
            writeShort(this.delay);
            writeByte(0);
            writeByte(0);

            writeByte(0x2c);
            writeShort(0);
            writeShort(0);
            writeShort(this.width);
            writeShort(this.height);
            writeByte(0);

            this._lzwEncode(indexedPixels, writeByte);
        }

        writeByte(0x3b);
        this.stream = stream;
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

    _buildGlobalPalette(allPixels) {
        const colorFreq = new Int32Array(32768);
        const totalPixels = allPixels.length / 4;

        for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const pixel = ((allPixels[idx] >> 3) << 10)
                | ((allPixels[idx + 1] >> 3) << 5)
                | (allPixels[idx + 2] >> 3);
            colorFreq[pixel]++;
        }

        const usedColors = [];
        for (let i = 0; i < 32768; i++) {
            if (colorFreq[i] > 0) {
                usedColors.push({ color: i, freq: colorFreq[i] });
            }
        }

        usedColors.sort((a, b) => b.freq - a.freq);

        const palette = [];
        const maxColors = 256;
        for (let i = 0; i < Math.min(usedColors.length, maxColors); i++) {
            const c = usedColors[i].color;
            const r = ((c >> 10) & 31) << 3;
            const g = ((c >> 5) & 31) << 3;
            const b = (c & 31) << 3;
            palette.push(r, g, b);
        }

        while (palette.length < 768) {
            palette.push(0, 0, 0);
        }

        return palette;
    }

    _buildColorMap(palette) {
        const colorMap = new Uint8Array(32768);
        for (let i = 0; i < 32768; i++) {
            const r = ((i >> 10) & 31) << 3;
            const g = ((i >> 5) & 31) << 3;
            const b = (i & 31) << 3;
            let minDist = Infinity;
            let bestIdx = 0;
            for (let p = 0; p < 256; p++) {
                const dr = r - palette[p * 3];
                const dg = g - palette[p * 3 + 1];
                const db = b - palette[p * 3 + 2];
                const d = dr * dr + dg * dg + db * db;
                if (d < minDist) {
                    minDist = d;
                    bestIdx = p;
                }
            }
            colorMap[i] = bestIdx;
        }
        return colorMap;
    }

    _lzwEncode(indexedPixels, writeByte) {
        const minCodeSize = 8;
        writeByte(minCodeSize);

        const clearCode = 1 << minCodeSize;
        const eofCode = clearCode + 1;
        let nextCode = eofCode + 1;
        let codeSize = minCodeSize + 1;
        let maxCode = 1 << codeSize;

        const dict = new Map();
        const resetDict = () => {
            dict.clear();
            for (let i = 0; i < clearCode; i++) {
                dict.set(String(i), i);
            }
            nextCode = eofCode + 1;
            codeSize = minCodeSize + 1;
            maxCode = 1 << codeSize;
        };
        resetDict();

        let bitBuffer = 0;
        let bitCount = 0;
        const outputBytes = [];

        const writeCode = (code) => {
            bitBuffer |= code << bitCount;
            bitCount += codeSize;
            while (bitCount >= 8) {
                outputBytes.push(bitBuffer & 0xff);
                bitBuffer >>= 8;
                bitCount -= 8;
            }
        };

        writeCode(clearCode);

        let current = String(indexedPixels[0]);

        for (let i = 1; i < indexedPixels.length; i++) {
            const pixel = indexedPixels[i];
            const combined = current + ',' + pixel;

            if (dict.has(combined)) {
                current = combined;
            } else {
                writeCode(dict.get(current));

                if (nextCode < 4096) {
                    dict.set(combined, nextCode++);
                    if (nextCode > maxCode && codeSize < 12) {
                        codeSize++;
                        maxCode = 1 << codeSize;
                    }
                } else {
                    writeCode(clearCode);
                    resetDict();
                }

                current = String(pixel);
            }
        }

        writeCode(dict.get(current));
        writeCode(eofCode);

        if (bitCount > 0) {
            outputBytes.push(bitBuffer & 0xff);
        }

        let offset = 0;
        while (offset < outputBytes.length) {
            const blockSize = Math.min(255, outputBytes.length - offset);
            writeByte(blockSize);
            for (let i = 0; i < blockSize; i++) {
                writeByte(outputBytes[offset + i]);
            }
            offset += blockSize;
        }

        writeByte(0);
    }
}
