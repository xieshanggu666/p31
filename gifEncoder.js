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
            writeByte(0);
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

        const BITS = 12;
        const HSIZE = 5003;
        const clear = 1 << minCodeSize;
        const eofCode = clear + 1;
        let freeEntry = clear + 2;
        let codeSize = minCodeSize + 1;
        let highBit = 1 << codeSize;
        let maxCode = highBit - 1;

        const hTab = new Int32Array(HSIZE);
        const codTab = new Int32Array(HSIZE);
        hTab.fill(-1);

        const pixelCount = indexedPixels.length;
        let curPixel = 0;
        let ent = indexedPixels[curPixel++];

        const output = [];
        let blocks = [];
        let blockSize = 0;
        let accum = 0;
        let accBits = 0;

        const writeCode = (code, size) => {
            while (size > 0) {
                accum |= (code & 1) << accBits;
                code >>= 1;
                size--;
                accBits++;
                if (accBits === 8) {
                    blocks.push(accum & 0xff);
                    blockSize++;
                    accum = 0;
                    accBits = 0;
                    if (blockSize === 255) {
                        output.push(blockSize);
                        for (const b of blocks) output.push(b);
                        blocks = [];
                        blockSize = 0;
                    }
                }
            }
        };

        writeCode(clear, codeSize);

        while (curPixel < pixelCount) {
            const c = indexedPixels[curPixel++];
            const fcode = (c << BITS) + ent;
            let h = (c << 4) ^ ent;
            let h2 = 2003 - (h % 2003);
            let found = false;

            while (true) {
                if (hTab[h] === fcode) {
                    ent = codTab[h];
                    found = true;
                    break;
                }
                if (hTab[h] < 0) break;
                h -= h2;
                if (h < 0) h += HSIZE;
            }

            if (!found) {
                writeCode(ent, codeSize);
                ent = c;
                if (freeEntry < (1 << BITS)) {
                    hTab[h] = fcode;
                    codTab[h] = freeEntry++;
                    if (freeEntry > maxCode) {
                        codeSize++;
                        highBit <<= 1;
                        maxCode = highBit - 1;
                    }
                } else {
                    writeCode(clear, codeSize);
                    freeEntry = clear + 2;
                    codeSize = minCodeSize + 1;
                    highBit = 1 << codeSize;
                    maxCode = highBit - 1;
                    hTab.fill(-1);
                }
            }
        }

        writeCode(ent, codeSize);
        writeCode(eofCode, codeSize);

        if (accBits > 0) {
            blocks.push(accum & 0xff);
            blockSize++;
        }

        if (blockSize > 0) {
            output.push(blockSize);
            for (const b of blocks) output.push(b);
        }

        output.push(0);

        for (const b of output) writeByte(b);
    }
}
