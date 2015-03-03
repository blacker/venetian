// lute.js
// by Ben Lacker
// at NYC Monthly Music Hackathon, february 28, 2015
// thanks to Manish Nag for the animation
// and Brian McFee for librosa <http://bmcfee.github.io/librosa/>


// the sound
var audioFilename = 'venice/01 - Joan Ambrosio Dalza - Calata ala spagnola.wav';
// beat times from librosa
var beatTimesFilename = 'venice/beat_times.json';
// alternatively, segment times and durations from the echonest
var segTimesFilename = 'venice/seg_times_durs.json'

// init stuff
var audioBuffer = null;
var beatTimes = null;
var source = null;

// params

var initial_angle = 0.05;
var delay = 30; // ms to wait before redrawing
var thresh_factor = 125; // divide 2pi by this to obtain threshold
// how close to 0 does a point have to be to play
var thresh = (Math.PI * 2) / thresh_factor;
var fade_time = 0.01; // seconds

// pick 'beats' or 'segs' as the unit of playback
// 'beats' means use beats as computed by librosa
var unit = 'beats';
// 'segs' means use segments as computed by the echonest
// var unit = 'segs';

var context = new AudioContext();

function loadSound(url, cb) {
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';

  // Decode asynchronously
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
		audioBuffer = buffer;
		if (unit == 'beats') {
			filename = beatTimesFilename;
		} else {
			filename = segTimesFilename;
		}
		loadBeatTimes(filename, function(){
			cb()
		});
    });
  }
  request.send();
}

function loadBeatTimes(filename, cb) {
	d3.json(filename, function(error, json) {
		beatTimes = json;
		cb()
	});
}

function playBeatsWithDelay(i, cb) {

	if (i >= beatTimes.length) {
		// we're done
		cb();
	} else {
		var lilSource = context.createBufferSource();
		lilSource.buffer = audioBuffer;
		lilSource.connect(context.destination);
		startTime = beatTimes[i];
		if (i < (beatTimes.length - 1)) {
			duration =  (beatTimes[i + 1] - beatTimes[i]);
		} else {
			duration = null;
		}
		lilSource.start(0, startTime, duration);
		setTimeout(function() {
			playBeatsWithDelay(i+1)
		}, duration * 2000);
	}
}

function playSegsWithDelay(i, cb) {
	if (i >= beatTimes.length) {
		// we're done
		cb();
	} else {
		var lilSource = context.createBufferSource();
		lilSource.buffer = audioBuffer;
		lilSource.connect(context.destination);
		startTime = beatTimes[i][0];
		duration = beatTimes[i][1];
		lilSource.start(0, startTime, duration);
		setTimeout(function() {
			playSegsWithDelay(i+1)
		}, duration * 2000);
	}
}

function playSeg(start, duration) {
	var lilSource = context.createBufferSource();
	var lilGain = context.createGain();
	var currTime = context.currentTime;

	lilSource.buffer = audioBuffer;
	lilSource.connect(lilGain);
	lilGain.connect(context.destination)

	// fade in
	lilGain.gain.linearRampToValueAtTime(0, currTime);
	lilGain.gain.linearRampToValueAtTime(1, currTime + fade_time);
	// play
	lilSource.start(0, startTime, duration);
	// fade out
	lilGain.gain.linearRampToValueAtTime(1, currTime + duration-fade_time);
	lilGain.gain.linearRampToValueAtTime(0, currTime + duration);
}

function playNthUnit(n) {
	if (unit == 'beats') {
		playNthBeat(n);
	} else {
		playNthSeg(n);
	}
}

function playNthBeat(n) {
	startTime = beatTimes[n];
	if (n + 1 <= beatTimes.length) {
		duration = beatTimes[n + 1] - startTime;
	} else {
		duration = null;
	}
	if (isNaN(duration)) {
		// this is like an "off-by-one" thing i'm too lazy to fix
		// console.log(n,startTime);
	} else {
		playSeg(startTime, duration);
	}
}

