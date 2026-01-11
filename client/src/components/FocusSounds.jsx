import { useState, useRef, useEffect } from 'react';

// Brown noise generator using Web Audio API
function createBrownNoise(audioContext) {
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Amplify
    }

    return noiseBuffer;
}

// White noise generator
function createWhiteNoise(audioContext) {
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    return noiseBuffer;
}

// Pink noise generator
function createPinkNoise(audioContext) {
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
    }

    return noiseBuffer;
}

const SOUND_TYPES = [
    { id: 'none', label: 'Off', emoji: '🔇' },
    { id: 'brown', label: 'Brown Noise', emoji: '🟤' },
    { id: 'white', label: 'White Noise', emoji: '⚪' },
    { id: 'pink', label: 'Pink Noise', emoji: '🩷' },
];

export default function FocusSounds() {
    const [activeSound, setActiveSound] = useState('none');
    const [volume, setVolume] = useState(0.3);
    const [isExpanded, setIsExpanded] = useState(false);

    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const gainRef = useRef(null);

    useEffect(() => {
        return () => {
            stopSound();
        };
    }, []);

    useEffect(() => {
        if (gainRef.current) {
            gainRef.current.gain.value = volume;
        }
    }, [volume]);

    function stopSound() {
        if (sourceRef.current) {
            sourceRef.current.stop();
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    }

    function playSound(type) {
        stopSound();

        if (type === 'none') {
            setActiveSound('none');
            return;
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        let buffer;
        switch (type) {
            case 'brown':
                buffer = createBrownNoise(audioContext);
                break;
            case 'white':
                buffer = createWhiteNoise(audioContext);
                break;
            case 'pink':
                buffer = createPinkNoise(audioContext);
                break;
            default:
                return;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = audioContext.createGain();
        gain.gain.value = volume;
        gainRef.current = gain;

        source.connect(gain);
        gain.connect(audioContext.destination);
        source.start();
        sourceRef.current = source;

        setActiveSound(type);
    }

    const activeSoundInfo = SOUND_TYPES.find(s => s.id === activeSound);

    return (
        <div className="focus-sounds">
            <button
                className={`focus-sounds-toggle ${activeSound !== 'none' ? 'active' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
                title="Focus Sounds"
            >
                <span className="sound-icon">{activeSoundInfo?.emoji || '🔇'}</span>
                {activeSound !== 'none' && <span className="sound-indicator"></span>}
            </button>

            {isExpanded && (
                <div className="focus-sounds-panel">
                    <div className="sounds-header">Focus Sounds</div>

                    <div className="sound-options">
                        {SOUND_TYPES.map(sound => (
                            <button
                                key={sound.id}
                                className={`sound-option ${activeSound === sound.id ? 'active' : ''}`}
                                onClick={() => playSound(sound.id)}
                            >
                                <span className="sound-emoji">{sound.emoji}</span>
                                <span className="sound-label">{sound.label}</span>
                            </button>
                        ))}
                    </div>

                    {activeSound !== 'none' && (
                        <div className="volume-control">
                            <span className="volume-icon">🔊</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="volume-slider"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
