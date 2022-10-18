var audioCtx;
var globalAnalyser;
var globalGain;

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)
    globalGain = audioCtx.createGain(); //this will control the volume of all notes
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime)
    globalGain.connect(audioCtx.destination);
    globalAnalyser = audioCtx.createAnalyser();
    globalGain.connect(globalAnalyser);
    globalGain.connect(globalAnalyser);
    peak();
}

var maxAlltime = 0
function peak() {
    globalAnalyser.fftSize = 2048;
    var bufferLength = globalAnalyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);
    globalAnalyser.getByteTimeDomainData(dataArray);

    //values range 0-255, over the range -1,1, so we find the max value from a frame, and then scale
    var maxValue = (dataArray.reduce((max, curr) => (curr > max ? curr : max)) - 128) / 127.0;
    //console.log(maxValue);
    if (maxValue > maxAlltime){
        maxAlltime = maxValue;
        //console.log("New record! -> " + maxAlltime);
    }
    requestAnimationFrame(peak);
}

document.addEventListener("DOMContentLoaded", function(event) {
    initAudio();

    const keyboardFrequencyMap = {
        '90': 261.625565300598634,  //Z - C
        '83': 277.182630976872096, //S - C#
        '88': 293.664767917407560,  //X - D
        '68': 311.126983722080910, //D - D#
        '67': 329.627556912869929,  //C - E
        '86': 349.228231433003884,  //V - F
        '71': 369.994422711634398, //G - F#
        '66': 391.995435981749294,  //B - G
        '72': 415.304697579945138, //H - G#
        '78': 440.000000000000000,  //N - A
        '74': 466.163761518089916, //J - A#
        '77': 493.883301256124111,  //M - B
        '81': 523.251130601197269,  //Q - C
        '50': 554.365261953744192, //2 - C#
        '87': 587.329535834815120,  //W - D
        '51': 622.253967444161821, //3 - D#
        '69': 659.255113825739859,  //E - E
        '82': 698.456462866007768,  //R - F
        '53': 739.988845423268797, //5 - F#
        '84': 783.990871963498588,  //T - G
        '54': 830.609395159890277, //6 - G#
        '89': 880.000000000000000,  //Y - A
        '55': 932.327523036179832, //7 - A#
        '85': 987.766602512248223,  //U - B
    }

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    activeOscillators = {}
    activeGain = {}
    activeAM = {}
    let totalOsc = 0

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            playNote(key);
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            activeGain[key].gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + .5)
            activeGain[key].gain.setTargetAtTime(0, audioCtx.currentTime, 1)
            if(keyboardFrequencyMap[key] && activeAM[key]){
                activeAM[key].gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + .5)
                activeAM[key].gain.setTargetAtTime(0, audioCtx.currentTime, 1)
                delete activeAM[key];
            }
            let arr = activeOscillators[key]
            let l = arr.length
            for(let i=0; i<l; i++){
                arr.pop().stop(audioCtx.currentTime+0.6)
                totalOsc -= 1
            }
            delete activeOscillators[key];
            delete activeGain[key];
        }
    }

    function playNote(key) {
        const gainNode = audioCtx.createGain();
        gainNode.connect(globalGain)
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.setTargetAtTime(0.5, audioCtx.currentTime, 1);

        let oscs = []
        totalOsc += 1
        oscs[0] = audioCtx.createOscillator();
        oscs[0].type = document.getElementById('wave').value
        oscs[0].frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime)
        oscs[0].connect(gainNode)
        oscs[0].start();

        let activateLfo = document.getElementById('lfo').checked
        if(activateLfo){
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 15;
            lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 50;
            lfo.connect(lfoGain).connect(oscs[0].frequency);
            lfo.start();
        }

        // initiate AM
        let yesAm = document.getElementById('yesAm').checked
        let am = document.getElementById('am').value
        if(yesAm){
            const modulatorFreq = audioCtx.createOscillator();
            modulatorFreq.frequency.value = am;
            const depth = audioCtx.createGain();
            depth.gain.setValueAtTime(0, audioCtx.currentTime);
            depth.gain.setTargetAtTime(0.5, audioCtx.currentTime, 1);
            gainNode.gain.setTargetAtTime(1.0 - depth.gain.value, audioCtx.currentTime, 1);
            modulatorFreq.connect(depth).connect(gainNode.gain)
            modulatorFreq.start();
            activeAM[key] = depth
        }

        //initiate FM if checked
        let fm = document.getElementById('fm').value
        let modulationIndex = audioCtx.createGain();
        let fmInd = document.getElementById('fmInd').value
        if(fm>0){
            const fmFreq = audioCtx.createOscillator();
            modulationIndex.gain.value = fmInd;
            fmFreq.frequency.value = fm;
            fmFreq.connect(modulationIndex);
            modulationIndex.connect(oscs[0].frequency)
            fmFreq.start();
        }

        // initiate additive synthesis if checked
        let additive = document.getElementById('additive').value;
        if(additive > 0) {
            for (let i = 1; i <= additive; i++) {
                totalOsc += 1
                oscs[i] = audioCtx.createOscillator();
                oscs[i].type = document.getElementById('wave').value
                oscs[i].frequency.setValueAtTime(keyboardFrequencyMap[key] * i, audioCtx.currentTime)
                if (i > 0 && i < 3) {
                    oscs[i].frequency.setValueAtTime(keyboardFrequencyMap[key] * i + (Math.random() * 15), audioCtx.currentTime)
                } else if (i >= 3) {
                    oscs[i].frequency.setValueAtTime(keyboardFrequencyMap[key] * i - (Math.random() * 15), audioCtx.currentTime)
                }
                if (fm > 0) {
                    modulationIndex.connect(oscs[i].frequency)
                }
                oscs[i].connect(gainNode)
                oscs[i].start();
            }
        }

        globalGain.gain.setTargetAtTime(0.8/totalOsc, audioCtx.currentTime, 1);

        activeOscillators[key] = oscs
        activeGain[key] = gainNode
    }
});

