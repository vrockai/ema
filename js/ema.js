//
// scroll to bottom to see responsiveAnalogRead() function
//


// consts for demo
var SLIDER_WIDTH = 400;
var ANALOG_RESOLUTION = 1024;
var NOISE = 0.003;

// vars for demo
var mouseX = 0;
var globalSnap = 0;
var responsiveValue = 0;

//
// set up HTML elements and JS events for demo
//

var output = $('#output');
var sliderIndicatorInput = $('#slider_input > div');
var sliderIndicatorOutput = $('#slider_output > div');

var updateSlider = function(slider, value) {
  var sliderLeft = value / (ANALOG_RESOLUTION - 1) * SLIDER_WIDTH - 8;
  slider.css('left', sliderLeft+'px');
}

var begin = function() {
  var loop = function() {      
    var newValue = analogRead();
    responsiveValue = responsiveAnalogRead(newValue);

    // update sliders
    updateSlider(sliderIndicatorInput, newValue);
    updateSlider(sliderIndicatorOutput, responsiveValue);

    // output status
    var outputText = "analogRead: " + newValue + "<br>";
    outputText += "responsiveAnalogRead: " + responsiveValue + "<br><br>";
    outputText += "snap: "+parseFloat(globalSnap).toFixed(2)+"<br>";
    outputText += "lastActivityMS: "+lastActivityMS+"<br>";
    outputText += "errorEMA: "+errorEMA+"<br>";
    outputText += "sleeping: "+sleeping;
    output.html(outputText);
  };

  // event handlers
  $(window).mousemove(function( event ) {
    mouseX = event.pageX;
  });

  // begin loop
  setInterval(loop,50);
}

//
// Define fake Arduino millis() and analogRead() functions
//

var millis = function() {
  var d = new Date();
  return d.getTime(); 
};

var analogRead = function() {
  
  // get input from 0 - 1
  var input = Math.max(0,Math.min(mouseX - 10,SLIDER_WIDTH)) / SLIDER_WIDTH;
  
  // add noise to input
  input += (Math.random() - 0.5) * 2 * NOISE;
  input = Math.max(0, Math.min(1, input));
  
  // simulate analog read
  return Math.floor(input * (ANALOG_RESOLUTION - 1));
};

//
// consts
//

// affects the curve of movement amount > snap amount
// smaller amounts like 0.001 make it ease slower
// larger amounts like 0.1 make it less smooth
var SNAP_MULTIPLIER = 0.01;

// enable sleep, so tiny movements of responsiveValue are ignored
// good for when you want to limit how often responsiveValue updates
// setting sleep to false means that responsiveValue will ease into position
var SLEEP_ENABLE = true;

// how much 'movement' must take place to wake up*
// sleeping makes it harder to wake up. The result is that a nudge is needed to get responsiveAnalogRead to change values if it has been asleep
var ACTIVITY_THRESHOLD = 4;

// enable edge snapping, which will pull values close to either end of the spectrum toward the edge when sleep is enabled. It makes it possible for sleep enabled values to reach either end, without it sleep may kick in too early and the output value may not be able to be pulled closer to the edges
var EDGE_SNAP_ENABLE = true;

//
// vars for responsiveAnalogRead
//

var smoothValue = 0;
var errorEMA = 0;
var lastActivityMS = 0;
var sleeping = false;

//
// responsive analog read
//

var responsiveAnalogRead = function(newValue) {
  // get current milliseconds
  var ms = millis();
  
  // if sleep and edge snap are enabled and the new value is very close to an edge, drag it a little closer to the edges. This'll make it easier to pull the output values right to the extremes without sleeping, and it'll make movements right near the edge appear larger, making it easier to wake up.
  if(SLEEP_ENABLE && EDGE_SNAP_ENABLE) {
    if(newValue < ACTIVITY_THRESHOLD) {
      newValue = newValue*2 - ACTIVITY_THRESHOLD;
    } else if(newValue > ANALOG_RESOLUTION - ACTIVITY_THRESHOLD) {
      newValue = newValue*2 - ANALOG_RESOLUTION + ACTIVITY_THRESHOLD;
    }
  }
  
  // get difference between new input value and current smooth value
  var diff = Math.abs(newValue - smoothValue);
  
  // measure the difference between the new value and current value over time
  // to get a more reasonable indication of how far off the current smooth value is
  // compared to the actual measurements
  errorEMA += ((newValue - smoothValue) - errorEMA) * 0.4;
 
  // if sleep has been enabled, keep track of when we're asleep or not by marking the time of last activity and testing to see how much time has passed since then
  if(SLEEP_ENABLE) {
    // recalculate sleeping status
    // (asleep if last activity was over SLEEP_DELAY_MS ago)
    sleeping = Math.abs(errorEMA) < ACTIVITY_THRESHOLD;
  }
  
  // if we're allowed to sleep, and we're sleeping
  // then don't update responsiveValue this loop
  // just output the existing responsiveValue
  if(SLEEP_ENABLE && sleeping) {
    return Math.floor(smoothValue);
  }
  
  // now calculate a 'snap curve' function, where we pass in the diff (x) and get back a number from 0-1. We want small values of x to result in an output close to zero, so when the smooth value is close to the input value it'll smooth out noise aggressively by responding slowly to sudden changes. We want a small increase in x to result in a much higher output value, so medium and large movements are snappy and responsive, and aren't made sluggish by unnecessarily filtering out noise. A hyperbola (f(x) = 1/x) curve is used. First x has an offset of 1 applied, so x = 0 now results in a value of 1 from the hyperbola function. High values of x tend toward 0, but we want an output that begins at 0 and tends toward 1, so 1-y flips this up the right way. Finally the result is multiplied by 2 and capped at a maximum of one, which means that at a certain point all larger movements are maximally snappy
  
  var snapCurve = function(x) {
    var y = 1 / (x + 1);
    y = (1 - y)*2;
    if(y > 1) {
      return 1;
    }
    return y;
  };
  
  // multiply the input by SNAP_MULTIPLER so input values fit the snap curve better. 
  var snap = snapCurve(diff * SNAP_MULTIPLIER);
  
  // when sleep is enabled, the emphasis is stopping on a responsiveValue quickly, and it's less about easing into position. If sleep is enabled, add a small amount to snap so it'll tend to snap into a more accurate position before sleeping starts.
  if(SLEEP_ENABLE) {
    snap = snap*0.5 + 0.5;
  }
  
  // (update globalSnap so we can show snap in the output window)
  globalSnap = snap;
  
  // calculate the exponential moving average based on the snap
  smoothValue += (newValue - smoothValue) * snap;
  
  // ensure output is in bounds
  if(smoothValue < 0) {
    smoothValue = 0;
  } else if(smoothValue > ANALOG_RESOLUTION - 1) {
    smoothValue = ANALOG_RESOLUTION - 1;
  }
  
  // expected output is an integer
  return Math.floor(smoothValue);
};

//
// begin demo
//

begin();