function playNthSeg(n) {
	startTime = beatTimes[n][0];
	duration = beatTimes[n][1];
	playSeg(startTime, duration);				
}

function getPoints (num_points, angle) {
	c=1;
	ret_array = new Array(num_points);
	max_r=0;
	for (n=1; n<=num_points; n++) {
		
		r=c*(n);
		
		// MESS WITH THIS FUNCTION FOR GOOD TIMES !!!
		theta=angle*Math.sqrt(n);
		// theta = angle * Math.tan(n);

		if (angle > initial_angle && (Math.abs(theta % (Math.PI * 2)) < thresh) && n <=beatTimes.length) {
			playNthUnit(n-1);
		}

		ret_array[n-1]=Array(r*Math.cos(theta), r*Math.sin(theta));
		max_r=r;
	}
	return Array(ret_array,max_r);
}

//Width and height
width = window.innerWidth;
height = window.innerHeight;
w_margin=20;
if (width > height) {
	w = height-w_margin;
	h = height-w_margin;
} else {
	w = width-w_margin;
	h = width-w_margin;
}

document.getElementById('centre').style.width=w+'px';
document.getElementById('centre').style.height=h+'px';
var word = "pause";
//Create SVG element
var svg = d3.select("div.centre")
			.append("svg")
			.attr("width", w)
			.attr("height", h);
svg.append("a")
	.attr("xlink:href", "javascript:stopLoop();")
	.append("rect")  
	.attr("x", 0)
	.attr("y", 0)
	.attr("height", w)
	.attr("width", h)
	.style("fill", "white")
	.attr("rx", 10)
	.attr("ry", 10);
	
num_points=630;
// num_points = 237;

var phyllo_set = getPoints(num_points,angle);
dataset=phyllo_set[0];
max_r=phyllo_set[1];
var xScale = d3.scale.linear().domain([-1*max_r, 1*max_r]).range([.05*w, w*.95])
var yScale = d3.scale.linear().domain([-1*max_r, 1*max_r]).range([.05*w, w*.95])
	
var angle = 0;

function startLoop() {
	loadSound(audioFilename, function() {
		return(setInterval(function() {
			var phyllo_set = getPoints(num_points,angle);
			dataset=phyllo_set[0];
			max_r=phyllo_set[1];
		
			angle += .01;
			redraw(angle);
		}, delay))
	});
}

var timerId = startLoop();

function stopLoop() {
	if (timerId != -1) {
    	clearInterval(timerId);
    	timerId=-1;
    } else {
    	timerId = startLoop();
    }
}

function redraw(angle) {
	var circle = svg.selectAll("circle")
	   .data(dataset)
	
	var circleEnter = circle.enter()
	   .append("circle")
	
	circle.attr("cx", function(d) {
	   		return xScale(d[0]);
	   })
	   .attr("cy", function(d) {
	   		return yScale(d[1]);
	   })
	   .attr("r", function(d) {
	   		return w/100;
	   })
	
	var circleExit = circle.exit().remove();
	
}

d3.select(window).on('resize', resize); 

function resize() {
	width = window.innerWidth;
		height = window.innerHeight;
		w_margin=20;
		if (width > height) {
			w = height-w_margin;
			h = height-w_margin;
		} else {
			w = width-w_margin;
			h = width-w_margin;
		}
	document.getElementById('centre').style.width=w+'px';
	document.getElementById('centre').style.height=h+'px';
		
	d3.select("div.centre")
					.append("svg")
					.attr("width", w)
					.attr("height", h);
	xScale = d3.scale.linear().domain([-1*max_r, 1*max_r]).range([.05*w, w*.95])
	yScale = d3.scale.linear().domain([-1*max_r, 1*max_r]).range([.05*w, w*.95])
			
	redraw(angle);
}
