const express = require("express");
const app = express();
var five = require("johnny-five");
//const googleTTS = require("google-tts-api"); // import tts for server-side

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://danigruden.github.io");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  next();
});

var board = new five.Board({ port: "COM3" });

app.post("/api/display", (req, res) => {
  var numOfCharsInRow = 16;
  newText = req.body.text;
  var screenLCD = new five.LCD({
    controller: "PCF8574T",
  });

  if (newText.length <= numOfCharsInRow) {
    screenLCD.cursor(0, 0).print(newText);
  } else {
    var firstRow = newText.substring(0, numOfCharsInRow);
    var secondRow = newText.substring(numOfCharsInRow, numOfCharsInRow * 2);
    screenLCD.cursor(0, 0).print(firstRow);
    screenLCD.cursor(1, 0).print(secondRow);
  }
  // This is a server-side way of getting audio speech data from text
  // Returns URL to the audio file
  /* 
  const url = googleTTS.getAudioUrl(newText, {
    lang: "en-US",
    slow: false,
    host: "https://translate.google.com",
  });
  console.log(url); // https://translate.google.com/translate_tts?...
  */
  const io = app.get("io");
  io.emit("message", newText);
  res.status(200).json({
    message: "LCD text changed successfully!",
    newDisplayedText: newText,
  });
});


app.post("/api/ledrgb", (req, res) => {
  var redLED = new five.Led(9);
  var greenLED = new five.Led(10);
  var blueLED = new five.Led(11);

  redBrightness = req.body.redBrightness / 10;
  greenBrightness = req.body.greenBrightness / 10;
  blueBrightness = req.body.blueBrightness / 10;

  redLED.brightness(redBrightness);
  greenLED.brightness(greenBrightness);
  blueLED.brightness(blueBrightness);

  const io = app.get("io");
  let color = {
    r: req.body.redBrightness,
    g: req.body.greenBrightness,
    b: req.body.blueBrightness,
  };
  io.emit("colorRGB", color);
  res.status(200).json({
    message: "Color successfully changed!",
    colorRGB: color,
  });
});

let soundLevelsBefore;
let highestLoudness = 0;
board.on("ready", function () {
  var powerSource = new five.Led(4);
  powerSource.on();

  const io = app.get("io");
  var soundSensor = new five.Led(2);
  var mic = new five.Sensor("A0");
  soundSensor.on();
  mic.on("data", function () {
    if (this.value !== soundLevelsBefore) {
      if (this.value > highestLoudness) {
        highestLoudness = this.value;
      }
      io.emit("soundLoudness", {
        current: this.value,
        highest: highestLoudness,
      });
    }
    soundLevelsBefore = this.value;
  });

  var tempRes = new five.Sensor("A2");
  // resistance at 25 degrees C
  const thermistronominal = 100000;
  // temp. for nominal resistance
  const temperaturenominal = 25;
  // The beta coefficient of the thermistor (usually 3000-4000)
  const bcoefficient = 3950;
  // the value of the 'other' resistor
  const seriesResistor = 52000;
  // Current thermistor resistance
  var currTherRes;

  var currTemp;
  var prevTemp;
  let checking = false;

  tempRes.on("data", function () {
    currTherRes = 1023 / tempRes.value - 1;
    currTherRes = seriesResistor / currTherRes;
    currTemp = currTherRes / thermistronominal;
    currTemp = Math.log(currTemp);
    currTemp = currTemp / bcoefficient;
    currTemp += 1 / (temperaturenominal + 273.15);
    currTemp = 1 / currTemp;
    currTemp -= 273.15;
    currTemp = currTemp.toFixed(1);
    if (currTemp !== prevTemp && !checking) {
      sendNewTemp();
    }
  });

  // Waiting 1 second before new data output
  // Doesn't emit if previous temperature is the same as current
  async function sendNewTemp() {
    io.emit("currentTemp", currTemp);
    checking = true;
    prevTemp = currTemp;
    await sleep(1000);
    checking = false;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});

module.exports = app;
