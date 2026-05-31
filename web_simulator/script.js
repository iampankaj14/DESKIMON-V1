// Eye Elements & Wrappers
const eyeLeft = document.getElementById('eyeLeft');
const eyeRight = document.getElementById('eyeRight');
const eyeLeftWrapper = eyeLeft.parentElement;
const eyeRightWrapper = eyeRight.parentElement;
const eyeContainer = document.getElementById('eyeContainer');
const deviceFrame = document.getElementById('deviceFrame');

// Config State
let activeExpression = 'neutral';
let eyeColor = '#18d7e8';
let eyeScale = 1.0;
let eyeSpacing = 120;
let blinkFreq = 4500;
let isMouseTracking = true;

// Mouse Tracking State variables
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
const lerpSpeed = 0.12; // Controls eye stiffness/smoothness

// Event Listeners
document.addEventListener('mousemove', handleMouseMove);
let blinkTimer = setTimeout(triggerBlink, blinkFreq);

// 1. Mouse Coordinate Handler
function handleMouseMove(e) {
    if (!isMouseTracking) return;
    
    const rect = deviceFrame.getBoundingClientRect();
    const frameCenterX = rect.left + rect.width / 2;
    const frameCenterY = rect.top + rect.height / 2;
    
    // Normalize coordinates relative to screen dimensions (-1.0 to 1.0)
    const dx = (e.clientX - frameCenterX) / (window.innerWidth / 2);
    const dy = (e.clientY - frameCenterY) / (window.innerHeight / 2);
    
    // Maximum offset the eyes can move inside their sockets (px)
    const maxLookOffsetHorizontal = 24;
    const maxLookOffsetVertical = 16;
    
    targetX = dx * maxLookOffsetHorizontal;
    targetY = dy * maxLookOffsetVertical;
}

// 2. Main Render Loop (Smooth tracking using LERP)
function renderLoop() {
    if (isMouseTracking) {
        // Interpolate toward targets for a soft organic feel
        currentX += (targetX - currentX) * lerpSpeed;
        currentY += (targetY - currentY) * lerpSpeed;
    } else {
        // Return smoothly to center
        currentX += (0 - currentX) * lerpSpeed;
        currentY += (0 - currentY) * lerpSpeed;
    }
    
    // Apply translation to left and right eye wrappers
    eyeLeftWrapper.style.transform = `translate(${currentX}px, ${currentY}px) scale(${eyeScale})`;
    eyeRightWrapper.style.transform = `translate(${currentX}px, ${currentY}px) scale(${eyeScale})`;
    
    requestAnimationFrame(renderLoop);
}
// Start render loop
renderLoop();

// 3. Natural Organic Blinking
function triggerBlink() {
    if (activeExpression !== 'sleepy') {
        // Momentarily inject blink class
        eyeLeft.classList.add('blinking');
        eyeRight.classList.add('blinking');
        
        // We simulate a blink by squashing height to 0
        const prevTransformL = eyeLeft.style.transform;
        const prevTransformR = eyeRight.style.transform;
        
        eyeLeft.style.transform = `${prevTransformL} scaleY(0.03)`;
        eyeRight.style.transform = `${prevTransformR} scaleY(0.03)`;
        
        setTimeout(() => {
            eyeLeft.style.transform = prevTransformL;
            eyeRight.style.transform = prevTransformR;
            eyeLeft.classList.remove('blinking');
            eyeRight.classList.remove('blinking');
        }, 120);
    }
    
    // Schedule next blink at random interval (around set freq)
    clearTimeout(blinkTimer);
    const nextInterval = blinkFreq * (0.6 + Math.random() * 0.8);
    blinkTimer = setTimeout(triggerBlink, nextInterval);
}

// 4. Synthesize Digital Sound FX (Web Audio API)
function playBeep(freq1, freq2, duration) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'triangle'; // Soft retro digital tone
        oscillator.frequency.setValueAtTime(freq1, audioCtx.currentTime);
        
        if (freq2) {
            // Glide frequency to second pitch (pitch slide!)
            oscillator.frequency.exponentialRampToValueAtTime(freq2, audioCtx.currentTime + duration);
        }
        
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.log("Audio not supported or waiting for user interaction");
    }
}

