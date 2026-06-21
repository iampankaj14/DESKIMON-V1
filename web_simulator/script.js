// Eye Elements & Wrappers
const eyeLeft = document.getElementById('eyeLeft');
const eyeRight = document.getElementById('eyeRight');
const eyeLeftWrapper = document.querySelector('.eye-wrapper.left');
const eyeRightWrapper = document.querySelector('.eye-wrapper.right');
const eyeContainer = document.getElementById('eyeContainer');
const deviceFrame = document.getElementById('deviceFrame');

// Accessories Selectors
const eyelidLeftTop = document.getElementById('eyelidLeftTop');
const eyelidRightTop = document.getElementById('eyelidRightTop');
const eyelidLeftMoon = document.getElementById('eyelidLeftMoon');
const eyelidRightMoon = document.getElementById('eyelidRightMoon');
const tearLeft = document.getElementById('tearLeft');
const tearRight = document.getElementById('tearRight');
const eyeLeftInsecure = document.getElementById('eyeLeftInsecure');
const eyeRightInsecure = document.getElementById('eyeRightInsecure');
const eyeClosedLeft = document.getElementById('eyeClosedLeft');
const eyeClosedRight = document.getElementById('eyeClosedRight');
const ignoreLineLeft = document.getElementById('ignoreLineLeft');
const ignoreLineRight = document.getElementById('ignoreLineRight');
const ignoreHemiLeft = document.getElementById('ignoreHemiLeft');
const ignoreHemiRight = document.getElementById('ignoreHemiRight');
const laughHemiLeft = document.getElementById('laughHemiLeft');
const laughHemiRight = document.getElementById('laughHemiRight');

// Mouth Selectors
const mouthArcLeft = document.getElementById('mouthArcLeft');
const mouthArcRight = document.getElementById('mouthArcRight');
const mouthInterestLeft = document.getElementById('mouthInterestLeft');
const mouthInterestRight = document.getElementById('mouthInterestRight');
const mouthYawn = document.getElementById('mouthYawn');
const mouthTriangle = document.getElementById('mouthTriangle');
const mouthInsecure = document.getElementById('mouthInsecure');
const mouthOoh = document.getElementById('mouthOoh');
const mouthWtf = document.getElementById('mouthWtf');
const mouthWtfCircle = document.getElementById('mouthWtfCircle');
const mouthLaugh = document.getElementById('mouthLaugh');

