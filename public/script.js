console.log("script working really");

var moduleName = 'ggwave.js';
window.AudioContext = window.AudioContext || window.webkitAudioContext;
window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;

var context = null;
var recorder = null;

// the ggwave module instance
var ggwave = null;
var parameters = null;
var instance = null;


let resultObj;

require([moduleName], function (fooModule) {
    // instantiate the ggwave instance
    // ggwave_factory comes from the ggwave.js module
    fooModule().then(function (obj) {
        ggwave = obj;
        console.log(ggwave);
    });
})
var txData = document.getElementById("txData");
var rxData = document.getElementById("rxData");
var captureStart = document.getElementById("captureStart");
var captureStop = document.getElementById("captureStop");
var saveBtn = document.getElementById("save-btn");
let btn = document.querySelector(".generateQr");
let qr_code_element = document.querySelector(".qr-code");
saveBtn.style.display = "none";

// Contact details 
var contact = {
    name: "",
    phone: "",
    email: ""
  };

// helper function
function convertTypedArray(src, type) {
    var buffer = new ArrayBuffer(src.byteLength);
    var baseView = new src.constructor(buffer).set(src);
    return new type(buffer);
}

// initialize audio context and ggwave
function init() {
    if (!context) {
        context = new AudioContext({ sampleRate: 48000 });

        parameters = ggwave.getDefaultParameters();
        parameters.sampleRateInp = context.sampleRate;
        parameters.sampleRateOut = context.sampleRate;
        instance = ggwave.init(parameters);
    }
}

//
// Tx
//

function onSend() {
    init();
    // pause audio capture during transmission
    captureStop.click();

    // generate audio waveform
    var waveform = ggwave.encode(instance, txData.value, ggwave.ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_FAST, 10)
    // var waveform = ggwave.encode(instance, txData.value, ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_NORMAL, 10)

    // play audio
    var buf = convertTypedArray(waveform, Float32Array);
    var buffer = context.createBuffer(1, buf.length, context.sampleRate);
    buffer.getChannelData(0).set(buf);
    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
}

//
// Rx
//

captureStart.addEventListener("click", function () {
    init();

    let constraints = {
        audio: {
            // not sure if these are necessary to have
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false
        }
    };

    navigator.mediaDevices.getUserMedia(constraints).then(function (e) {
        mediaStream = context.createMediaStreamSource(e);

        var bufferSize = 1024;
        var numberOfInputChannels = 1;
        var numberOfOutputChannels = 1;

        if (context.createScriptProcessor) {
            recorder = context.createScriptProcessor(
                bufferSize,
                numberOfInputChannels,
                numberOfOutputChannels);
        } else {
            recorder = context.createJavaScriptNode(
                bufferSize,
                numberOfInputChannels,
                numberOfOutputChannels);
        }

        recorder.onaudioprocess = function (e) {
            var source = e.inputBuffer;
            var res = ggwave.decode(instance, convertTypedArray(new Float32Array(source.getChannelData(0)), Int8Array));

            if (res && res.length > 0) {
                res = new TextDecoder("utf-8").decode(res);
                rxData.value = res;
                resultObj = JSON.parse(rxData.value);
                contact.name = resultObj[0].name[0];
                contact.email = resultObj[0].email[0];
                contact.phone = resultObj[0].tel[0];
                saveBtn.style.display = "block";
                // addContact(obj[0].name[0], obj[0].tel[0]);
            }

            // obsolete javascript resampling
            // since ggwave v0.2.0 the resampling is built-in ggwave
            //var offlineCtx = new OfflineAudioContext(source.numberOfChannels, 48000*source.duration, 48000);
            //var offlineSource = offlineCtx.createBufferSource();

            //offlineSource.buffer = source;
            //offlineSource.connect(offlineCtx.destination);
            //offlineSource.start();
            //offlineCtx.startRendering();
            //offlineCtx.oncomplete = function(e) {
            //    var resampled = e.renderedBuffer.getChannelData(0);
            //    var res = ggwave.decode(instance, convertTypedArray(new Float32Array(resampled), Int8Array));
            //    if (res) {
            //        rxData.value = res;
            //    }
            //};
        }

        mediaStream.connect(recorder);
        recorder.connect(context.destination);
    }).catch(function (e) {
        console.error(e);
    });

    rxData.value = 'Listening ...';
    captureStart.hidden = true;
    captureStop.hidden = false;
});

