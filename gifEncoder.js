class GIFEncoder {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.delay = 10;
        this.repeat = 0;
        this.frames = [];
        this.transparent = null;
        this.transparentIndex = 0;
        this.dispose = -1;
        this.firstFrame = true;
        this.sample = 10;
    }

    setDelay(ms) {
        this.delay = Math.round(ms / 10);
    }

    setFrameRate(fps) {
        this.delay = Math.round(100 / fps);
    }

    setDispose(code) {
        if (code >= 0) this.dispose = code;
    }

    setTransparent(color) {
        this.transparent = color;
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
        this._colorTab = palette;
        const colorMap = this._buildColorMap(palette);

        this._out = [];
        this._writeString('GIF89a');

        this._writeShort(this.width);
        this._writeShort(this.height);
        this._writeByte(0xf7);
        this._writeByte(0);
        this._writeByte(0);

        for (let i = 0; i < 768; i++) {
            this._writeByte(palette[i]);
        }

        if (this.transparent !== null) {
            this.transparentIndex = this._findClosest(this.transparent);
        }

        this._writeNetscapeExt();

        for (let f = 0; f < this.frames.length; f++) {
            const framePixels = this.frames[f];
            const indexedPixels = new Uint8Array(pixelCount);
            for (let i = 0; i < pixelCount; i++) {
                const idx = i * 4;
                const r = framePixels[idx];
                const g = framePixels[idx + 1];
                const b = framePixels[idx + 2];
                const pixel = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
                indexedPixels[i] = colorMap[pixel];
            }
            this._writeGraphicCtrlExt();
            this._writeImageDesc();
            this._writeLSD();
            this._writePixels(indexedPixels);
        }

        this._writeByte(0x3b);
    }

    getBlob() {
        if (!this._out) this.finish();
        return new Blob([new Uint8Array(this._out)], { type: 'image/gif' });
    }

    getDataURL() {
        if (!this._out) this.finish();
        let binary = '';
        for (let i = 0; i < this._out.length; i++) {
            binary += String.fromCharCode(this._out[i]);
        }
        return 'data:image/gif;base64,' + btoa(binary);
    }

    _writeByte(b) {
        this._out.push(b & 0xff);
    }

    _writeShort(s) {
        this._writeByte(s & 0xff);
        this._writeByte((s >> 8) & 0xff);
    }

    _writeString(s) {
        for (let i = 0; i < s.length; i++) {
            this._writeByte(s.charCodeAt(i));
        }
    }

    _writeLSD() {
        this._writeByte(8);
    }

    _writePalette() {
        for (let i = 0; i < this._colorTab.length; i++) {
            this._writeByte(this._colorTab[i]);
        }
        const n = (3 * 256) - this._colorTab.length;
        for (let i = 0; i < n; i++) {
            this._writeByte(0);
        }
    }

    _writeNetscapeExt() {
        this._writeByte(0x21);
        this._writeByte(0xff);
        this._writeByte(11);
        const netscape = [78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48];
        for (const c of netscape) {
            this._writeByte(c);
        }
        this._writeByte(3);
        this._writeByte(1);
        this._writeShort(this.repeat);
        this._writeByte(0);
    }

    _writeGraphicCtrlExt() {
        this._writeByte(0x21);
        this._writeByte(0xf9);
        this._writeByte(4);
        let transp, disp;
        if (this.transparent === null) {
            transp = 0;
            disp = 0;
        } else {
            transp = 1;
            disp = 2;
        }
        if (this.dispose >= 0) {
            disp = this.dispose & 7;
        }
        disp <<= 2;
        this._writeByte(0 | disp | 0 | transp);
        this._writeShort(this.delay);
        this._writeByte(this.transparentIndex);
        this._writeByte(0);
    }

    _writeImageDesc() {
        this._writeByte(0x2c);
        this._writeShort(0);
        this._writeShort(0);
        this._writeShort(this.width);
        this._writeShort(this.height);
        if (this.firstFrame) {
            this.firstFrame = false;
            this._writeByte(0);
        } else {
            this._writeByte(0);
        }
    }

    _writePixels(indexedPixels) {
        const minCodeSize = 8;
        const clearCode = 1 << minCodeSize;
        const eofCode = clearCode + 1;

        const bitAccum = new BitAccum();

        const BITS = 12;
        const HSIZE = 5003;
        const htab = new Int32Array(HSIZE);
        const codtab = new Int32Array(HSIZE);
        const masks = [
            0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F,
            0x003F, 0x007F, 0x00FF, 0x01FF, 0x03FF, 0x07FF,
            0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF
        ];

        let freeEntry;
        let clearFlag;
        let nBits;
        let maxcode;
        let hcode;
        let ent;
        let hsizeReg;
        let disp;

        const pixelCount = indexedPixels.length;
        let curPixel = 0;
        let remaining = pixelCount;

        const output = [];
        bitAccum.reset(output);

        hsizeReg = HSIZE;
        for (let i = 0; i < hsizeReg; i++) {
            htab[i] = -1;
        }

        nBits = minCodeSize + 1;
        maxcode = (1 << nBits) - 1;
        clearFlag = true;
        freeEntry = clearCode + 2;

        bitAccum.setCodeSize(minCodeSize);
        bitAccum.write(clearCode, nBits);

        if (remaining === 0) {
            bitAccum.write(eofCode, nBits);
            bitAccum.flush();
            for (let i = 0; i < output.length; i++) {
                this._writeByte(output[i]);
            }
            return;
        }

        ent = indexedPixels[curPixel++];
        remaining--;

        while (remaining > 0) {
            const c = indexedPixels[curPixel++];
            remaining--;

            hcode = (c << BITS) + ent;
            let h = (c << 4) ^ ent;

            if (htab[h] === hcode) {
                ent = codtab[h];
                continue;
            }

            disp = h === 0 ? 1 : hsizeReg - h;

            let probe = true;
            while (probe) {
                h -= disp;
                if (h < 0) h += hsizeReg;
                if (htab[h] === hcode) {
                    ent = codtab[h];
                    probe = false;
                    break;
                }
                if (htab[h] < 0) {
                    probe = false;
                    break;
                }
            }

            if (!probe && htab[h] === hcode) {
                continue;
            }

            bitAccum.write(ent, nBits);
            ent = c;
            if (freeEntry < (1 << BITS)) {
                codtab[h] = freeEntry++;
                htab[h] = hcode;
                if (freeEntry > maxcode) {
                    if (nBits < BITS) {
                        nBits++;
                        maxcode = (1 << nBits) - 1;
                    } else {
                        htab.fill(-1);
                        freeEntry = clearCode + 2;
                        clearFlag = true;
                        bitAccum.write(clearCode, nBits);
                        nBits = minCodeSize + 1;
                        maxcode = (1 << nBits) - 1;
                    }
                }
            } else {
                htab.fill(-1);
                freeEntry = clearCode + 2;
                clearFlag = true;
                bitAccum.write(clearCode, nBits);
                nBits = minCodeSize + 1;
                maxcode = (1 << nBits) - 1;
            }
        }

        bitAccum.write(ent, nBits);
        bitAccum.write(eofCode, nBits);
        bitAccum.flush();

        for (let i = 0; i < output.length; i++) {
            this._writeByte(output[i]);
        }
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

    _findClosest(color) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        let minPos = 0;
        let minDist = 256 * 256 * 256;
        for (let i = 0; i < 256; i++) {
            const dr = r - this._colorTab[i * 3];
            const dg = g - this._colorTab[i * 3 + 1];
            const db = b - this._colorTab[i * 3 + 2];
            const d = dr * dr + dg * dg + db * db;
            if (d < minDist) {
                minDist = d;
                minPos = i;
            }
        }
        return minPos;
    }
}