// start p5.js code
let x = (Math.random() * window.innerWidth*0.6)
let y = (Math.random() * window.innerHeight*0.7)

function setup(){
    var canvas = createCanvas(window.innerWidth*0.6, window.innerHeight*0.7);
    canvas.parent('animation');
    noStroke()
}

function draw(){
    const wave = document.getElementById("wave");
    if(keyIsDown(90)){
        fill(255,161,182)
        drawShape(wave.value)
    }
    else if(keyIsDown(83)){
        fill(252,0,103)
        drawShape(wave.value)
    }
    else if(keyIsDown(88)){
        fill(244,23,55)
        drawShape(wave.value)
    }
    else if(keyIsDown(68)){
        fill(255,156,105)
        drawShape(wave.value)
    }
    else if(keyIsDown(67)){
        fill(252,0,103)
        drawShape(wave.value)
    }
    else if(keyIsDown(86)){
        fill(197,96,16)
        drawShape(wave.value)
    }
    else if(keyIsDown(71)){
        fill(234,160,0)
        drawShape(wave.value)
    }
    else if(keyIsDown(66)){
        fill(148,121,47)
        drawShape(wave.value)
    }
    else if(keyIsDown(72)){
        fill(255,253,110)
        drawShape(wave.value)
    }
    else if(keyIsDown(78)){
        fill(171,190,0)
        drawShape(wave.value)
    }
    else if(keyIsDown(74)){
        fill(241,255,181)
        drawShape(wave.value)
    }
    else if(keyIsDown(77)){
        fill(90,138,30)
        drawShape(wave.value)
    }
    else if(keyIsDown(81)){
        fill(116,219,0)
        drawShape(wave.value)
    }
    else if(keyIsDown(50)){
        fill(138,255,109)
        drawShape(wave.value)
    }
    else if(keyIsDown(87)){
        fill(0,245,168)
        drawShape(wave.value)
    }
    else if(keyIsDown(51)){
        fill(95,132,114)
        drawShape(wave.value)
    }
    else if(keyIsDown(69)){
        fill(210,247,255)
        drawShape(wave.value)
    }
    else if(keyIsDown(82)){
        fill(2,198,225)
        drawShape(wave.value)
    }
    else if(keyIsDown(53)){
        fill(0,181,255)
        drawShape(wave.value)
    }
    else if(keyIsDown(83)){
        fill(1,124,233)
        drawShape(wave.value)
    }
    else if(keyIsDown(84)){
        fill(125,115,190)
        drawShape(wave.value)
    }
    else if(keyIsDown(54)){
        fill(174,132,255)
        drawShape(wave.value)
    }
    else if(keyIsDown(89)){
        fill(169,76,245)
        drawShape(wave.value)
    }
    else if(keyIsDown(55)){
        fill(178,87,194)
        drawShape(wave.value)
    }
    else if(keyIsDown(85)){
        fill(201,81,142)
        drawShape(wave.value)
    }
}

let scaleVal = 1;
let scaleIncrement = 0.1;

// https://forum.processing.org/two/discussion/25140/how-can-i-scale-an-triangle-with-an-animation.html
// used this link to understand how to scale shapes
function drawShape(wave){
    scaleVal = scaleVal + scaleIncrement;

    if(wave === "sine"){
        push();
        translate(x, y);
        scale(scaleVal);
        ellipse(0, 0, 20, 20);
        pop();
    }
    else if(wave === "triangle"){
        push();
        translate(x, y);
        scale(scaleVal);
        triangle(0, -10, 10, 10, -10, 10);
        pop();
    }
    else if(wave === "sawtooth"){
        push();
        translate(x,y);
        rotate(QUARTER_PI);
        scale(scaleVal/2 * sqrt(2));
        rect(-10, -10, 20, 20);
        pop();
    }
    else if(wave === "square"){
        push();
        translate(x, y);
        scale(scaleVal);
        rect(-10, -10, 20, 20);
        pop();
    }
}

function keyReleased() {
    scaleVal = 0
    x = (Math.random() * window.innerWidth*0.6)
    y = (Math.random() * window.innerHeight*0.7)

    return false
}

window.onresize = windowResized;

function windowResized() {
    resizeCanvas(window.innerWidth*0.6, window.innerHeight*0.75);
}
