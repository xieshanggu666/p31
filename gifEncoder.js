class GIFEncoder {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.delay = 10;
        this.repeat = 0;
        this.frames = [];
        this.transparent = null;
        this.transIndex = 0;
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

    addFrame(imageData) {
        this.frames.push(new Uint8Array(imageData.data));
    }

    finish() {
        const pixelCount = this.width * this.height;
        const allPixels = new Uint8Array(this.frames.length * pixelCount * 4);
        for (let f = 0; f < this.frames.length; f++) {
            allPixels.set(this.frames[f], f * pixelCount * 4);
        }

        const palette = this._buildPalette(allPixels);
        const palSize = palette.length / 3;
        const colorMap = this._buildColorMap(palette);

        const stream = [];
        const writeByte = (b) => stream.push(b & 0xff);
        const writeShort = (s) => { writeByte(s & 0xff); writeByte((s >> 8) & 0xff); };
        const writeString = (s) => { for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i)); };

        writeString('GIF89a');
        writeShort(this.width);
        writeShort(this.height);

        let palBits = 1;
        let palSizePow = 2;
        while (palSizePow < palSize) {
            palSizePow *= 2;
            palBits++;
        }
        const gctSize = palBits - 1;
        const packedFields = 0x80 | 0x70 | gctSize;
        writeByte(packedFields);

        writeByte(0);
        writeByte(0);

        for (let i = 0; i < palSizePow * 3; i++) {
            writeByte(i < palette.length ? palette[i] : 0);
        }

        writeByte(0x21);
        writeByte(0xff);
        writeByte(11);
        writeString('NETSCAPE2.0');
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

    _buildPalette(pixels) {
        const colorFreq = new Int32Array(32768);
        const totalPixels = pixels.length / 4;

        for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const r = pixels[idx] >> 3;
            const g = pixels[idx + 1] >> 3;
            const b = pixels[idx + 2] >> 3;
            const pixel = (r << 10) | (g << 5) | b;
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
            for (let p = 0; p < palette.length / 3; p++) {
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