// 5. Expression Manager
function setExpression(expr) {
    activeExpression = expr;
    
    // Update active button state
    document.querySelectorAll('.expr-btn').forEach(btn => btn.classList.remove('active'));
    
    // Clear custom styling rotations first
    eyeLeft.style.transform = '';
    eyeRight.style.transform = '';
    eyeLeft.style.borderRadius = '';
    eyeRight.style.borderRadius = '';
    
    // Remove old classes and apply new
    const classes = ['neutral', 'happy', 'angry', 'sad', 'sleepy', 'surprised'];
    classes.forEach(c => {
        eyeLeft.classList.remove(c);
        eyeRight.classList.remove(c);
    });
    
    // Custom audio and visual transforms per state
    switch(expr) {
        case 'happy':
            document.getElementById('btnHappy').classList.add('active');
            eyeLeft.classList.add('happy');
            eyeRight.classList.add('happy');
            playBeep(650, 950, 0.18); // Happy chirp
            break;
            
        case 'angry':
            document.getElementById('btnAngry').classList.add('active');
            eyeLeft.classList.add('angry');
            eyeRight.classList.add('angry');
            playBeep(220, 160, 0.22); // Grumpy boop
            break;
            
        case 'sad':
            document.getElementById('btnSad').classList.add('active');
            eyeLeft.classList.add('sad');
            eyeRight.classList.add('sad');
            playBeep(320, 240, 0.3); // Whining whistle
            break;
            
        case 'sleepy':
            document.getElementById('btnSleepy').classList.add('active');
            eyeLeft.classList.add('sleepy');
            eyeRight.classList.add('sleepy');
            playBeep(400, 300, 0.4); // Yawn slide
            break;
            
        case 'surprised':
            document.getElementById('btnSurprised').classList.add('active');
            eyeLeft.classList.add('surprised');
            eyeRight.classList.add('surprised');
            playBeep(880, 1200, 0.15); // Excited snap!
            break;
            
        default:
            document.getElementById('btnNeutral').classList.add('active');
            playBeep(523, 523, 0.08); // Simple click
            break;
    }
    
    updateCodeBlock();
}

// 6. UI Tuning configurations
function updateColor(hex) {
    eyeColor = hex;
    document.getElementById('colorHexText').innerText = hex.toUpperCase();
    
    // Convert hex to rgb for glow
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Calculate mid and dark colors for beveled gradient
    const scaleColor = (hex, percent) => {
        let R = parseInt(hex.substring(1,3),16);
        let G = parseInt(hex.substring(3,5),16);
        let B = parseInt(hex.substring(5,7),16);
        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);
        R = (R<255)?R:255; G = (G<255)?G:255; B = (B<255)?B:255;
        R = (R>0)?R:0; G = (G>0)?G:0; B = (B>0)?B:0;
        const rHex = R.toString(16).padStart(2, '0');
        const gHex = G.toString(16).padStart(2, '0');
        const bHex = B.toString(16).padStart(2, '0');
        return `#${rHex}${gHex}${bHex}`;
    };
    
    const eyeColorMid = scaleColor(hex, -20);
    const eyeColorDark = scaleColor(hex, -55);
    
    document.documentElement.style.setProperty('--eye-color', hex);
    document.documentElement.style.setProperty('--eye-color-mid', eyeColorMid);
    document.documentElement.style.setProperty('--eye-color-dark', eyeColorDark);
    document.documentElement.style.setProperty('--eye-glow', `rgba(${r}, ${g}, ${b}, 0.55)`);
    
    updateCodeBlock();
}

function updateScale(val) {
    eyeScale = parseFloat(val);
    document.getElementById('scaleValText').innerText = val + 'x';
    updateCodeBlock();
}

function updateSpacing(val) {
    eyeSpacing = parseInt(val);
    document.getElementById('spacingValText').innerText = val + 'px';
    document.documentElement.style.setProperty('--eye-spacing', val + 'px');
    updateCodeBlock();
}

function updateBlinkFreq(val) {
    blinkFreq = parseInt(val);
    document.getElementById('blinkValText').innerText = (val/1000).toFixed(1) + 's';
    
    // Reschedule blink timer
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(triggerBlink, blinkFreq);
}

function toggleMouseTracking(checked) {
    isMouseTracking = checked;
    if(!checked) {
        targetX = 0;
        targetY = 0;
    }
}

