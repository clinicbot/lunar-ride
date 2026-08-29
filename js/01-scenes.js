"use strict";

/* the deploy stamp carried on every script URL - the single source of
   truth for which build this page is actually running */
const APP_STAMP=(()=>{
  const sc=document.querySelector('script[src*="?b="]');
  const m=sc&&sc.src.match(/[?&]b=(\d+)/); return m?m[1]:'?';
})();

/* ==========================================================================
   1. THE WORLDS  --  this is the part you tell me to change
   ==========================================================================
   Each world is one block of settings that generates a whole 3D landscape:
   a heightfield with craters carved into it, a road looping through it, and
   rocks scattered around. Copy a block, change the numbers, and it appears
   on the menu.

     land.amp        height of the big rolling hills, in metres
     land.scale      how far apart those hills are, in metres
     land.rough      small-scale roughness, 0 smooth .. 1 jagged
     land.craters    how many craters to carve
     land.craterMax  radius of the biggest crater, metres
     land.rimAmp     height of the mountain ring around the world edge

     road.maxGrade   steepest gradient allowed anywhere on the lap, percent
     road.halfWidth  half the road width, metres
     road.loopR      size of the lap. ~900 gives a 6 km lap
     road.twist      0 nearly circular .. 1 very wiggly

     sun.az/.el      where the sun sits (radians). Low el = long shadows
     sun.col         sunlight colour
     sun.amb         ambient light. Keep it very dark for airless worlds

     col.*           ground colours: high ground, crater floors, road, kerbs
     sky.*           sky colours, fog, stars, and an optional planet
   ========================================================================== */

