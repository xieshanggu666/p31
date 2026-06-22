document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('particleCanvas');
    const system = new ParticleSystem(canvas);

    const showModePanel = (mode) => {
        document.querySelectorAll('.mode-specific-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById(`panel-${mode}`);
        if (panel) panel.style.display = 'block';
    };
    showModePanel('starfield');

    const countSlider = document.getElementById('particleCount');
    const countValue = document.getElementById('countValue');
    const colorPicker = document.getElementById('particleColor');
    const speedSlider = document.getElementById('particleSpeed');
    const speedValue = document.getElementById('speedValue');
    const sizeSlider = document.getElementById('particleSize');
    const sizeValue = document.getElementById('sizeValue');
    const glowSlider = document.getElementById('glowIntensity');
    const glowValue = document.getElementById('glowValue');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const interactionButtons = document.querySelectorAll('.interaction-btn');
    const themeButtons = document.querySelectorAll('.theme-btn');
    const customColorGroup = document.getElementById('customColorGroup');
    const linkSlider = document.getElementById('linkDistance');
    const linkValue = document.getElementById('linkValue');
    const fadeSlider = document.getElementById('fadeOut');
    const fadeValue = document.getElementById('fadeValue');
    const waveFreqSlider = document.getElementById('waveFrequency');
    const waveFreqValue = document.getElementById('waveFreqValue');
    const waveAmpSlider = document.getElementById('waveAmplitude');
    const waveAmpValue = document.getElementById('waveAmpValue');
    const waveLayersSlider = document.getElementById('waveLayers');
    const waveLayersValue = document.getElementById('waveLayersValue');
    const fractalDepthSlider = document.getElementById('fractalDepth');
    const fractalDepthValue = document.getElementById('fractalDepthValue');
    const fractalAngleSlider = document.getElementById('fractalBranchAngle');
    const fractalAngleValue = document.getElementById('fractalAngleValue');
    const fractalRatioSlider = document.getElementById('fractalLengthRatio');
    const fractalRatioValue = document.getElementById('fractalRatioValue');
    const flowScaleSlider = document.getElementById('flowScale');
    const flowScaleValue = document.getElementById('flowScaleValue');
    const flowForceSlider = document.getElementById('flowForce');
    const flowForceValue = document.getElementById('flowForceValue');
    const flowSpeedSlider = document.getElementById('flowSpeed');
    const flowSpeedValue = document.getElementById('flowSpeedValue');
    const screenshotBtn = document.getElementById('screenshotBtn');
    const resetBtn = document.getElementById('resetBtn');

    const STORAGE_KEY = 'particle-art-presets';

    const defaultPresets = [
        {
            name: '🌌 星空',
            preset: {
                mode: 'starfield',
                colorTheme: 'cool',
                particleColor: '#00ffff',
                particleCount: 500,
                particleSpeed: 0.3,
                particleSize: 2,
                glowIntensity: 15,
                interaction: 'attract',
                linkDistance: 150,
                fadeOut: 0.15,
                waveFrequency: 0.008,
                waveAmplitude: 60,
                waveLayers: 4,
                fractalDepth: 8,
                fractalBranchAngle: 0.5,
                fractalLengthRatio: 0.67,
                flowScale: 0.004,
                flowForce: 0.25,
                flowSpeed: 0.7
            }
        },
        {
            name: '🌊 海洋',
            preset: {
                mode: 'wave',
                colorTheme: 'warm',
                particleColor: '#00ffff',
                particleCount: 200,
                particleSpeed: 1,
                particleSize: 3,
                glowIntensity: 15,
                interaction: 'attract',
                linkDistance: 0,
                fadeOut: 0.12,
                waveFrequency: 0.015,
                waveAmplitude: 80,
                waveLayers: 8,
                fractalDepth: 8,
                fractalBranchAngle: 0.5,
                fractalLengthRatio: 0.67,
                flowScale: 0.004,
                flowForce: 0.25,
                flowSpeed: 0.7
            }
        },
        {
            name: '🌀 漩涡',
            preset: {
                mode: 'flowfield',
                colorTheme: 'neon',
                particleColor: '#00ffff',
                particleCount: 500,
                particleSpeed: 2,
                particleSize: 2,
                glowIntensity: 20,
                interaction: 'attract',
                linkDistance: 0,
                fadeOut: 0.03,
                waveFrequency: 0.008,
                waveAmplitude: 60,
                waveLayers: 4,
                fractalDepth: 8,
                fractalBranchAngle: 0.5,
                fractalLengthRatio: 0.67,
                flowScale: 0.003,
                flowForce: 0.25,
                flowSpeed: 2
            }
        }
    ];

    const initDefaultPresets = () => {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (!existing) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPresets));
        } else {
            const presets = JSON.parse(existing);
            const hasDefaults = defaultPresets.every(dp =>
                presets.some(p => p.name === dp.name)
            );
            if (!hasDefaults) {
                defaultPresets.forEach(dp => {
                    if (!presets.some(p => p.name === dp.name)) {
                        presets.push(dp);
                    }
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
            }
        }
    };

    const getPresets = () => {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    };

    const savePreset = (name, preset) => {
        const presets = getPresets();
        const existingIndex = presets.findIndex(p => p.name === name);
        if (existingIndex >= 0) {
            presets[existingIndex] = { name, preset };
        } else {
            presets.push({ name, preset });
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    };

    const deletePreset = (name) => {
        const presets = getPresets().filter(p => p.name !== name);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
        if (system.currentPresetName === name) {
            system.currentPresetName = null;
        }
    };

    const updateSlidersFromSystem = () => {
        countSlider.value = system.particleCount;
        countValue.textContent = system.particleCount;
        speedSlider.value = system.particleSpeed;
        speedValue.textContent = system.particleSpeed.toFixed(1);
        sizeSlider.value = system.particleSize;
        sizeValue.textContent = system.particleSize.toFixed(1);
        glowSlider.value = system.glowIntensity;
        glowValue.textContent = system.glowIntensity;
        colorPicker.value = system.particleColor;
        linkSlider.value = system.linkDistance;
        linkValue.textContent = system.linkDistance;
        fadeSlider.value = system.fadeOut;
        fadeValue.textContent = system.fadeOut.toFixed(2);

        themeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-theme="${system.colorTheme}"]`).classList.add('active');
        customColorGroup.style.display = system.colorTheme === 'custom' ? 'block' : 'none';

        interactionButtons.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-interaction="${system.interaction}"]`).classList.add('active');

        modeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-mode="${system.mode}"]`).classList.add('active');
        showModePanel(system.mode);

        if (waveFreqSlider) { waveFreqSlider.value = system.waveFrequency; waveFreqValue.textContent = system.waveFrequency.toFixed(4); }
        if (waveAmpSlider) { waveAmpSlider.value = system.waveAmplitude; waveAmpValue.textContent = system.waveAmplitude; }
        if (waveLayersSlider) { waveLayersSlider.value = system.waveLayers; waveLayersValue.textContent = system.waveLayers; }
        if (fractalDepthSlider) { fractalDepthSlider.value = system.fractalDepth; fractalDepthValue.textContent = system.fractalDepth; }
        if (fractalAngleSlider) { fractalAngleSlider.value = system.fractalBranchAngle; fractalAngleValue.textContent = system.fractalBranchAngle.toFixed(2); }
        if (fractalRatioSlider) { fractalRatioSlider.value = system.fractalLengthRatio; fractalRatioValue.textContent = system.fractalLengthRatio.toFixed(2); }
        if (flowScaleSlider) { flowScaleSlider.value = system.flowScale; flowScaleValue.textContent = system.flowScale.toFixed(4); }
        if (flowForceSlider) { flowForceSlider.value = system.flowForce; flowForceValue.textContent = system.flowForce.toFixed(2); }
        if (flowSpeedSlider) { flowSpeedSlider.value = system.flowSpeed; flowSpeedValue.textContent = system.flowSpeed.toFixed(2); }
    };

    const loadPresetByName = (name) => {
        const presets = getPresets();
        const found = presets.find(p => p.name === name);
        if (found) {
            system.loadPreset(found.preset);
            system.currentPresetName = name;
            updateSlidersFromSystem();
            renderPresetList();
        }
    };

    const renderPresetList = () => {
        const presetList = document.getElementById('presetList');
        const presets = getPresets();

        if (presets.length === 0) {
            presetList.innerHTML = '<div class="empty-preset">暂无保存的预设</div>';
            return;
        }

        presetList.innerHTML = presets.map(p => `
            <div class="preset-item ${system.currentPresetName === p.name ? 'active' : ''}" data-name="${p.name}">
                <span class="preset-name">${p.name}</span>
                <button class="preset-delete-btn" data-delete="${p.name}" title="删除预设">×</button>
            </div>
        `).join('');

        presetList.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('preset-delete-btn')) {
                    loadPresetByName(item.dataset.name);
                }
            });
        });

        presetList.querySelectorAll('.preset-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.delete;
                if (confirm(`确定要删除预设 "${name}" 吗？`)) {
                    deletePreset(name);
                    renderPresetList();
                }
            });
        });
    };

    const markAsModified = () => {
        system.currentPresetName = null;
        renderPresetList();
    };

    countSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        countValue.textContent = value;
        system.setParticleCount(value);
        markAsModified();
    });

    colorPicker.addEventListener('input', (e) => {
        system.setColor(e.target.value);
        markAsModified();
    });

    speedSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        speedValue.textContent = value.toFixed(1);
        system.setSpeed(value);
        markAsModified();
    });

    sizeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        sizeValue.textContent = value.toFixed(1);
        system.setSize(value);
        markAsModified();
    });

    glowSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        glowValue.textContent = value;
        system.setGlow(value);
        markAsModified();
    });

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            system.setMode(btn.dataset.mode);
            showModePanel(btn.dataset.mode);
            markAsModified();
        });
    });

    interactionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            interactionButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            system.setInteraction(btn.dataset.interaction);
            markAsModified();
        });
    });

    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            themeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.theme;
            system.setColorTheme(theme);

            if (theme === 'custom') {
                customColorGroup.style.display = 'block';
            } else {
                customColorGroup.style.display = 'none';
            }

            markAsModified();
        });
    });

    linkSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        linkValue.textContent = value;
        system.setLinkDistance(value);
        markAsModified();
    });

    fadeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        fadeValue.textContent = value.toFixed(2);
        system.setFadeOut(value);
        markAsModified();
    });

    if (waveFreqSlider) {
        waveFreqSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            waveFreqValue.textContent = value.toFixed(4);
            system.setWaveFrequency(value);
            markAsModified();
        });
    }

    if (waveAmpSlider) {
        waveAmpSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            waveAmpValue.textContent = value;
            system.setWaveAmplitude(value);
            markAsModified();
        });
    }

    if (waveLayersSlider) {
        waveLayersSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            waveLayersValue.textContent = value;
            system.setWaveLayers(value);
            markAsModified();
        });
    }

    if (fractalDepthSlider) {
        fractalDepthSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            fractalDepthValue.textContent = value;
            system.setFractalDepth(value);
            markAsModified();
        });
    }

    if (fractalAngleSlider) {
        fractalAngleSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            fractalAngleValue.textContent = value.toFixed(2);
            system.setFractalBranchAngle(value);
            markAsModified();
        });
    }

    if (fractalRatioSlider) {
        fractalRatioSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            fractalRatioValue.textContent = value.toFixed(2);
            system.setFractalLengthRatio(value);
            markAsModified();
        });
    }

    if (flowScaleSlider) {
        flowScaleSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            flowScaleValue.textContent = value.toFixed(4);
            system.setFlowScale(value);
            markAsModified();
        });
    }

    if (flowForceSlider) {
        flowForceSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            flowForceValue.textContent = value.toFixed(2);
            system.setFlowForce(value);
            markAsModified();
        });
    }

    if (flowSpeedSlider) {
        flowSpeedSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            flowSpeedValue.textContent = value.toFixed(2);
            system.setFlowSpeed(value);
            markAsModified();
        });
    }

    screenshotBtn.addEventListener('click', () => {
        system.takeScreenshot();
    });

    const recordGifBtn = document.getElementById('recordGifBtn');
    const gifProgressOverlay = document.getElementById('gifProgressOverlay');
    const gifProgressBar = document.getElementById('gifProgressBar');
    const gifProgressPercent = document.getElementById('gifProgressPercent');
    let isRecording = false;

    const showGifProgress = (current, total) => {
        const percent = Math.round((current / total) * 100);
        gifProgressBar.style.width = percent + '%';
        gifProgressPercent.textContent = percent + '%';
    };

    const showGifOverlay = () => {
        gifProgressOverlay.classList.add('show');
    };

    const hideGifOverlay = () => {
        gifProgressOverlay.classList.remove('show');
    };

    recordGifBtn.addEventListener('click', async () => {
        if (isRecording) return;
        isRecording = true;
        recordGifBtn.disabled = true;
        recordGifBtn.classList.add('recording');
        const originalText = recordGifBtn.textContent;

        try {
            showGifOverlay();
            await system.recordGif(3000, 100, (current, total) => {
                recordGifBtn.textContent = `🎬 录制中...`;
                showGifProgress(current, total);
            });
        } catch (e) {
            console.error('GIF录制失败:', e);
            alert('GIF录制失败: ' + e.message);
        } finally {
            hideGifOverlay();
            isRecording = false;
            recordGifBtn.disabled = false;
            recordGifBtn.classList.remove('recording');
            recordGifBtn.textContent = originalText;
        }
    });

    resetBtn.addEventListener('click', () => {
        countSlider.value = 200;
        countValue.textContent = '200';
        colorPicker.value = '#00ffff';
        speedSlider.value = 1;
        speedValue.textContent = '1.0';
        sizeSlider.value = 3;
        sizeValue.textContent = '3.0';
        glowSlider.value = 15;
        glowValue.textContent = '15';

        interactionButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-interaction="attract"]').classList.add('active');

        modeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-mode="starfield"]').classList.add('active');
        showModePanel('starfield');

        if (waveFreqSlider) { waveFreqSlider.value = 0.008; waveFreqValue.textContent = '0.0080'; }
        if (waveAmpSlider) { waveAmpSlider.value = 60; waveAmpValue.textContent = '60'; }
        if (waveLayersSlider) { waveLayersSlider.value = 4; waveLayersValue.textContent = '4'; }
        if (fractalDepthSlider) { fractalDepthSlider.value = 8; fractalDepthValue.textContent = '8'; }
        if (fractalAngleSlider) { fractalAngleSlider.value = 0.5; fractalAngleValue.textContent = '0.50'; }
        if (fractalRatioSlider) { fractalRatioSlider.value = 0.67; fractalRatioValue.textContent = '0.67'; }
        if (flowScaleSlider) { flowScaleSlider.value = 0.004; flowScaleValue.textContent = '0.0040'; }
        if (flowForceSlider) { flowForceSlider.value = 0.25; flowForceValue.textContent = '0.25'; }
        if (flowSpeedSlider) { flowSpeedSlider.value = 0.7; flowSpeedValue.textContent = '0.70'; }

        themeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-theme="cool"]').classList.add('active');
        customColorGroup.style.display = 'none';

        linkSlider.value = 0;
        linkValue.textContent = '0';

        fadeSlider.value = 0.15;
        fadeValue.textContent = '0.15';

        system.reset();
        renderPresetList();
    });

    const savePresetBtn = document.getElementById('savePresetBtn');
    const savePresetInput = document.getElementById('savePresetInput');
    const presetNameInput = document.getElementById('presetNameInput');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const cancelSaveBtn = document.getElementById('cancelSaveBtn');
    const randomPresetBtn = document.getElementById('randomPresetBtn');

    savePresetBtn.addEventListener('click', () => {
        savePresetInput.style.display = 'block';
        presetNameInput.value = '';
        presetNameInput.focus();
    });

    cancelSaveBtn.addEventListener('click', () => {
        savePresetInput.style.display = 'none';
        presetNameInput.value = '';
    });

    confirmSaveBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) {
            alert('请输入预设名称');
            presetNameInput.focus();
            return;
        }

        const presets = getPresets();
        const existing = presets.find(p => p.name === name);
        if (existing && !confirm(`预设 "${name}" 已存在，是否覆盖？`)) {
            return;
        }

        savePreset(name, system.getCurrentPreset());
        system.currentPresetName = name;
        savePresetInput.style.display = 'none';
        presetNameInput.value = '';
        renderPresetList();
    });

    presetNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmSaveBtn.click();
        }
    });

    randomPresetBtn.addEventListener('click', () => {
        system.randomizeCurrentMode();
        updateSlidersFromSystem();
        renderPresetList();
    });

    initDefaultPresets();
    renderPresetList();
});