// 7. Dynamic Embedded Code Block Generator
function updateCodeBlock() {
    const codeBlock = document.getElementById('codeBlock');
    const colorHex = eyeColor.toUpperCase().replace('#', '0x');
    
    let stateLines = "";
    if (activeExpression === 'happy') {
        stateLines = `    // Happy Expression: squash and slant
    lv_img_set_angle(eye_l, 0);
    lv_img_set_angle(eye_r, 0);
    lv_obj_set_size(eye_l, 101, 115);
    lv_obj_set_size(eye_r, 101, 115);
    lv_obj_set_style_radius(eye_l, 15, 0); // Flat bottom shape
    lv_obj_set_style_radius(eye_r, 15, 0);`;
    } else if (activeExpression === 'angry') {
        stateLines = `    // Angry Expression: rotate inwards
    lv_img_set_angle(eye_l, 150); // Rotate left eye 15.0°
    lv_img_set_angle(eye_r, 3450); // Rotate right eye -15.0°
    lv_obj_set_size(eye_l, 101, 165);
    lv_obj_set_size(eye_r, 101, 165);`;
    } else if (activeExpression === 'sad') {
        stateLines = `    // Sad Expression: slant outwards
    lv_img_set_angle(eye_l, 3480); // Rotate left eye -12.0°
    lv_img_set_angle(eye_r, 120); // Rotate right eye 12.0°
    lv_obj_set_size(eye_l, 101, 165);
    lv_obj_set_size(eye_r, 101, 165);`;
    } else if (activeExpression === 'sleepy') {
        stateLines = `    // Sleepy Expression: highly squashed
    lv_img_set_angle(eye_l, 0);
    lv_img_set_angle(eye_r, 0);
    lv_obj_set_size(eye_l, 101, 49); // scaleY(0.3)
    lv_obj_set_size(eye_r, 101, 49);`;
    } else if (activeExpression === 'surprised') {
        stateLines = `    // Surprised Expression: zoom scale up
    lv_img_set_angle(eye_l, 0);
    lv_img_set_angle(eye_r, 0);
    // Set 1.22x zoom factor
    lv_img_set_zoom(eye_l, 312); // LV_IMG_ZOOM_NONE = 256
    lv_img_set_zoom(eye_r, 312);`;
    } else {
        stateLines = `    // Neutral Expression: standard size & angle
    lv_img_set_angle(eye_l, 0);
    lv_img_set_angle(eye_r, 0);
    lv_obj_set_size(eye_l, 101, 165);
    lv_obj_set_size(eye_r, 101, 165);
    lv_img_set_zoom(eye_l, 256); // 1.0x scale
    lv_img_set_zoom(eye_r, 256);`;
    }

    const cCode = `/* Deskimon Eye Animation Block */
void set_deskimon_expression(void) {
    // Left & Right eye setup (101x165 px)
    lv_img_set_src(eye_l, &left_eye);
    lv_img_set_src(eye_r, &left_eye);
    
    // Set layout parameters
    lv_obj_align(eye_l, LV_ALIGN_CENTER, -${eyeSpacing / 2}, 0);
    lv_obj_align(eye_r, LV_ALIGN_CENTER, ${eyeSpacing / 2}, 0);

    // Apply scaling
    lv_img_set_zoom(eye_l, ${Math.round(256 * eyeScale)});
    lv_img_set_zoom(eye_r, ${Math.round(256 * eyeScale)});

${stateLines}
}`;
    codeBlock.textContent = cCode;
}

// 8. Clipboard Exporter Utility
function copyCodeToClipboard() {
    const codeBlock = document.getElementById('codeBlock');
    navigator.clipboard.writeText(codeBlock.textContent).then(() => {
        const copyBtn = document.getElementById('copyCodeBtn');
        copyBtn.innerText = "Copied!";
        copyBtn.style.background = "#10b981";
        copyBtn.style.color = "#ffffff";
        
        playBeep(900, 1400, 0.08); // Success feedback chirp
        
        setTimeout(() => {
            copyBtn.innerText = "Copy Code";
            copyBtn.style.background = "rgba(24, 215, 232, 0.1)";
            copyBtn.style.color = "var(--accent-color)";
        }, 1500);
    });
}

// Initialize C code block display on load
updateCodeBlock();
setExpression('neutral');