captureStop.addEventListener("click", function () {
    if (recorder) {
        recorder.disconnect(context.destination);
        mediaStream.disconnect(recorder);
        recorder = null;
    }

    rxData.value = 'Audio capture is paused! Press the "Start capturing" button to analyze audio from the microphone';
    captureStart.hidden = false;
    captureStop.hidden = true;
});

captureStop.click();



// Getting Contacts 
async function openContactPicker() {
    const supported = "contacts" in navigator && "ContactsManager" in window;

    if (supported) {
        txData.textContent = await getContacts();
        generate(txData.value);
    } else {
        alert(
            "Contact list API not supported!. Only for android mobile chrome and chrome version > 80"
        );
    }
}
async function getContacts() {
    const props = ["name", "email", "tel"];
    const opts = { multiple: true };

    try {
        const contacts = await navigator.contacts.select(props, opts);
        // alert(JSON.stringify(contacts));
        return JSON.stringify(contacts);
    } catch (err) {
        alert(err);
    }
}


saveBtn.addEventListener("click", function () {
    // Get the contact information from the website
    saveContactFile();
    // create a vcard file
    
});

function saveContactFile(){
  var vcard = "BEGIN:VCARD\nVERSION:4.0\nFN:" + contact.name + "\nTEL;TYPE=work,voice:" + contact.phone + "\nEMAIL:" + contact.email + "\nEND:VCARD";
    var blob = new Blob([vcard], { type: "text/vcard" });
    var url = URL.createObjectURL(blob);
    
    const newLink = document.createElement('a');
    newLink.download = contact.name + ".vcf";
    newLink.textContent = contact.name;
    newLink.href = url;
    
    newLink.click();
}




function generate(resultObj) {
  qr_code_element.style = "";

  var qrcode = new QRCode(qr_code_element, {
    text: `${resultObj}`,
    width: 180, //128
    height: 180,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  let download = document.createElement("button");
  qr_code_element.appendChild(download);

  let download_link = document.createElement("a");
  download_link.setAttribute("download", "qr_code.png");
  download_link.innerHTML = `Download <i class="fa-solid fa-download"></i>`;

  download.appendChild(download_link);

  let qr_code_img = document.querySelector(".qr-code img");
  let qr_code_canvas = document.querySelector("canvas");

  if (qr_code_img.getAttribute("src") == null) {
    setTimeout(() => {
      download_link.setAttribute("href", `${qr_code_canvas.toDataURL()}`);
    }, 300);
  } else {
    setTimeout(() => {
      download_link.setAttribute("href", `${qr_code_img.getAttribute("src")}`);
    }, 300);
  }
}

// When scan is successful fucntion will produce data
function onScanSuccess(qrCodeMessage) {
  document.getElementById("result").innerHTML =
    '<span class="result">' + qrCodeMessage + "</span>";
    const contact = JSON.parse(qrCodeMessage);
    contact.name = contact[0].name[0];
    contact.email = contact[0].email[0];
    contact.phone = contact[0].tel[0];
    // saveContactFile();
    txData.textContent = qrCodeMessage
    saveBtn.style.display = "block";

}

// When scan is unsuccessful fucntion will produce error message
function onScanError(errorMessage) {
  // Handle Scan Error
}

// Setting up Qr Scanner properties
var html5QrCodeScanner = new Html5QrcodeScanner("reader", {
  fps: 10,
  qrbox: 250
});

// in
html5QrCodeScanner.render(onScanSuccess, onScanError);