class BitAccum {
    constructor() {
        this.codeSize = 0;
        this.accumulator = 0;
        this.accBits = 0;
        this.blocks = [];
        this.blockSize = 0;
        this.output = null;
    }

    reset(output) {
        this.accumulator = 0;
        this.accBits = 0;
        this.blocks = [];
        this.blockSize = 0;
        this.output = output;
    }

    setCodeSize(codeSize) {
        this.codeSize = codeSize;
    }

    write(code, codeSize) {
        for (let i = 0; i < codeSize; i++) {
            this.accumulator |= ((code >> i) & 1) << this.accBits;
            this.accBits++;
            if (this.accBits === 8) {
                this.blocks.push(this.accumulator & 0xff);
                this.blockSize++;
                this.accumulator = 0;
                this.accBits = 0;
                if (this.blockSize === 255) {
                    this.output.push(this.blockSize);
                    for (const b of this.blocks) {
                        this.output.push(b);
                    }
                    this.blocks = [];
                    this.blockSize = 0;
                }
            }
        }
    }

    flush() {
        if (this.accBits > 0) {
            this.blocks.push(this.accumulator & 0xff);
            this.blockSize++;
        }
        if (this.blockSize > 0) {
            this.output.push(this.blockSize);
            for (const b of this.blocks) {
                this.output.push(b);
            }
        }
        this.output.push(0);
    }
}