// Config State
let activeExpression = 'neutral';
let eyeColor = '#1AC8DB';
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
    // Only blink if we are in neutral/happy/angry/bored/blush/chill/ooh/wtf/laugh
    const blockBlink = ['sleepy', 'cry', 'interest', 'ignore', 'insecure'].includes(activeExpression);
    
    if (!blockBlink) {
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

// Helper to capitalize strings
const capitalize = s => s && s[0].toUpperCase() + s.slice(1);

// Reset all temporary visual styles and accessories
function resetAccessories() {
    // Show base eyes by default
    eyeLeft.style.opacity = '1';
    eyeRight.style.opacity = '1';
    
    // Remove custom styling overrides
    eyeLeft.style.transform = '';
    eyeRight.style.transform = '';
    eyeLeft.style.width = '';
    eyeLeft.style.height = '';
    eyeRight.style.width = '';
    eyeRight.style.height = '';
    eyeLeft.style.backgroundColor = '';
    eyeRight.style.backgroundColor = '';
    eyeLeft.style.boxShadow = '';
    eyeRight.style.boxShadow = '';
    
    // Hide eyelids
    eyelidLeftTop.style.transform = 'translateY(-150px)';
    eyelidRightTop.style.transform = 'translateY(-150px)';
    eyelidLeftMoon.style.transform = 'translate(-50%, 165px)';
    eyelidRightMoon.style.transform = 'translate(-50%, 165px)';
    
    // Hide tears
    tearLeft.style.height = '0';
    tearLeft.style.opacity = '0';
    tearLeft.className = 'tear';
    tearRight.style.height = '0';
    tearRight.style.opacity = '0';
    tearRight.className = 'tear';
    
    // Hide dedicated eye shapes
    eyeLeftInsecure.classList.remove('active');
    eyeLeftInsecure.className = 'eye-insecure';
    eyeRightInsecure.classList.remove('active');
    eyeRightInsecure.className = 'eye-insecure';
    
    eyeClosedLeft.classList.remove('active');
    eyeClosedLeft.className = 'eye-closed';
    eyeClosedRight.classList.remove('active');
    eyeClosedRight.className = 'eye-closed';
    
    ignoreLineLeft.classList.remove('active');
    ignoreLineLeft.className = 'ignore-line';
    ignoreLineRight.classList.remove('active');
    ignoreLineRight.className = 'ignore-line';
    
    ignoreHemiLeft.classList.remove('active');
    ignoreHemiLeft.className = 'ignore-hemi';
    ignoreHemiRight.classList.remove('active');
    ignoreHemiRight.className = 'ignore-hemi';
    
    laughHemiLeft.classList.remove('active');
    laughHemiLeft.className = 'laugh-hemi';
    laughHemiRight.classList.remove('active');
    laughHemiRight.className = 'laugh-hemi';
    
    // Remove wrapper animation classes
    eyeLeftWrapper.className = 'eye-wrapper left';
    eyeRightWrapper.className = 'eye-wrapper right';
    
    // Hide all mouths
    mouthArcLeft.classList.remove('active');
    mouthArcRight.classList.remove('active');
    mouthInterestLeft.classList.remove('active');
    mouthInterestRight.classList.remove('active');
    
    mouthYawn.classList.remove('active');
    mouthTriangle.classList.remove('active');
    mouthInsecure.classList.remove('active');
    mouthOoh.classList.remove('active');
    
    mouthWtf.classList.remove('active');
    mouthWtfCircle.classList.remove('active');
    mouthWtfCircle.style.width = '';
    mouthWtfCircle.style.height = '';
    mouthWtfCircle.style.opacity = '';
    
    mouthLaugh.classList.remove('active');
    mouthLaugh.className = 'mouth-laugh';
    mouthLaugh.style.height = '';
    mouthLaugh.style.transform = '';
}

// 5. Expression Manager
function setExpression(expr) {
    activeExpression = expr;
    
    // Update active button state
    document.querySelectorAll('.expr-btn').forEach(btn => btn.classList.remove('active'));
    
    const btnId = `btn${capitalize(expr)}`;
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');
    
    resetAccessories();
    
    // Set dynamic properties based on expression
    switch(expr) {
        case 'happy':
            // Moon eyelids cut off bottom of the eyes
            eyelidLeftMoon.style.transform = 'translate(-50%, 40px)';
            eyelidRightMoon.style.transform = 'translate(-50%, 40px)';
            playBeep(650, 950, 0.18); // Happy chirp
            break;
            
        case 'angry':
            // Large size, top lid slanting down, inwards rotation
            eyeLeft.style.width = '130px';
            eyeLeft.style.height = '180px';
            
            eyeRight.style.width = '130px';
            eyeRight.style.height = '180px';
            
            eyelidLeftTop.style.transform = 'translateY(-40px)';
            eyelidRightTop.style.transform = 'translateY(-40px)';
            
            eyeLeft.style.transform = 'rotate(15deg)';
            eyeRight.style.transform = 'rotate(-15deg)';
            
            playBeep(220, 160, 0.22); // Grumpy boop
            break;
            
        case 'sad':
            // Rotate eyes outwards
            eyeLeft.style.transform = 'rotate(-12deg)';
            eyeRight.style.transform = 'rotate(12deg)';
            playBeep(320, 240, 0.3); // Whining whistle
            break;
            
        case 'sleepy':
            // Highly squashed
            eyeLeft.style.width = '90px';
            eyeLeft.style.height = '25px';
            eyeLeft.style.transform = 'translateY(40px)';
            
            eyeRight.style.width = '90px';
            eyeRight.style.height = '25px';
            eyeRight.style.transform = 'translateY(40px)';
            
            playBeep(400, 300, 0.4); // Yawn slide
            break;
            
        case 'cry':
            // Flat squashed line eyes, tears dripping, sad tone
            eyeLeft.style.width = '100px';
            eyeLeft.style.height = '15px';
            eyeLeft.style.transform = 'translateY(-20px)';
            eyeRight.style.width = '100px';
            eyeRight.style.height = '15px';
            eyeRight.style.transform = 'translateY(-20px)';
            
            tearLeft.className = 'tear tear-dripping-l';
            tearRight.className = 'tear tear-dripping-r';
            
            playBeep(350, 180, 0.5); // crying whine
            break;
            
        case 'interest':
            // Hide base eyes, show diagonal cut insecure/interest eyes, show curved interest mouths, jitter eyes
            eyeLeft.style.opacity = '0';
            eyeRight.style.opacity = '0';
            
            eyeLeftInsecure.classList.add('active');
            eyeRightInsecure.classList.add('active');
            
            eyeLeftInsecure.classList.add('jittering');
            eyeRightInsecure.classList.add('jittering');
            
            mouthInterestLeft.classList.add('active');
            mouthInterestRight.classList.add('active');
            
            playBeep(580, 880, 0.15); // interested chirp
            break;
            
        case 'ooh':
            // Expand to big eggs, open circle mouth
            eyeLeft.style.width = '105px';
            eyeLeft.style.height = '130px';
            eyeLeft.style.transform = 'translateY(-10px)';
            
            eyeRight.style.width = '105px';
            eyeRight.style.height = '130px';
            eyeRight.style.transform = 'translateY(-10px)';
            
            mouthOoh.classList.add('active');
            
            playBeep(440, 660, 0.25); // Ooh!
            break;
            
        case 'wtf':
            // Expand to laser horizontal line eyes, morph solid circle mouth into triangle
            eyeLeft.style.width = '100px';
            eyeLeft.style.height = '16px';
            eyeLeft.style.transform = 'translateY(-45px)';
            
            eyeRight.style.width = '100px';
            eyeRight.style.height = '16px';
            eyeRight.style.transform = 'translateY(-45px)';
            
            // Instantly show circle, then fade it out and expand triangle
            mouthWtfCircle.classList.add('active');
            setTimeout(() => {
                mouthWtfCircle.style.width = '0px';
                mouthWtfCircle.style.height = '0px';
                mouthWtfCircle.style.opacity = '0';
                
                mouthWtf.classList.add('active');
            }, 100);
            
            playBeep(880, 1200, 0.15); // Shocked beep
            break;
            
        case 'laugh':
            // Eyes pushed to top, top lid active, bobbing mouth revealing teeth
            eyeLeft.style.transform = 'translateY(-120px)';
            eyeRight.style.transform = 'translateY(-120px)';
            eyelidLeftTop.style.transform = 'translateY(-30px)';
            eyelidRightTop.style.transform = 'translateY(-30px)';
            
            mouthLaugh.classList.add('active');
            mouthLaugh.classList.add('bobbing-laugh-mouth');
            
            // Jitter/bob eyes as well
            eyeLeftWrapper.className = 'eye-wrapper left bobbing-laugh';
            eyeRightWrapper.className = 'eye-wrapper right bobbing-laugh';
            
            playBeep(520, 1040, 0.25); // giggling chirp
            break;
            
        case 'bored':
            // Large size, top lids drooped halfway down
            eyeLeft.style.width = '130px';
            eyeLeft.style.height = '180px';
            eyeRight.style.width = '130px';
            eyeRight.style.height = '180px';
            
            eyelidLeftTop.style.transform = 'translateY(-40px)';
            eyelidRightTop.style.transform = 'translateY(-40px)';
            
            playBeep(250, 200, 0.35); // bored sigh
            break;
            
        case 'blush':
            // Moon eyelids cut bottom of eyes, smiling mouth arcs
            eyelidLeftMoon.style.transform = 'translate(-50%, 40px)';
            eyelidRightMoon.style.transform = 'translate(-50%, 40px)';
            
            mouthArcLeft.classList.add('active');
            mouthArcRight.classList.add('active');
            
            playBeep(700, 1100, 0.16); // blush squeak
            break;
            
        case 'chill':
            // Base eyes translated slightly down, top lid active, smiling mouth arcs
            eyeLeft.style.transform = 'translateY(-50px)';
            eyeRight.style.transform = 'translateY(-50px)';
            
            eyelidLeftTop.style.transform = 'translateY(-50px)';
            eyelidRightTop.style.transform = 'translateY(-50px)';
            
            mouthArcLeft.classList.add('active');
            mouthArcRight.classList.add('active');
            
            playBeep(330, 440, 0.2); // chill tone
            break;
            
        default:
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
    
    // Also update custom inline style color properties if base color isn't hex (e.g. for insecure eyes)
    if (eyeLeftInsecure) eyeLeftInsecure.style.backgroundColor = hex;
    if (eyeRightInsecure) eyeRightInsecure.style.backgroundColor = hex;
    
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

// 7. Dynamic Embedded Code Block Generator (LVGL C code)
function updateCodeBlock() {
    const codeBlock = document.getElementById('codeBlock');
    const colorHex = eyeColor.toUpperCase().replace('#', '0x');
    
    let stateLines = "";
    
    if (activeExpression === 'happy') {
        stateLines = `    // Happy Expression: Bottom circular mask activated
    animate_eye_base(eye_l, 100, 165, 0, 0, 0, 400);
    animate_eye_base(eye_r, 100, 165, 0, 0, 0, 400);
    anim_prop(mask_moon_l, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), 40, 400);
    anim_prop(mask_moon_r, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), 40, 400);`;
    } else if (activeExpression === 'angry') {
        stateLines = `    // Angry Expression: enlarged, top lid down, slanted
    animate_eye_base(eye_l, 130, 180, 0, 0, -40, 300);
    animate_eye_base(eye_r, 130, 180, 0, 0, -40, 300);
    anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -40, 300);
    anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -40, 300);`;
    } else if (activeExpression === 'sad') {
        stateLines = `    // Sad Expression: outward slanting
    animate_eye_base(eye_l, 100, 165, -12, 0, 0, 400);
    animate_eye_base(eye_r, 100, 165, 12, 0, 0, 400);`;
    } else if (activeExpression === 'sleepy') {
        stateLines = `    // Sleepy Expression: low squashed shape
    animate_eye_base(eye_l, 90, 25, 0, 0, 40, 800);
    animate_eye_base(eye_r, 90, 25, 0, 0, 40, 800);`;
    } else if (activeExpression === 'cry') {
        stateLines = `    // Cry Expression: flat horizontal lines, tears dripping
    animate_eye_base(eye_l, 100, 15, 0, 0, -20, 300);
    animate_eye_base(eye_r, 100, 15, 0, 0, -20, 300);
    fade_obj(tear_l, true, 300);
    fade_obj(tear_r, true, 300);`;
    } else if (activeExpression === 'interest') {
        stateLines = `    // Interest Expression: insecure cut eyes, twin smiling mouths, jitter
    fade_obj(eye_l, false, 300);
    fade_obj(eye_r, false, 300);
    fade_obj(insecure_eye_l, true, 300);
    fade_obj(insecure_eye_r, true, 300);
    fade_obj(interest_mouth_l, true, 300);
    fade_obj(interest_mouth_r, true, 300);`;
    } else if (activeExpression === 'ooh') {
        stateLines = `    // Ooh Expression: egg eyes, circular expanding mouth
    animate_eye_base(eye_l, 105, 130, 0, 0, -10, 500);
    animate_eye_base(eye_r, 105, 130, 0, 0, -10, 500);
    fade_obj(mouth_ooh, true, 300);`;
    } else if (activeExpression === 'wtf') {
        stateLines = `    // WTF Expression: laser eyes, solid circle morphing into triangle
    animate_eye_base(eye_l, 100, 16, 0, 0, -45, 500);
    animate_eye_base(eye_r, 100, 16, 0, 0, -45, 500);
    fade_obj(mouth_wtf, true, 500);`;
    } else if (activeExpression === 'laugh') {
        stateLines = `    // Laugh Expression: eyes high, drooped lids, large capsule mouth
    animate_eye_base(eye_l, 100, 165, 0, 0, -120, 400);
    animate_eye_base(eye_r, 100, 165, 0, 0, -120, 400);
    anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -30, 400);
    anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -30, 400);
    fade_obj(laugh_mouth, true, 300);`;
    } else if (activeExpression === 'bored') {
        stateLines = `    // Bored Expression: half-lidded top droop
    animate_eye_base(eye_l, 130, 180, 0, 0, -40, 500);
    animate_eye_base(eye_r, 130, 180, 0, 0, -40, 500);
    anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -40, 500);
    anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -40, 500);`;
    } else if (activeExpression === 'blush') {
        stateLines = `    // Blush Expression: happy eyes + smile arcs
    animate_eye_base(eye_l, 100, 165, 0, 0, 0, 300);
    animate_eye_base(eye_r, 100, 165, 0, 0, 0, 300);
    anim_prop(mask_moon_l, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_l, 0), 40, 300);
    anim_prop(mask_moon_r, set_ty_cb, lv_obj_get_style_translate_y(mask_moon_r, 0), 40, 300);
    fade_obj(mouth_arc_l, true, 300);
    fade_obj(mouth_arc_r, true, 300);`;
    } else if (activeExpression === 'chill') {
        stateLines = `    // Chill Expression: half-closed eyelids + smile arcs
    animate_eye_base(eye_l, 100, 165, 0, 0, -50, 400);
    animate_eye_base(eye_r, 100, 165, 0, 0, -50, 400);
    anim_prop(mask_top_l, set_ty_cb, lv_obj_get_style_translate_y(mask_top_l, 0), -50, 400);
    anim_prop(mask_top_r, set_ty_cb, lv_obj_get_style_translate_y(mask_top_r, 0), -50, 400);
    fade_obj(mouth_arc_l, true, 400);
    fade_obj(mouth_arc_r, true, 400);`;
    } else {
        stateLines = `    // Neutral Expression: standard size & angle
    animate_eye_base(eye_l, 100, 165, 0, 0, 0, 400);
    animate_eye_base(eye_r, 100, 165, 0, 0, 0, 400);`;
    }

    const cCode = `/* Deskimon Eye Animation Block */
void set_deskimon_expression(void) {
    // Apply eye theme color
    Deskimon_SetEyeColor(${colorHex});

    // Set layout parameters
    lv_obj_align(eye_l, LV_ALIGN_CENTER, -${Math.round(eyeSpacing / 2)}, 0);
    lv_obj_align(eye_r, LV_ALIGN_CENTER, ${Math.round(eyeSpacing / 2)}, 0);

    // Apply scaling
    lv_obj_set_width(eye_l, ${Math.round(100 * eyeScale)});
    lv_obj_set_height(eye_l, ${Math.round(165 * eyeScale)});
    lv_obj_set_width(eye_r, ${Math.round(100 * eyeScale)});
    lv_obj_set_height(eye_r, ${Math.round(165 * eyeScale)});

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

// 9. Developer Mode Event Listeners & Functions
const deviceScreen = document.getElementById('deviceScreen');
const devModeLabel = document.getElementById('devModeLabel');
let devModeActive = false;
let screenPressTimer = null;
let screenPressStart = 0;
const expressions = ['neutral', 'happy', 'angry', 'sad', 'sleepy', 'cry', 'interest', 'ooh', 'wtf', 'laugh', 'bored', 'blush', 'chill'];

if (deviceScreen && devModeLabel) {
    deviceScreen.addEventListener('mousedown', handleScreenPressStart);
    deviceScreen.addEventListener('mouseup', handleScreenPressEnd);
    deviceScreen.addEventListener('mouseleave', handleScreenPressCancel);

    deviceScreen.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleScreenPressStart();
    });
    deviceScreen.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleScreenPressEnd();
    });
}

function handleScreenPressStart() {
    screenPressStart = Date.now();
    clearTimeout(screenPressTimer);
    screenPressTimer = setTimeout(() => {
        toggleDeveloperMode();
    }, 5000);
}

function handleScreenPressCancel() {
    clearTimeout(screenPressTimer);
}

function handleScreenPressEnd() {
    clearTimeout(screenPressTimer);
    const duration = Date.now() - screenPressStart;
    if (duration >= 5000) {
        return;
    }
    if (devModeActive && duration < 1000) {
        cycleExpression();
    }
}

function toggleDeveloperMode() {
    devModeActive = !devModeActive;
    if (devModeActive) {
        devModeLabel.classList.add('active');
        setExpression('neutral');
        devModeLabel.innerText = "DEV: NEUTRAL";
        playBeep(440, 880, 0.35); // Enter double chirp
    } else {
        devModeLabel.classList.remove('active');
        setExpression('neutral');
        playBeep(880, 440, 0.35); // Exit double chirp
    }
}

function cycleExpression() {
    const currentIndex = expressions.indexOf(activeExpression);
    let nextIndex = currentIndex + 1;
    if (nextIndex >= expressions.length) {
        nextIndex = 0;
    }
    const nextExpr = expressions[nextIndex];
    setExpression(nextExpr);
    devModeLabel.innerText = `DEV: ${nextExpr.toUpperCase()}`;
}

// Initialize C code block display on load
updateCodeBlock();
setExpression('neutral');