const SCENES = [
  {
    id:'tranquility',
    name:'Mare Tranquillitatis',
    art:'assets/images/space stations moon.jfif',
    subtitle:'A wide basin on the Sea of Tranquility. Gentle rolling ground, old flooded craters, Earth low over the mountains. Steady endurance work.',
    land:{amp:38, scale:620, rough:.35, craters:80, craterMax:230, rimAmp:280},
    road:{maxGrade:4.5, halfWidth:3.2, loopR:900, twist:.45, tunnels:2, bridges:2},
    sun:{az:2.15, el:.55, col:'#fff4e2', amb:'#171f2d'},
    col:{high:'#8e8c84', low:'#4f4d48', road:'#3c3c3f', rumble:'#d9d7cd', lane:'#c9c7bd'},
    sky:{top:'#000002', horizon:'#05070f', fog:'#0a0e18', fogDen:.00028, stars:1, starBright:.9,
         earth:{az:2.5, el:.22, size:.030}},
    life:{bases:2, walkers:11, rovers:2, ships:2, drones:2, station:true, spaceport:true},
    flora:{crystals:280, pods:40},
    fauna:{drifter:6},
    bio:{stem:'#6a7a86',leaf:'#9fd4e8',glow:'#8fe8ff',skin:'#b6d8e6',
         dark:'#3a4650',accent:'#5f8ba0',eye:'#ffe08a'},
    kit:{hull:'#ccd0d8',trim:'#949aa6',dark:'#2a2e35',glow:'#ffd27a',panel:'#22315e',
         gold:'#c9a24c',suit:'#eef1f6',visor:'#d8a93c',pack:'#b8bdc7',stripe:'#e05a3a',flame:'#ffdaa6'},
    audio:{wind:0,    birds:0},   rocks:900, seed:1969
  },
  {
    id:'copernicus',
    name:'Copernicus Rim',
    subtitle:'The queen stage: 25 km, out of the basin and up the rim in a stack of switchbacks to the summit, where the shoulders turn to ice. Ramps to 9%.',
    land:{amp:95, scale:430, rough:.62, craters:55, craterMax:340, rimAmp:420},
    road:{maxGrade:9, halfWidth:3.0, loopR:1400, twist:.55, tunnels:2, bridges:2, lapKm:25,
          epic:{boost:430, boostR:850, T:4.4, Td:4.0, rmin:100}},
    sun:{az:0.9, el:.40, col:'#fff0d8', amb:'#1b2231'},
    col:{high:'#98918a', low:'#413c37', road:'#41403e', rumble:'#e2dacd', lane:'#cec5b7'},
    sky:{top:'#000002', horizon:'#06040a', fog:'#0d0a12', fogDen:.00022, stars:1, starBright:1,
         earth:{az:5.6, el:.34, size:.026}},
    life:{bases:1, walkers:7, rovers:1, ships:2, drones:1, station:true},
    flora:{crystals:380},
    fauna:{strider:5, drifter:4},
    bio:{stem:'#6f6a7a',leaf:'#b9aecb',glow:'#cfb6ff',skin:'#9c93a8',
         dark:'#3d3946',accent:'#7a6f92',eye:'#ffd08a'},
    kit:{hull:'#ccd0d8',trim:'#949aa6',dark:'#2a2e35',glow:'#ffd27a',panel:'#22315e',
         gold:'#c9a24c',suit:'#eef1f6',visor:'#d8a93c',pack:'#b8bdc7',stripe:'#e05a3a',flame:'#ffdaa6'},
    audio:{wind:0,    birds:0},   rocks:1500, seed:1473
  },
  {
    id:'farside',
    name:'Far Side, Lunar Night',
    subtitle:'No Earth, no sun, no landmarks. Ground lit only by starlight and the beacons along the road. Disorienting in the best way.',
    land:{amp:60, scale:520, rough:.5, craters:95, craterMax:260, rimAmp:340},
    road:{maxGrade:6, halfWidth:3.2, loopR:820, twist:.85, tunnels:2, bridges:3},
    sun:{az:1.4, el:.50, col:'#41597f', amb:'#0f1622'},
    col:{high:'#3a3a40', low:'#1f1f24', road:'#1e1e24', rumble:'#3aa0c8', lane:'#2f7d9c'},
    sky:{top:'#000000', horizon:'#010208', fog:'#01020a', fogDen:.00035, stars:1, starBright:1.5,
         earth:null},
    life:{bases:1, walkers:6, rovers:1, ships:1, drones:3},
    flora:{pods:240, spires:80, crystals:140},
    fauna:{drifter:10, hopper:7},
    bio:{stem:'#1f3a44',leaf:'#2f7d9c',glow:'#6fe8ff',skin:'#3d5f70',
         dark:'#132028',accent:'#1f5c72',eye:'#aef4ff'},
    kit:{hull:'#7f8794',trim:'#525a68',dark:'#1b1f26',glow:'#5fd2ff',panel:'#16244a',
         gold:'#8e7a44',suit:'#c6ccd6',visor:'#7fd7ff',pack:'#8a919c',stripe:'#3aa0c8',flame:'#8fe4ff'},
    audio:{wind:0,    birds:0.25},rocks:800, beacons:true, seed:404
  },
  {
    id:'valles',
    name:'Valles Marineris',
    art:'assets/images/space stations mars.jfif',
    subtitle:'Mars. Rust-red dust, a butterscotch sky thick enough to haze the distance, and a canyon-rim road with long false flats.',
    land:{amp:80, scale:700, rough:.55, craters:35, craterMax:200, rimAmp:520},
    road:{maxGrade:7, halfWidth:3.4, loopR:950, twist:.6, tunnels:2, bridges:3},
    sun:{az:3.6, el:.70, col:'#ffd9b0', amb:'#573926'},
    col:{high:'#a9663d', low:'#6d3f24', road:'#4a2d1c', rumble:'#e8c39a', lane:'#e8d3b4'},
    sky:{top:'#4a3222', horizon:'#c08a5a', fog:'#c9a077', fogDen:.00085, stars:0, starBright:0,
         cloud:.22, cloudCol:'#d8b48c', earth:null},
    veg:{grass:4200, bush:170, dry:true, tintA:'#8a5a33', tintB:'#b08348'},
    skyImg:'assets/images/sky_mars.jpg',
    life:{bases:2, walkers:10, rovers:3, ships:1, drones:2, station:true, spaceport:true},
    flora:{fans:180, tufts:430, pods:80, spires:45},
    fauna:{grazer:8, strider:5, hopper:6},
    bio:{stem:'#6b4326',leaf:'#8f7a34',glow:'#ffcf6a',skin:'#9c6a3c',
         dark:'#43291a',accent:'#c4532c',eye:'#ffe6a0'},
    kit:{hull:'#e2d6c6',trim:'#a98d72',dark:'#3b2a1e',glow:'#ffcf87',panel:'#2f3f6b',
         gold:'#c98f47',suit:'#f2ece2',visor:'#c8862f',pack:'#c8bcac',stripe:'#d5502a',flame:'#ffcf9a'},
    audio:{wind:0.30, birds:0},   rocks:1100, seed:2049
  },
  {
    id:'keplervale',
    name:'Kepler Vale',
    subtitle:'A warm exoplanet valley under a violet sky. Amber fern forests, drifting bio-lanterns, and herds of long-legged browsers that stop grazing and watch you go past.',
    land:{amp:72, scale:560, rough:.5, craters:10, craterMax:130, rimAmp:470},
    road:{maxGrade:7, halfWidth:3.3, loopR:880, twist:.7, tunnels:2, bridges:3, shortcut:true},
    sun:{az:2.4, el:.62, col:'#ffedc8', amb:'#43405a'},
    col:{high:'#7da24e', low:'#3f6234', road:'#4a4740', rumble:'#ddd7bd', lane:'#efe9cd'},
    snow:240, water:{q:0.10, col:'#2e7d99'}, skyImg:'assets/images/sky_kepler.jpg',
    veg:{grass:15000, bush:520, oaks:1500, pines:1200, tintA:'#4f7a38', tintB:'#b9a44e'},
    zones:['meadow','forest','flower','grove','rocky','meadow','forest','flower'],
    sky:{top:'#3c2a6a', horizon:'#cf9cba', fog:'#b89cc2', fogDen:.00040, stars:0, starBright:0,
         cloud:.55, cloudCol:'#f6f0f4',
         earth:{az:1.15, el:.33, size:.055}},
    life:{bases:2, walkers:8, rovers:2, ships:2, drones:3, station:true, spaceport:true},
    flora:{spires:200, fans:340, tufts:1100, pods:190},
    fauna:{grazer:10, strider:8, hopper:9, drifter:7},
    bio:{stem:'#6b4a2e',leaf:'#4e8a3a',glow:'#ffe07a',skin:'#a8763f',
         dark:'#4a3320',accent:'#d4552f',eye:'#8fffc8'},
    kit:{hull:'#d6d2c6',trim:'#9a9486',dark:'#2f2c26',glow:'#ffd98a',panel:'#26325e',
         gold:'#c9a24c',suit:'#f0f2f6',visor:'#d8a93c',pack:'#bcc0c8',stripe:'#3aa06a',flame:'#ffd9a6'},
    audio:{wind:0.70, birds:1},   rocks:520, seed:442
  },
  {
    id:'aurelia',
    name:'Aurelia Wilds — Grand Tour',
    subtitle:'A 25 km living-world grand tour: lakeside meadows, deep forests, glowing flower fields, crystal country, futuristic settlements and a long alpine climb into frozen highlands before the descent home.',
    land:{amp:125, scale:620, rough:.55, craters:5, craterMax:125, rimAmp:520},
    road:{maxGrade:8, halfWidth:3.35, loopR:1380, twist:.72, tunnels:3, bridges:4, lapKm:25,
          epic:{boost:360, boostR:900, T:4.4, Td:4.0, rmin:115}},
    sun:{az:2.55, el:.58, col:'#fff0c8', amb:'#405469'},
    col:{high:'#879b63', low:'#365b43', road:'#3f4140', rumble:'#e7e0c2', lane:'#fff2ce'},
    water:{q:0.115, col:'#287fa3'},
    snow:255, iceAbove:175, skyImg:'assets/images/sky_kepler.jpg',
    veg:{grass:24000, bush:1000, oaks:2200, pines:2600, tintA:'#397649', tintB:'#c4ae50'},
    zones:['meadow','forest','flower','grove','rocky','forest','meadow','flower','grove','rocky'],
    sky:{top:'#28456f', horizon:'#d69ab1', fog:'#91a7ba', fogDen:.00034, stars:0, starBright:0,
         cloud:.60, cloudCol:'#fff3ee', earth:{az:5.2, el:.28, size:.040}},
    life:{bases:4, walkers:16, rovers:4, ships:4, drones:6, station:true, spaceport:true},
    flora:{spires:320, fans:520, tufts:1200, pods:340, crystals:220},
    fauna:{grazer:10, strider:8, hopper:10, drifter:8},
    bio:{stem:'#466f4f',leaf:'#5fa94e',glow:'#9dffcb',skin:'#a98a58',
         dark:'#29372d',accent:'#e06a47',eye:'#fff19a'},
    kit:{hull:'#d9ddd8',trim:'#8d9994',dark:'#27302f',glow:'#8fffe0',panel:'#244b67',
         gold:'#d2ac55',suit:'#f0f3f1',visor:'#d7ad4d',pack:'#b7c0bd',stripe:'#3ca876',flame:'#b8fff0'},
    audio:{wind:.62, birds:1}, rocks:900, seed:7319
  },
  {
    id:'cinder',
    name:'Cinder Reach',
    subtitle:'A volcanic moon that has not finished cooling. Black basalt, fissures that still glow, and a road that bores through the old flows and crosses the lava lakes on tall piers.',
    land:{amp:105, scale:430, rough:.78, craters:30, craterMax:210, rimAmp:540},
    road:{maxGrade:8, halfWidth:3.2, loopR:850, twist:.8, tunnels:4, bridges:4},
    lava:{col:'#ff6a1e', depth:9},
    sun:{az:1.9, el:.30, col:'#ffb27a', amb:'#33170f'},
    col:{high:'#4e4642', low:'#241d1b', road:'#2f2b29', rumble:'#e0a060', lane:'#f0c48c'},
    sky:{top:'#150507', horizon:'#61200f', fog:'#3d1409', fogDen:.00062, stars:1, starBright:.45,
         cloud:.30, cloudCol:'#7a4630', earth:null},
    life:{bases:1, walkers:5, rovers:1, ships:2, drones:3, station:true},
    flora:{crystals:340},
    fauna:{drifter:7},
    bio:{stem:'#3a2018',leaf:'#c4501c',glow:'#ffa445',skin:'#6a3320',
         dark:'#1d100c',accent:'#e0621f',eye:'#ffd08a'},
    kit:{hull:'#c2bcb4',trim:'#8d857c',dark:'#26211e',glow:'#ffc070',panel:'#2a2f52',
         gold:'#c9a24c',suit:'#ecefF4',visor:'#d8a93c',pack:'#b6bac2',stripe:'#e0541f',flame:'#ffcf8a'},
    audio:{wind:0.45, birds:0}, rocks:1000, beacons:true, seed:1815
  },
  {
    id:'grid',
    name:'The Grid',
    subtitle:'Not a planet at all. Black glass under a magenta sky, a glowing wireframe stretching to the horizon. Built for intervals you want over quickly.',
    land:{amp:30, scale:800, rough:.25, craters:0, craterMax:0, rimAmp:260},
    road:{maxGrade:6, halfWidth:3.6, loopR:820, twist:.9, tunnels:2, bridges:2},
    sun:{az:4.2, el:.50, col:'#b060c0', amb:'#1c0726'},
    col:{high:'#100f1c', low:'#080714', road:'#0e0e1a', rumble:'#ff3ec8', lane:'#00e5ff'},
    sky:{top:'#08000f', horizon:'#6a0f5c', fog:'#3a0640', fogDen:.00055, stars:1, starBright:.7,
         earth:null},
    life:{bases:2, walkers:7, rovers:2, ships:3, drones:4, station:true},
    flora:{crystals:320},
    fauna:{},
    bio:{stem:'#2a0a3a',leaf:'#ff3ec8',glow:'#00e5ff',skin:'#2a2a44',
         dark:'#0b0b16',accent:'#7a1d9d',eye:'#00e5ff'},
    kit:{hull:'#1b1b2e',trim:'#38385c',dark:'#0b0b16',glow:'#00e5ff',panel:'#2a0a3a',
         gold:'#ff3ec8',suit:'#2a2a44',visor:'#ff3ec8',pack:'#1f1f36',stripe:'#00e5ff',flame:'#ff6ad5'},
    audio:{wind:0.15, birds:0}, rocks:260, grid:true, beacons:true, seed:8080
  }
];
